const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  password: String, // only for local strategy
  googleId: String,
  nickname: String,
  profilePic: { type: String, default: '/default_profile.jpg'}
});

module.exports = mongoose.model('User', userSchema);
