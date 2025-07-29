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

// GET the main inbox page (list of conversations)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;

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
        
        res.render('inbox', { user: req.user, conversations });

    } catch (err) {
        console.error("Error fetching conversations for inbox:", err);
        req.flash('error', 'Something went wrong loading your inbox.');
        res.status(500).redirect('/home');
    }
});


// GET chat history between logged-in user and another user
router.get('/:otherUserId', isAuthenticated, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const otherUserId = req.params.otherUserId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            req.flash('error', 'Invalid user ID for chat.');
            return res.status(400).redirect('/messages');
        }

        const currentUser = await User.findById(currentUserId);
        const otherUser = await User.findById(otherUserId);

        if (!currentUser || !otherUser) {
            req.flash('error', 'One or both users not found.');
            return res.status(404).redirect('/messages');
        }

        const senderFollowsRecipient = currentUser.following.some(id => id.equals(otherUserId));
        const recipientFollowsSender = otherUser.following.some(id => id.equals(currentUserId));

        if (currentUser.isPrivate || otherUser.isPrivate) {
            if (!senderFollowsRecipient || !recipientFollowsSender) {
                req.flash('error', 'You must both follow each other to chat.');
                return res.status(403).redirect('/messages');
            }
        }

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId }
            ]
        })
        .sort({ createdAt: 1 })
        .populate('sender', 'nickname profilePic email')
        .populate('recipient', 'nickname profilePic email');

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
            }
        }

        // Render the chat EJS template, passing messages and user info
        res.render('chat', { user: req.user, otherUser: otherUser, messages: messages });

    } catch (err) {
        console.error("Error fetching messages for chat:", err);
        req.flash('error', 'Something went wrong loading the chat.');
        res.status(500).redirect('/messages');
    }
});

// GET total unread DM count for the logged-in user (This route is now redundant for EJS rendering, but kept for API calls)
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
