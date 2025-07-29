const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientId: { // The user who should receive the notification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderId: { // The user who performed the action (liked/commented/sent follow request)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postId: { // Optional: The post involved (for like/comment)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    followRequestId: { // <--- NEW: Optional: The follow request involved (for followRequest)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FollowRequest'
    },
    type: { // 'like', 'comment', or 'followRequest'
        type: String,
        enum: ['like', 'comment', 'followRequest'], // <--- NEW: Added 'followRequest'
        required: true
    },
    commentText: { // Optional: if type is 'comment', store the comment text preview
        type: String
    },
    read: { // Whether the notification has been read by the recipient
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
