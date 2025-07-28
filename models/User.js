const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: String,
    password: String, // only for local strategy
    googleId: String,
    nickname: String,
    profilePic: { type: String, default: '/default_profile.jpg'},
    followers: [{ // Array of User IDs who follow this user
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{ // Array of User IDs this user is following
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});

module.exports = mongoose.model('User', userSchema);
