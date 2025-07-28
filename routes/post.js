const express = require('express');
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const router = express.Router();
const fs = require('fs');

// Middleware to check if user is authenticated (assuming this is defined elsewhere)
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
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
        return res.redirect('/create');
    }

    try {
        const post = new Post({
            userId: req.user._id,
            image: req.file.filename,
            caption: req.body.caption
        });
        await post.save();
        res.redirect('/home');
    } catch (err) {
        console.error("Error creating post:", err);
        res.status(500).send("Failed to create post.");
    }
});

// POST route to handle post deletion
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).send("Post not found.");
        }

        if (!post.userId.equals(req.user._id)) {
            return res.status(403).send("You are not authorized to delete this post.");
        }

        await Post.findByIdAndDelete(postId);

        const imagePath = path.join(__dirname, '../public/uploads', post.image);
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error("Error deleting image file:", err);
            }
        });

        res.redirect('/home');
    } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).send("Something went wrong while deleting the post.");
    }
});

//  POST route to handle liking/unliking a post
router.post('/like/:id', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).send("Post not found.");
        }

        // Check if the user has already liked the post
        const likedIndex = post.likes.findIndex(like => like.equals(userId));

        if (likedIndex === -1) {
            // User has not liked it, so add their like
            post.likes.push(userId);
        } else {
            // User has liked it, so remove their like (unlike)
            post.likes.splice(likedIndex, 1);
        }

        await post.save();
        res.redirect('/home'); // Redirect back to home to see the updated like count/status
    } catch (err) {
        console.error("Error liking/unliking post:", err);
        res.status(500).send("Something went wrong with liking/unliking the post.");
    }
});

// NEW FEATURE: POST route to handle adding a comment to a post
router.post('/comment/:id', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const commentText = req.body.commentText; // Assuming input field name is 'commentText'

        if (!commentText || commentText.trim() === '') {
            return res.status(400).send("Comment cannot be empty.");
        }

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).send("Post not found.");
        }

        // Add the new comment to the post's comments array
        post.comments.push({
            userId: userId,
            text: commentText.trim()
        });

        await post.save();
        res.redirect('/home'); // Redirect back to home to see the new comment
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).send("Something went wrong with adding the comment.");
    }
});

module.exports = router;
