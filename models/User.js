const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  password: String, // only for local strategy
  googleId: String,
  nickname: String,
  profilePic: { type: String, default: '/default-profile.png'}
});

module.exports = mongoose.model('User', userSchema);
