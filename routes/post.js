const express = require('express');
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const router = express.Router();
const fs = require('fs'); // Make sure fs is required for file deletion

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

// NEW FEATURE: POST route to handle post deletion
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    // --- DIAGNOSTIC LOG: Check if this route handler is reached ---
    console.log(`Attempting to delete post with ID: ${req.params.id}`);
    console.log(`Logged-in user ID: ${req.user._id}`);
    // -----------------------------------------------------------

    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (!post) {
            console.log(`Post with ID ${postId} not found.`); // Diagnostic
            return res.status(404).send("Post not found.");
        }

        if (!post.userId.equals(req.user._id)) {
            console.log(`User ${req.user._id} not authorized to delete post ${postId}. Owner: ${post.userId}`); // Diagnostic
            return res.status(403).send("You are not authorized to delete this post.");
        }

        await Post.findByIdAndDelete(postId);
        console.log(`Post ${postId} deleted from DB.`); // Diagnostic

        // Optional: Delete the associated image file from the server
        const imagePath = path.join(__dirname, '../public/uploads', post.image);
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error("Error deleting image file:", err);
            } else {
                console.log("Image file deleted successfully:", imagePath);
            }
        });

        res.redirect('/home');
    } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).send("Something went wrong while deleting the post.");
    }
});

module.exports = router;
