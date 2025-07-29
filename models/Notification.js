const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientId: { // The user who owns the post and receives the notification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderId: { // The user who performed the action (liked/commented)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postId: { // The post involved in the notification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    type: { // 'like' or 'comment'
        type: String,
        enum: ['like', 'comment'],
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
