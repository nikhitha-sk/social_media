const express = require('express');
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const router = express.Router();

// File storage configuration for Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure this path is correct and accessible for file uploads
        cb(null, path.join(__dirname, '../public/uploads')); 
    },
    filename: function (req, file, cb) {
        // Create a unique filename using current timestamp and original extension
        cb(null, req.user._id + '-' + Date.now() + path.extname(file.originalname)); 
    }
});

// Configure Multer to use the defined storage
const upload = multer({ storage: storage });

// GET route to display the create post page
router.get('/create', (req, res) => {
    // Ensure user is authenticated before allowing access to create post page
    if (!req.isAuthenticated()) return res.redirect('/login');
    res.render('create');
});

// POST route to handle post creation and image upload
router.post('/create', upload.single('image'), async (req, res) => {
    // Ensure user is authenticated before processing the post creation
    if (!req.isAuthenticated()) return res.redirect('/login');

    // Check if an image file was uploaded
    if (!req.file) {
        // Handle case where no image was uploaded (e.g., show an error message)
        console.error("No image file uploaded for the post.");
        return res.redirect('/create'); // Or render 'create' with an error message
    }

    try {
        // Create a new Post document
        const post = new Post({
            // CORRECTED: Use 'userId' to match the schema
            userId: req.user._id, 
            image: req.file.filename, // Store the filename of the uploaded image
            caption: req.body.caption // Store the caption from the form
        });

        // Save the new post to the database
        await post.save();

        // Redirect to the home page after successful post creation
        res.redirect('/home');
    } catch (err) {
        console.error("Error creating post:", err);
        res.status(500).send("Failed to create post.");
    }
});

module.exports = router;
