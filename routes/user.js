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
    req.flash('error', 'Please log in to view this page.'); // Add flash message for unauthenticated access
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

        res.render('profile', { user: req.user, profileUser, posts: userPosts, isCurrentUser });
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

        const userPosts = await Post.find({ userId: profileUser._id })
                                    .sort({ createdAt: -1 })
                                    .populate('userId');

        res.render('profile', { user: req.user, profileUser, posts: userPosts, isCurrentUser });
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

// POST route to follow/unfollow a user
router.post('/user/follow/:id', isAuthenticated, async (req, res, next) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user._id;

        if (targetUserId.toString() === currentUserId.toString()) {
            req.flash('error', 'You cannot follow or unfollow yourself.');
            return res.status(400).redirect('/profile/' + targetUserId);
        }

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            req.flash('error', 'User not found.');
            return res.status(404).redirect('/home');
        }

        const isFollowing = currentUser.following.some(id => id.equals(targetUserId));
        let message = '';

        if (isFollowing) {
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
            message = `You unfollowed ${targetUser.nickname || targetUser.email}.`;
        } else {
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
            message = `You are now following ${targetUser.nickname || targetUser.email}!`;
        }

        await Promise.all([currentUser.save(), targetUser.save()]);

        const updatedCurrentUser = await User.findById(currentUserId);
        req.login(updatedCurrentUser, (err) => {
            if (err) return next(err);
            req.flash('success', message); // Set success message
            res.redirect('/profile/' + targetUserId); // Explicitly redirect to the target user's profile
        });

    } catch (err) {
        console.error("Error following/unfollowing user:", err);
        req.flash('error', 'Something went wrong with following/unfollowing.');
        res.status(500).redirect('/home'); // Redirect to home on error
    }
});

module.exports = router;
