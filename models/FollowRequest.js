const mongoose = require('mongoose');

const followRequestSchema = new mongoose.Schema({
    senderId: { // The user who sent the follow request
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipientId: { // The user who received the follow request
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure that a user can only send one pending follow request to another user
followRequestSchema.index({ senderId: 1, recipientId: 1 }, { unique: true });

module.exports = mongoose.model('FollowRequest', followRequestSchema);
