const express = require('express');
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const router = express.Router();

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
        // Using req.user._id in filename for better organization/debugging
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
        // Redirect back or show an error to the user
        return res.redirect('/create');
    }

    try {
        const post = new Post({
            userId: req.user._id, // Corrected field name
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

        // 1. Check if the post exists
        if (!post) {
            return res.status(404).send("Post not found.");
        }

        // 2. Authorization Check: Ensure the logged-in user is the owner of the post
        // Use .equals() for Mongoose ObjectIds comparison
        if (!post.userId.equals(req.user._id)) {
            return res.status(403).send("You are not authorized to delete this post.");
        }

        // 3. If authorized, delete the post
        await Post.findByIdAndDelete(postId);

        // Optional: Delete the associated image file from the server
        const imagePath = path.join(__dirname, '../public/uploads', post.image);
        const fs = require('fs'); // Node.js file system module
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error("Error deleting image file:", err);
                // Continue even if image deletion fails, as the post is already removed from DB
            } else {
                console.log("Image file deleted successfully:", imagePath);
            }
        });

        res.redirect('/home'); // Redirect back to home page after deletion
    } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).send("Something went wrong while deleting the post.");
    }
});

module.exports = router;
