const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post'); // Need Post model to fetch user's posts
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // For deleting old profile pic

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

// GET User Profile Page
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        // Fetch the logged-in user's details
        const user = req.user; 
        // Fetch all posts by this user
        const userPosts = await Post.find({ userId: user._id })
                                    .sort({ createdAt: -1 })
                                    .populate('userId'); // Still populate for consistency, though it's the current user

        res.render('profile', { user, posts: userPosts });
    } catch (err) {
        console.error("Error fetching user profile:", err);
        res.status(500).send("Something went wrong fetching your profile.");
    }
});

// POST route to update user nickname
router.post('/profile/update-nickname', isAuthenticated, async (req, res) => {
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

// POST route to update user profile picture
router.post('/profile/update-profile-pic', isAuthenticated, uploadProfilePic.single('profilePic'), async (req, res) => {
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
