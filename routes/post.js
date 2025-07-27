const express = require('express');
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const router = express.Router();

// File storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));  // <== points to existing uploads folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));  // unique filename
  }
});

const upload = multer({ storage: storage });

// GET create post page
router.get('/create', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.render('create');
});

// POST upload
router.post('/create', upload.single('image'), async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  const post = new Post({
    user: req.user._id,
    image: req.file.filename,
    caption: req.body.caption
  });
  await post.save();
  res.redirect('/home');
});

module.exports = router;
