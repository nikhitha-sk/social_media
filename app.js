const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();
require('./passportConfig');

const app = express();

// DB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB connection error:", err)); // Added error handling for clarity

// Middleware
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.json()); // Add this if you're also sending JSON data in requests
app.use(express.static('public')); // Serve static files from 'public' directory
app.set('view engine', 'ejs'); // Set EJS as the view engine

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

// Passport middleware (MUST come after session middleware)
app.use(passport.initialize());
app.use(passport.session());

// --- ROUTES ---
// Import your route files
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index'); // <--- NEW: Import index routes
const userRoutes = require('./routes/user'); // Assuming this handles profile, settings etc.
const postRoutes = require('./routes/post'); // Assuming this handles post creation, deletion etc.

// Use your route files
// Order matters: authRoutes often comes first for login/signup/logout handling
app.use('/', authRoutes);
app.use('/', indexRoutes); // <--- NEW: Use index routes (contains /home)
app.use('/', userRoutes); // Use user routes
app.use('/posts', postRoutes); // Use post-specific routes under /posts prefix

// This line is redundant if 'public' is already handled by app.use(express.static('public'));
// app.use(express.static(path.join(__dirname, 'public'))); 

// Start server
const PORT = process.env.PORT || 3000; // Use a default port if not specified in .env
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
