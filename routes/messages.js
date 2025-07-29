const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// GET list of all conversations for the logged-in user
router.get('/conversations', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;

        // Find all unique users involved in messages with the current user
        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { recipient: userId }]
                }
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $eq: ["$sender", userId] },
                            then: "$recipient",
                            else: "$sender"
                        }
                    },
                    lastMessage: { $last: "$$ROOT" },
                    unreadCount: {
                        $sum: {
                            $cond: [{ $and: [{ $eq: ["$recipient", userId] }, { $eq: ["$read", false] }] }, 1, 0]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users', // The collection name for the User model
                    localField: '_id',
                    foreignField: '_id',
                    as: 'otherUser'
                }
            },
            {
                $unwind: '$otherUser'
            },
            {
                $project: {
                    _id: 0,
                    otherUser: { _id: '$otherUser._id', nickname: '$otherUser.nickname', profilePic: '$otherUser.profilePic', email: '$otherUser.email' },
                    lastMessage: { content: '$lastMessage.content', createdAt: '$lastMessage.createdAt' },
                    unreadCount: 1
                }
            },
            {
                $sort: { 'lastMessage.createdAt': -1 }
            }
        ]);
        
        res.json(conversations);
    } catch (err) {
        console.error("Error fetching conversations:", err);
        res.status(500).json({ message: "Error fetching conversations." });
    }
});


// GET chat history between logged-in user and another user
router.get('/:otherUserId', isAuthenticated, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const otherUserId = req.params.otherUserId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ message: "Invalid user ID." });
        }

        // Check if both users follow each other if either account is private
        const currentUser = await User.findById(currentUserId);
        const otherUser = await User.findById(otherUserId);

        if (!currentUser || !otherUser) {
            return res.status(404).json({ message: "One or both users not found." });
        }

        const senderFollowsRecipient = currentUser.following.some(id => id.equals(otherUserId));
        const recipientFollowsSender = otherUser.following.some(id => id.equals(currentUserId));

        if (currentUser.isPrivate || otherUser.isPrivate) {
            if (!senderFollowsRecipient || !recipientFollowsSender) {
                return res.status(403).json({ message: "You must both follow each other to view this chat." });
            }
        }

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId }
            ]
        })
        .sort({ createdAt: 1 }) // Sort by oldest first
        .populate('sender', 'nickname profilePic email') // Populate sender details
        .populate('recipient', 'nickname profilePic email'); // Populate recipient details (optional, but good for full message object)

        // Mark messages from other user as read
        const updateResult = await Message.updateMany(
            { sender: otherUserId, recipient: currentUserId, read: false },
            { $set: { read: true } }
        );

        // Decrement recipient's total unread count
        if (updateResult.modifiedCount > 0) {
            const recipientUserDoc = await User.findById(currentUserId);
            if (recipientUserDoc) {
                recipientUserDoc.dm_unread_count = Math.max(0, recipientUserDoc.dm_unread_count - updateResult.modifiedCount);
                await recipientUserDoc.save();
                // No need to emit dm_unread_count_updated here, as the client will already be in the chat
                // and the count will update when they navigate back to homepage.
            }
        }

        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ message: "Error fetching messages." });
    }
});

// GET total unread DM count for the logged-in user
router.get('/total-unread', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ unreadCount: user.dm_unread_count });
    } catch (err) {
        console.error("Error fetching unread DM count:", err);
        res.status(500).json({ message: "Error fetching unread DM count." });
    }
});

module.exports = router;
