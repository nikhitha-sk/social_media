const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');
const mongoose = require('mongoose');

// Utility function to get a consistent chat room ID for two users
// Ensures A-B and B-A result in the same room ID
function getChatRoomId(userId1, userId2) {
    const ids = [userId1.toString(), userId2.toString()].sort();
    return `chat_${ids[0]}_${ids[1]}`;
}

module.exports = (server, sessionMiddleware) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000", // Adjust as per your frontend URL
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Use the same session middleware for Socket.IO
    // This allows access to req.session and req.user within Socket.IO handlers
    io.engine.use(sessionMiddleware);

    io.on('connection', async (socket) => {
        // Access user from session (set by Passport.js)
        const user = socket.request.session.passport ? socket.request.session.passport.user : null;

        if (!user) {
            console.log('Socket.IO: Unauthenticated connection attempt, disconnecting.');
            socket.disconnect(true);
            return;
        }

        console.log(`Socket.IO: User ${user} connected. Socket ID: ${socket.id}`);

        // Join a personal room for direct notifications
        socket.join(user.toString());

        socket.on('join_chat', async (otherUserId) => {
            const currentUserId = user; // Logged-in user's ID from session
            
            if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
                console.log(`Socket.IO: Invalid otherUserId provided: ${otherUserId}`);
                return;
            }

            // Leave any previously joined chat rooms to avoid receiving messages from old chats
            socket.rooms.forEach(room => {
                if (room.startsWith('chat_')) {
                    socket.leave(room);
                }
            });

            const roomId = getChatRoomId(currentUserId, otherUserId);
            socket.join(roomId);
            console.log(`Socket.IO: User ${currentUserId} joined chat room ${roomId} with ${otherUserId}`);

            // Mark messages in this specific chat as read when user joins
            await Message.updateMany(
                { sender: otherUserId, recipient: currentUserId, read: false },
                { $set: { read: true } }
            );

            // Decrement recipient's total unread count
            const currentUserDoc = await User.findById(currentUserId);
            if (currentUserDoc) {
                const messagesMarkedReadCount = await Message.countDocuments({
                    sender: otherUserId,
                    recipient: currentUserId,
                    read: true // Count messages that *were* unread and are now read
                });
                if (currentUserDoc.dm_unread_count >= messagesMarkedReadCount) {
                     currentUserDoc.dm_unread_count -= messagesMarkedReadCount;
                } else {
                    currentUserDoc.dm_unread_count = 0; // Prevent negative count
                }
                await currentUserDoc.save();
            }

            // Notify the current user (if they are on the homepage) to update their DM badge
            io.to(currentUserId.toString()).emit('dm_unread_count_updated', currentUserDoc ? currentUserDoc.dm_unread_count : 0);
        });

        socket.on('send_message', async ({ recipientId, content }) => {
            const senderId = user; // Logged-in user's ID from session

            if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                console.log(`Socket.IO: Invalid recipientId provided: ${recipientId}`);
                return;
            }

            if (!content || content.trim() === '') {
                console.log(`Socket.IO: Empty message content from ${senderId} to ${recipientId}`);
                return;
            }

            try {
                const senderUser = await User.findById(senderId);
                const recipientUser = await User.findById(recipientId);

                if (!senderUser || !recipientUser) {
                    console.log(`Socket.IO: Sender or Recipient user not found.`);
                    return;
                }

                // --- DM Privacy Check ---
                // If either account is private, they must follow each other to DM
                const senderFollowsRecipient = senderUser.following.some(id => id.equals(recipientId));
                const recipientFollowsSender = recipientUser.following.some(id => id.equals(senderId));

                if (senderUser.isPrivate || recipientUser.isPrivate) {
                    if (!senderFollowsRecipient || !recipientFollowsSender) {
                        console.log(`Socket.IO: DM blocked between private accounts. Sender: ${senderId}, Recipient: ${recipientId}`);
                        socket.emit('dm_error', 'Cannot send message: You must both follow each other to chat.');
                        return;
                    }
                }

                const newMessage = await Message.create({
                    sender: senderId,
                    recipient: recipientId,
                    content: content.trim(),
                    read: false // Mark as unread initially
                });

                // Update recipient's total unread DM count
                recipientUser.dm_unread_count = (recipientUser.dm_unread_count || 0) + 1;
                await recipientUser.save();

                const roomId = getChatRoomId(senderId, recipientId);

                // Emit the message to the chat room
                io.to(roomId).emit('receive_message', {
                    _id: newMessage._id,
                    sender: {
                        _id: senderUser._id,
                        nickname: senderUser.nickname,
                        profilePic: senderUser.profilePic
                    },
                    recipient: {
                        _id: recipientUser._id,
                        nickname: recipientUser.nickname,
                        profilePic: recipientUser.profilePic
                    },
                    content: newMessage.content,
                    createdAt: newMessage.createdAt,
                    read: newMessage.read
                });

                console.log(`Socket.IO: Message sent from ${senderId} to ${recipientId} in room ${roomId}`);

                // Notify recipient's personal room to update their DM badge
                io.to(recipientId.toString()).emit('dm_unread_count_updated', recipientUser.dm_unread_count);

            } catch (error) {
                console.error('Socket.IO: Error sending message:', error);
                socket.emit('dm_error', 'Failed to send message.');
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket.IO: User ${user} disconnected. Socket ID: ${socket.id}`);
        });
    });
};
