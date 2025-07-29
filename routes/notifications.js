const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User'); // Needed for populating sender details

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// GET route to fetch all notifications for the logged-in user
// This route is primarily for AJAX calls or a dedicated notifications page
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user._id })
                                                .sort({ createdAt: -1 })
                                                .populate('senderId', 'nickname profilePic email') // Populate sender details
                                                .populate('postId', 'image caption'); // Populate post details

        res.json(notifications); // Send notifications as JSON
    } catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ message: "Error fetching notifications." });
    }
});

// POST route to mark notifications as read
router.post('/mark-read', isAuthenticated, async (req, res) => {
    try {
        const notificationIds = req.body.notificationIds; // Array of IDs to mark as read

        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
            // If no specific IDs, mark all unread notifications for the user as read
            await Notification.updateMany(
                { recipientId: req.user._id, read: false },
                { $set: { read: true } }
            );
            return res.json({ message: 'All unread notifications marked as read.' });
        }

        // Mark specific notifications as read
        await Notification.updateMany(
            { _id: { $in: notificationIds }, recipientId: req.user._id }, // Ensure user owns the notifications
            { $set: { read: true } }
        );
        res.json({ message: 'Selected notifications marked as read.' });
    } catch (err) {
        console.error("Error marking notifications as read:", err);
        res.status(500).json({ message: "Error marking notifications as read." });
    }
});

module.exports = router;
