const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const FollowRequest = require('../models/FollowRequest'); // <--- NEW: Import FollowRequest model
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// Multer storage for profile pictures
const profilePicStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/profile_pics'));
    },
    filename: function (req, file, cb) {
        cb(null, req.user._id + '-' + Date.now() + path.extname(file.originalname));
    }
});

const uploadProfilePic = multer({ storage: profilePicStorage });

// GET Current User's Profile Page (no ID in URL)
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const profileUser = req.user;
        const isCurrentUser = true;

        const userPosts = await Post.find({ userId: profileUser._id })
                                    .sort({ createdAt: -1 })
                                    .populate('userId');

        // NEW: Fetch pending follow requests for the current user (recipient)
        const pendingFollowRequests = await FollowRequest.find({ recipientId: profileUser._id })
                                                         .populate('senderId', 'nickname profilePic email');


        res.render('profile', { 
            user: req.user, 
            profileUser, 
            posts: userPosts, 
            isCurrentUser,
            pendingFollowRequests // <--- NEW: Pass pending requests to template
        });
    } catch (err) {
        console.error("Error fetching current user profile:", err);
        req.flash('error', 'Something went wrong fetching your profile.');
        res.status(500).redirect('/home'); // Redirect to home on error
    }
});

// GET Another User's Profile Page (with ID in URL)
router.get('/profile/:id', isAuthenticated, async (req, res) => {
    try {
        const profileUser = await User.findById(req.params.id);
        if (!profileUser) {
            req.flash('error', 'User not found.');
            return res.status(404).redirect('/home'); // Redirect to home if user not found
        }

        const isCurrentUser = profileUser._id.equals(req.user._id);

        let userPosts = [];
        let isFollowing = false; // Initial assumption
        let followRequestPending = false; // Initial assumption

        if (!isCurrentUser) {
            // Check if current user is already following this profile
            isFollowing = req.user.following.some(id => id.equals(profileUser._id));
            
            // Check if a follow request is already pending from current user to this profile
            followRequestPending = await FollowRequest.exists({ 
                senderId: req.user._id, 
                recipientId: profileUser._id 
            });

            // Only fetch posts if profile is public OR if current user is following
            if (!profileUser.isPrivate || isFollowing) {
                userPosts = await Post.find({ userId: profileUser._id })
                                        .sort({ createdAt: -1 })
                                        .populate('userId');
            }
        } else {
            // If it's the current user's profile, always show their posts
            userPosts = await Post.find({ userId: profileUser._id })
                                    .sort({ createdAt: -1 })
                                    .populate('userId');
        }


        res.render('profile', { 
            user: req.user, 
            profileUser, 
            posts: userPosts, 
            isCurrentUser,
            isFollowing, // Pass this to determine button state
            followRequestPending // Pass this to determine button state
        });
    } catch (err) {
        console.error("Error fetching other user profile:", err);
        req.flash('error', 'Something went wrong fetching the profile.');
        res.status(500).redirect('/home'); // Redirect to home on error
    }
});

// POST route to update user nickname (only for current user)
router.post('/profile/update-nickname', isAuthenticated, async (req, res, next) => {
    try {
        const newNickname = req.body.nickname;
        if (!newNickname || newNickname.trim() === '') {
            req.flash('error', 'Nickname cannot be empty.');
            return res.status(400).redirect('/profile');
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { nickname: newNickname.trim() },
            { new: true }
        );

        req.login(updatedUser, (err) => {
            if (err) return next(err);
            req.flash('success', 'Nickname updated successfully!');
            res.redirect('/profile');
        });

    } catch (err) {
        console.error("Error updating nickname:", err);
        req.flash('error', 'Something went wrong updating your nickname.');
        res.status(500).redirect('/profile');
    }
});

