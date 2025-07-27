const express = require('express');
const router = express.Router();
const upload = require('../utils/uploadMiddleware');
const User = require('../models/User');

// Ensure logged in middleware
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Profile page
router.get('/profile', ensureAuth, (req, res) => {
  res.render('profile', { user: req.user });
});

// Update profile picture
router.post('/profile/upload', ensureAuth, upload.single('profilePic'), async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    profilePic: `/uploads/${req.file.filename}`
  });
  res.redirect('/profile');
});

module.exports = router;
