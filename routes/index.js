const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Middleware to check if user is authenticated (assuming this is defined elsewhere)
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// GET Home Page - show personalized feed, all users, and unread counts
router.get('/home', isAuthenticated, async (req, res) => {
    try {
        const user = req.user; // Logged-in user

        const followedUserIds = user.following.map(id => id);
        followedUserIds.push(user._id); // Include current user's own posts in the feed

        const posts = await Post.find({ userId: { $in: followedUserIds } })
            .sort({ createdAt: -1 })
            .populate('userId')
            .populate({
                path: 'comments.userId',
                model: 'User'
            }); 

        const allUsers = await User.find({});

        const unreadNotificationsCount = await Notification.countDocuments({
            recipientId: user._id,
            read: false
        });

        // NEW: Get DM unread count from the user object
        const dmUnreadCount = user.dm_unread_count || 0;

        res.render('home', { user, posts, allUsers, unreadNotificationsCount, dmUnreadCount }); // Pass dmUnreadCount
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong loading the homepage.');
        res.status(500).send("Something went wrong.");
    }
});

module.exports = router;
