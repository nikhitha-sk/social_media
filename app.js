const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

mongoose.connect('mongodb+srv://admin:admin@cluster0.nbpigx8.mongodb.net/social_media?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  if (req.cookies.username) {
    User.findOne({ username: req.cookies.username })
      .then(user => {
        if (user) {
          req.user = user;
          next();
        } else {
          res.redirect('/auth');
        }
      });
  } else {
    res.redirect('/auth');
  }
}

// Render merged login/signup page
app.get('/auth', (req, res) => {
  res.render('auth', { error: null });
});

// Signup handler
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.render('auth', { error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.cookie('username', username);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('auth', { error: 'Signup failed. Try again.' });
  }
});

// Login handler
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render('auth', { error: 'User not found' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('auth', { error: 'Invalid credentials' });
    }
    res.cookie('username', username);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('auth', { error: 'Login failed. Try again.' });
  }
});

// Home page - only if logged in
app.get('/', isLoggedIn, (req, res) => {
  res.render('home', { username: req.user.username });
});

// Logout route
app.get('/logout', (req, res) => {
  res.clearCookie('username');
  res.redirect('/auth');
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
