const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// GET Pages

router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/home');
  } else {
    res.redirect('/login');
  }
});


router.get('/login', (req, res) => res.render('login'));
router.get('/signup', (req, res) => res.render('signup'));
router.get('/nickname', isLoggedIn, (req, res) => {
  if (req.user.nickname) return res.redirect('/home');
  res.render('nickname');
});
router.get('/home', isLoggedIn, (req, res) => {
  res.render('home', { user: req.user });
});
router.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// POST Routes
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed });
  res.redirect('/login');
});

router.post('/login',
  passport.authenticate('local', {
    successRedirect: '/nickname',
    failureRedirect: '/login'
  })
);

router.post('/nickname', isLoggedIn, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { nickname: req.body.nickname });
  res.redirect('/home');
});

// Google Auth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  (req, res) => res.redirect('/nickname')
);

module.exports = router;
