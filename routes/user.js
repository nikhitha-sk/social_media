const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Multer storage for profile pictures
const profilePicStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/profile_pics')); // Dedicated folder for profile pics
    },
    filename: function (req, file, cb) {
        // Use user ID for unique filename for their profile pic
        cb(null, req.user._id + '-' + Date.now() + path.extname(file.originalname));
    }
});

const uploadProfilePic = multer({ storage: profilePicStorage });

// NEW: GET Current User's Profile Page (no ID in URL)
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const profileUser = req.user; // Current logged-in user
        const isCurrentUser = true;

        // Fetch all posts by this user
        const userPosts = await Post.find({ userId: profileUser._id })
                                    .sort({ createdAt: -1 })
                                    .populate('userId');

        res.render('profile', { user: req.user, profileUser, posts: userPosts, isCurrentUser });
    } catch (err) {
        console.error("Error fetching current user profile:", err);
        res.status(500).send("Something went wrong fetching your profile.");
    }
});

// NEW: GET Another User's Profile Page (with ID in URL)
router.get('/profile/:id', isAuthenticated, async (req, res) => {
    try {
        const profileUser = await User.findById(req.params.id);
        if (!profileUser) {
            return res.status(404).send("User not found.");
        }

        // Check if the requested profile belongs to the logged-in user
        const isCurrentUser = profileUser._id.equals(req.user._id);

        // Fetch all posts by the profileUser
        const userPosts = await Post.find({ userId: profileUser._id })
                                    .sort({ createdAt: -1 })
                                    .populate('userId');

        res.render('profile', { user: req.user, profileUser, posts: userPosts, isCurrentUser });
    } catch (err) {
        console.error("Error fetching other user profile:", err);
        res.status(500).send("Something went wrong fetching the profile.");
    }
});


// POST route to update user nickname (only for current user)
router.post('/profile/update-nickname', isAuthenticated, async (req, res, next) => {
    try {
        const newNickname = req.body.nickname;
        if (!newNickname || newNickname.trim() === '') {
            return res.status(400).send("Nickname cannot be empty.");
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { nickname: newNickname.trim() },
            { new: true } // Return the updated document
        );

        // Update the user object in the session
        req.login(updatedUser, (err) => {
            if (err) return next(err);
            res.redirect('/profile'); // Redirect back to profile page
        });

    } catch (err) {
        console.error("Error updating nickname:", err);
        res.status(500).send("Something went wrong updating your nickname.");
    }
});

// POST route to update user profile picture (only for current user)
router.post('/profile/update-profile-pic', isAuthenticated, uploadProfilePic.single('profilePic'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).send("No profile picture file uploaded.");
        }

        const oldProfilePic = req.user.profilePic; // Get the current profile pic path

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { profilePic: '/uploads/profile_pics/' + req.file.filename }, // Save new path
            { new: true }
        );

        // Update the user object in the session
        req.login(updatedUser, (err) => {
            if (err) return next(err);

            // Delete old profile picture if it's not the default one
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
            res.redirect('/profile'); // Redirect back to profile page
        });

    } catch (err) {
        console.error("Error updating profile picture:", err);
        res.status(500).send("Something went wrong updating your profile picture.");
    }
});


module.exports = router;
