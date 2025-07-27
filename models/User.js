const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  password: String, // only for local strategy
  googleId: String,
  nickname: String
});

module.exports = mongoose.model('User', userSchema);
