const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const userRoutes = require('./routes/user');
const postRoutes = require('./routes/post');
const path = require('path');
require('dotenv').config();
require('./passportConfig');

const app = express();

// DB connection
mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB Connected"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

app.use('/', userRoutes);

app.use('/posts', postRoutes);
app.use(express.static(path.join(__dirname, 'public')));


// Start server
app.listen(process.env.PORT, () => {
  console.log(`Server started on port ${process.env.PORT}`);
});
