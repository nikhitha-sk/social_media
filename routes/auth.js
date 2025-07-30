const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    req.flash('error', 'Please log in to view this page.'); // Added flash message
    res.redirect('/login');
}

// Root route - redirects based on authentication status
router.get('/', (req, res) => {
    if (req.isAuthenticated()) res.redirect('/home');
    else res.redirect('/login');
});

// Login page
router.get('/login', (req, res) => {
    res.render('login', { error: req.flash('error') }); // Pass flash error messages
});

// Signup page
router.get('/signup', (req, res) => {
    res.render('signup', { error: req.flash('error') }); // Pass flash error messages
});

// Nickname page - ensure user sets nickname after login/signup
router.get('/nickname', isLoggedIn, (req, res) => {
    if (req.user && req.user.nickname) return res.redirect('/home');
    res.render('nickname');
});

// Logout
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.flash('success', 'You have been logged out.'); // Optional: success message on logout
        res.redirect('/login');
    });
});

// Signup logic
router.post('/signup', async (req, res, next) => { // Added 'next' for req.logIn callback
    const { email, password } = req.body;

    try {
        const existing = await User.findOne({ email });
        if (existing) {
            req.flash('error', 'User already exists. Please login instead.'); // Use flash for error
            return res.redirect('/signup'); // Redirect back to signup page
        }

        const hashed = await bcrypt.hash(password, 10);
        const newUser = await User.create({ email, password: hashed }); // Store the created user

        // NEW: Automatically log in the newly created user
        req.logIn(newUser, err => {
            if (err) {
                console.error("Error logging in after signup:", err);
                req.flash('error', 'Failed to log in after signup. Please try logging in manually.');
                return next(err); // Pass error to Express error handler
            }
            req.flash('success', 'Account created successfully! Please choose a nickname.');
            res.redirect('/nickname'); // Redirect to nickname page after successful login
        });

    } catch (err) {
        console.error("Error during signup:", err);
        req.flash('error', 'An error occurred during signup. Please try again.');
        res.status(500).redirect('/signup'); // Redirect back to signup on server error
    }
});

// Login logic
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            req.flash('error', info.message); // Use flash for error
            return res.redirect('/login'); // Redirect back to login page
        }

        req.logIn(user, err => {
            if (err) return next(err);
            req.flash('success', 'Logged in successfully!'); // Optional: success message on login
            return res.redirect('/nickname');
        });
    })(req, res, next);
});

// Nickname POST
router.post('/nickname', isLoggedIn, async (req, res, next) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to set a nickname.');
        return res.redirect('/login');
    }
    try {
        await User.findByIdAndUpdate(req.user._id, { nickname: req.body.nickname });
        const updatedUser = await User.findById(req.user._id);
        req.login(updatedUser, (err) => {
            if (err) return next(err);
            req.flash('success', 'Nickname saved!');
            res.redirect('/home');
        });
    } catch (err) {
        console.error("Error setting nickname:", err);
        req.flash('error', 'Failed to save nickname.');
        res.status(500).redirect('/nickname');
    }
});

// Google Auth initiation
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Auth callback
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }), // Added failureFlash
    (req, res) => {
        req.flash('success', 'Logged in with Google successfully!');
        res.redirect('/nickname');
    }
);

module.exports = router;