// POST route to update user profile picture (only for current user)
router.post('/profile/update-profile-pic', isAuthenticated, uploadProfilePic.single('profilePic'), async (req, res, next) => {
    try {
        if (!req.file) {
            req.flash('error', 'No profile picture file uploaded.');
            return res.status(400).redirect('/profile');
        }

        const oldProfilePic = req.user.profilePic;

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { profilePic: '/uploads/profile_pics/' + req.file.filename },
            { new: true }
        );

        req.login(updatedUser, (err) => {
            if (err) return next(err);

            if (oldProfilePic && oldProfilePic !== '/default_profile.jpg' && oldProfilePic.startsWith('/uploads/profile_pics/')) {
                const oldImagePath = path.join(__dirname, '../public', oldProfilePic);
                fs.unlink(oldImagePath, (err) => {
                    if (err) {
                        console.error("Error deleting old profile picture file:", err);
                    } else {
                        console.log("Old profile picture deleted successfully:", oldImagePath);
                    }
                });
            }
            req.flash('success', 'Profile picture updated successfully!');
            res.redirect('/profile');
        });

    } catch (err) {
        console.error("Error updating profile picture:", err);
        req.flash('error', 'Something went wrong updating your profile picture.');
        res.status(500).redirect('/profile');
    }
});

// POST route to toggle user profile privacy
router.post('/profile/toggle-privacy', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        user.isPrivate = !user.isPrivate; // Toggle the privacy status
        await user.save();

        req.login(user, (err) => { // Re-login to update session
            if (err) return next(err);
            req.flash('success', `Profile is now ${user.isPrivate ? 'private' : 'public'}.`);
            res.redirect('/profile');
        });

    } catch (err) {
        console.error("Error toggling privacy:", err);
        req.flash('error', 'Something went wrong toggling your profile privacy.');
        res.status(500).redirect('/profile');
    }
});

// POST route to follow/unfollow/send follow request
router.post('/user/follow/:id', isAuthenticated, async (req, res, next) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user._id;

        if (targetUserId.toString() === currentUserId.toString()) {
            req.flash('error', 'You cannot follow, unfollow, or request to follow yourself.');
            return res.status(400).redirect('/profile/' + targetUserId);
        }

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            req.flash('error', 'User not found.');
            return res.status(404).redirect('/home');
        }

        const isFollowing = currentUser.following.some(id => id.equals(targetUserId));
        const hasPendingRequest = await FollowRequest.exists({
            senderId: currentUserId,
            recipientId: targetUserId
        });

        if (isFollowing) {
            // UNFOLLOW LOGIC (already following)
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
            await Promise.all([currentUser.save(), targetUser.save()]);
            req.flash('success', `You unfollowed ${targetUser.nickname || targetUser.email}.`);
        } else if (hasPendingRequest) {
            // CANCEL FOLLOW REQUEST LOGIC (request already sent)
            await FollowRequest.deleteOne({
                senderId: currentUserId,
                recipientId: targetUserId
            });
            await Notification.deleteOne({
                recipientId: targetUserId,
                senderId: currentUserId,
                type: 'followRequest',
                read: false // Only delete unread notification
            });
            req.flash('success', `Follow request to ${targetUser.nickname || targetUser.email} cancelled.`);
        } else if (targetUser.isPrivate) {
            // SEND FOLLOW REQUEST LOGIC (target is private, not following, no pending request)
            const newRequest = await FollowRequest.create({
                senderId: currentUserId,
                recipientId: targetUserId
            });
            await Notification.create({
                recipientId: targetUserId,
                senderId: currentUserId,
                type: 'followRequest',
                followRequestId: newRequest._id
            });
            req.flash('success', `Follow request sent to ${targetUser.nickname || targetUser.email}.`);
        } else {
            // PUBLIC FOLLOW LOGIC (target is public, not following, no pending request)
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
            await Promise.all([currentUser.save(), targetUser.save()]);
            req.flash('success', `You are now following ${targetUser.nickname || targetUser.email}!`);
            
            // Optional: Create a general 'follow' notification for public profiles
            await Notification.create({
                recipientId: targetUserId,
                senderId: currentUserId,
                type: 'followRequest', // Re-using for general follow, or create new type 'follow'
                // No followRequestId needed for immediate follows
            });
        }

        const updatedCurrentUser = await User.findById(currentUserId);
        req.login(updatedCurrentUser, (err) => {
            if (err) return next(err);
            res.redirect('/profile/' + targetUserId);
        });

    } catch (err) {
        console.error("Error with follow/request:", err);
        req.flash('error', 'Something went wrong with your follow request.');
        res.status(500).redirect('/home');
    }
});


