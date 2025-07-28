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

// GET Home Page - show all posts sorted by latest and all users
router.get('/home', isAuthenticated, async (req, res) => {
    try {
        // Populate the 'userId' for the post creator
        // AND populate 'userId' for each comment's creator
        const posts = await Post.find({})
            .sort({ createdAt: -1 })
            .populate('userId') // Populates the post creator
            .populate({ // Populates the user for each comment
                path: 'comments.userId',
                model: 'User'
            }); 

        // Fetch all users for the "suggested users" list
        const allUsers = await User.find({}); // Fetch all users

        const user = req.user; 
        
        res.render('home', { user, posts, allUsers }); // Pass allUsers to the template
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong.");
    }
});

module.exports = router;
