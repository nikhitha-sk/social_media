const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');

// Middleware to check if user is authenticated (assuming this is defined elsewhere)
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login'); // Redirect to login if not authenticated
}

// GET Home Page - show personalized feed and all users
router.get('/home', isAuthenticated, async (req, res) => {
    try {
        const user = req.user; // Logged-in user

        // Get IDs of users the current user is following, plus the current user's own ID
        const followedUserIds = user.following.map(id => id);
        followedUserIds.push(user._id); // Include current user's own posts in the feed

        // Fetch posts only from followed users (and current user)
        const posts = await Post.find({ userId: { $in: followedUserIds } })
            .sort({ createdAt: -1 })
            .populate('userId') // Populates the post creator
            .populate({ // Populates the user for each comment
                path: 'comments.userId',
                model: 'User'
            }); 

        // Fetch all users for the "suggested users" list
        const allUsers = await User.find({});

        res.render('home', { user, posts, allUsers });
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong.");
    }
});

module.exports = router;
