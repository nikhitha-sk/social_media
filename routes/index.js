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

// GET Home Page - show all posts sorted by latest
// This is the PRIMARY /home route and MUST be in routes/index.js
router.get('/home', isAuthenticated, async (req, res) => {
    try {
        // Populate the 'userId' field to get user details (nickname, profilePic)
        const posts = await Post.find({})
            .sort({ createdAt: -1 })
            .populate('userId'); 

        // req.user is populated by Passport.js after successful authentication
        const user = req.user; 
        
        res.render('home', { user, posts });
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong.");
    }
});

module.exports = router;
