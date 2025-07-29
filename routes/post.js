const express = require('express');
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const Notification = require('../models/Notification'); // <--- NEW: Import Notification model
const router = express.Router();
const fs = require('fs');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// File storage configuration for Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, req.user._id + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Configure Multer to use the defined storage
const upload = multer({ storage: storage });

// GET route to display the create post page
router.get('/create', isAuthenticated, (req, res) => {
    res.render('create');
});

// POST route to handle post creation and image upload
router.post('/create', isAuthenticated, upload.single('image'), async (req, res) => {
    if (!req.file) {
        console.error("No image file uploaded for the post.");
        req.flash('error', 'Please upload an image for your post.');
        return res.redirect('/create');
    }

    try {
        const post = new Post({
            userId: req.user._id,
            image: req.file.filename,
            caption: req.body.caption
        });
        await post.save();
        req.flash('success', 'Post created successfully!');
        res.redirect('/home');
    } catch (err) {
        console.error("Error creating post:", err);
        req.flash('error', 'Failed to create post.');
        res.status(500).redirect('/create');
    }
});

// POST route to handle post deletion
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (!post) {
            req.flash('error', 'Post not found.');
            return res.status(404).redirect('/home');
        }

        if (!post.userId.equals(req.user._id)) {
            req.flash('error', 'You are not authorized to delete this post.');
            return res.status(403).redirect('/home');
        }

        await Post.findByIdAndDelete(postId);

        // Optional: Delete the associated image file from the server
        const imagePath = path.join(__dirname, '../public/uploads', post.image);
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error("Error deleting image file:", err);
            }
        });

        // Delete associated notifications for this post
        await Notification.deleteMany({ postId: postId });

        req.flash('success', 'Post deleted successfully!');
        res.redirect('/home');
    } catch (err) {
        console.error("Error deleting post:", err);
        req.flash('error', 'Something went wrong while deleting the post.');
        res.status(500).redirect('/home');
    }
});

// POST route to handle liking/unliking a post
router.post('/like/:id', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        const post = await Post.findById(postId);

        if (!post) {
            req.flash('error', 'Post not found.');
            return res.status(404).redirect('/home');
        }

        const likedIndex = post.likes.findIndex(like => like.equals(userId));

        if (likedIndex === -1) {
            // User has not liked it, so add their like
            post.likes.push(userId);

            // NEW: Create a notification if the liker is not the post owner
            if (!post.userId.equals(userId)) {
                const existingNotification = await Notification.findOne({
                    recipientId: post.userId,
                    senderId: userId,
                    postId: postId,
                    type: 'like',
                    read: false // Only check for unread notifications
                });

                if (!existingNotification) {
                    await Notification.create({
                        recipientId: post.userId,
                        senderId: userId,
                        postId: postId,
                        type: 'like'
                    });
                }
            }
        } else {
            // User has liked it, so remove their like (unlike)
            post.likes.splice(likedIndex, 1);

            // NEW: If unliked, delete any unread like notification from this sender for this post
            await Notification.deleteOne({
                recipientId: post.userId,
                senderId: userId,
                postId: postId,
                type: 'like',
                read: false
            });
        }

        await post.save();
        res.redirect('/home');
    } catch (err) {
        console.error("Error liking/unliking post:", err);
        req.flash('error', 'Something went wrong with liking/unliking the post.');
        res.status(500).redirect('/home');
    }
});

// POST route to handle adding a comment to a post
router.post('/comment/:id', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const commentText = req.body.commentText;

        if (!commentText || commentText.trim() === '') {
            req.flash('error', 'Comment cannot be empty.');
            return res.status(400).redirect('/home');
        }

        const post = await Post.findById(postId);

        if (!post) {
            req.flash('error', 'Post not found.');
            return res.status(404).redirect('/home');
        }

        post.comments.push({
            userId: userId,
            text: commentText.trim()
        });

        // NEW: Create a notification if the commenter is not the post owner
        if (!post.userId.equals(userId)) {
            await Notification.create({
                recipientId: post.userId,
                senderId: userId,
                postId: postId,
                type: 'comment',
                commentText: commentText.trim().substring(0, 50) + (commentText.trim().length > 50 ? '...' : '') // Store a preview
            });
        }

        await post.save();
        res.redirect('/home');
    } catch (err) {
        console.error("Error adding comment:", err);
        req.flash('error', 'Something went wrong with adding the comment.');
        res.status(500).redirect('/home');
    }
});

module.exports = router;
