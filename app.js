const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const flash = require('connect-flash');
const http = require('http');
require('dotenv').config();
require('./passportConfig');

const app = express();
const server = http.createServer(app);

// DB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB connection error:", err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Ensure this is present for JSON body parsing
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session middleware
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
});
app.use(sessionMiddleware);

// Passport middleware (MUST come after session middleware)
app.use(passport.initialize());
app.use(passport.session());

// Flash messages middleware (MUST come after session middleware)
app.use(flash());

// Make flash messages available in all templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    next();
});

// --- Socket.IO Setup ---
const configureSocketIO = require('./socketHandlers');
configureSocketIO(server, sessionMiddleware);

// --- ROUTES ---
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const userRoutes = require('./routes/user');
const postRoutes = require('./routes/post');
const notificationsRoutes = require('./routes/notifications');
const messagesRoutes = require('./routes/messages');
const chatbotRoutes = require('./routes/chatbot'); // <--- NEW: Import chatbot routes

app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/', userRoutes);
app.use('/posts', postRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/messages', messagesRoutes);
app.use('/chatbot', chatbotRoutes); // <--- NEW: Use chatbot routes

// Start server (using http.createServer instance)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
