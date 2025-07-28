const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('../models/User');
// const Post = require('../models/Post'); // Post model is not used in auth routes, can be removed if not needed elsewhere in this file

const router = express.Router();

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Root route - redirects based on authentication status
router.get('/', (req, res) => {
    if (req.isAuthenticated()) res.redirect('/home');
    else res.redirect('/login');
});

// Login page
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Signup page
router.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

// Nickname page - ensure user sets nickname after login/signup
router.get('/nickname', isLoggedIn, (req, res) => {
    if (req.user && req.user.nickname) return res.redirect('/home');
    res.render('nickname');
});

// IMPORTANT: The /home route that was here previously has been REMOVED.
// It should now ONLY exist in routes/index.js to avoid conflicts.

// Logout
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect('/login');
    });
});

// Signup logic
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
        return res.render('signup', { error: 'User already exists. Please login instead.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email, password: hashed });

    res.redirect('/login');
});

// Login logic
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            return res.render('login', { error: info.message });
        }

        req.logIn(user, err => {
            if (err) return next(err);
            return res.redirect('/nickname');
        });
    })(req, res, next);
});

// Nickname POST
router.post('/nickname', isLoggedIn, async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    await User.findByIdAndUpdate(req.user._id, { nickname: req.body.nickname });
    const updatedUser = await User.findById(req.user._id);
    req.login(updatedUser, (err) => {
        if (err) return next(err);
        res.redirect('/home');
    });
});

// Google Auth initiation
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Auth callback
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => res.redirect('/nickname')
);

module.exports = router;
