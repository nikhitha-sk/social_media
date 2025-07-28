const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const postSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // Ensure a post always has a creator
    },
    image: String,
    caption: String,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    likes: [{ // Array of User IDs who liked the post
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [commentSchema] // Array of comments, using the defined commentSchema
});

module.exports = mongoose.model('Post', postSchema);
