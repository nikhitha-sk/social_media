const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');

// GET Home Page - show all posts sorted by latest
router.get('/home', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('userId', 'nickname email profilePicture') // get user info
      .sort({ createdAt: -1 }); // latest first

    res.render('home', { user: req.user, posts }); // pass posts to home.ejs
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching posts');
  }
});