// NEW: POST route to accept a follow request
router.post('/user/follow-request/accept/:requestId', isAuthenticated, async (req, res, next) => {
    try {
        const requestId = req.params.requestId;
        const currentUserId = req.user._id;

        const followRequest = await FollowRequest.findById(requestId);

        if (!followRequest) {
            req.flash('error', 'Follow request not found.');
            return res.status(404).redirect('/profile');
        }

        // Ensure the current user is the recipient of this request
        if (!followRequest.recipientId.equals(currentUserId)) {
            req.flash('error', 'You are not authorized to accept this request.');
            return res.status(403).redirect('/profile');
        }

        const senderUser = await User.findById(followRequest.senderId);
        const recipientUser = await User.findById(followRequest.recipientId);

        if (!senderUser || !recipientUser) {
            req.flash('error', 'User involved in request not found.');
            return res.status(404).redirect('/profile');
        }

        // Perform the follow action
        if (!senderUser.following.some(id => id.equals(recipientUser._id))) {
            senderUser.following.push(recipientUser._id);
        }
        if (!recipientUser.followers.some(id => id.equals(senderUser._id))) {
            recipientUser.followers.push(senderUser._id);
        }

        await Promise.all([senderUser.save(), recipientUser.save()]);

        // Delete the follow request
        await FollowRequest.findByIdAndDelete(requestId);

        // Delete the corresponding notification
        await Notification.deleteOne({ followRequestId: requestId, recipientId: currentUserId, type: 'followRequest' });

        // Optional: Send a notification back to the sender that their request was accepted
        await Notification.create({
            recipientId: senderUser._id, // Sender of the request is now the recipient of this notification
            senderId: currentUserId,     // Recipient of the request is now the sender of this notification
            type: 'followRequest',       // Can reuse 'followRequest' type, or make new 'followAccepted'
            commentText: 'accepted your follow request!' // A simple message for the sender
        });


        req.login(recipientUser, (err) => { // Re-login recipient to update session if needed
            if (err) return next(err);
            req.flash('success', `You accepted ${senderUser.nickname || senderUser.email}'s follow request.`);
            res.redirect('/profile');
        });

    } catch (err) {
        console.error("Error accepting follow request:", err);
        req.flash('error', 'Something went wrong accepting the follow request.');
        res.status(500).redirect('/profile');
    }
});

// NEW: POST route to decline/delete a follow request
router.post('/user/follow-request/decline/:requestId', isAuthenticated, async (req, res, next) => {
    try {
        const requestId = req.params.requestId;
        const currentUserId = req.user._id;

        const followRequest = await FollowRequest.findById(requestId);

        if (!followRequest) {
            req.flash('error', 'Follow request not found.');
            return res.status(404).redirect('/profile');
        }

        // Ensure the current user is the recipient of this request
        if (!followRequest.recipientId.equals(currentUserId)) {
            req.flash('error', 'You are not authorized to decline this request.');
            return res.status(403).redirect('/profile');
        }

        const senderUser = await User.findById(followRequest.senderId); // Get sender for message

        // Delete the follow request
        await FollowRequest.findByIdAndDelete(requestId);

        // Delete the corresponding notification
        await Notification.deleteOne({ followRequestId: requestId, recipientId: currentUserId, type: 'followRequest' });

        req.login(req.user, (err) => { // Re-login current user to update session if needed
            if (err) return next(err);
            req.flash('success', `You declined ${senderUser ? (senderUser.nickname || senderUser.email) : 'a user\'s'} follow request.`);
            res.redirect('/profile');
        });

    } catch (err) {
        console.error("Error declining follow request:", err);
        req.flash('error', 'Something went wrong declining the follow request.');
        res.status(500).redirect('/profile');
    }
});


module.exports = router;
