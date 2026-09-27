# Social Media App

A simple social media project built with **Node.js, Express, EJS, MongoDB, Passport, and Socket.IO**.

This project supports:
- login/signup (email + Google)
- profile management
- follow/unfollow and private account follow requests
- post creation, likes, comments
- notifications
- real-time direct messages
- AI chatbot page (Gemini API)

---

## 1) Project Structure

```text
social_media/
├── app.js                  # App entry point, middleware, DB, route mounting
├── passportConfig.js       # Local + Google auth strategy
├── socketHandlers.js       # Socket.IO real-time DM logic
├── models/                 # MongoDB schemas
├── routes/                 # Route handlers (auth, home, users, posts, etc.)
├── views/                  # EJS pages
├── public/                 # Static files (CSS, uploads, default images)
└── README.md
```

---

## 2) Architecture (Simple View)

- **Pattern:** Monolithic MVC-style app
  - **Models:** `models/*.js` (MongoDB with Mongoose)
  - **Views:** `views/*.ejs` (server-rendered UI)
  - **Controllers/Routes:** `routes/*.js`
- **Authentication:** Passport (local + Google OAuth)
- **Session Store:** MongoDB (`connect-mongo`)
- **Real-time:** Socket.IO for direct messaging + unread DM updates

---

## 3) Core Functionalities

1. **Authentication**
   - Email/password signup/login
   - Google login
   - Nickname setup after login

2. **Feed**
   - Home feed shows posts from followed users + own posts
   - Displays unread notification count and unread DM count

3. **Profile**
   - Update nickname
   - Update profile picture
   - Toggle private/public account

4. **Social Graph**
   - Follow/unfollow users
   - Private accounts require follow request
   - Accept/decline follow requests

5. **Posts**
   - Create post with image upload
   - Delete own post
   - Like/unlike
   - Comment

6. **Notifications**
   - Types: like, comment, followRequest
   - Mark specific/all notifications as read

7. **Direct Messages**
   - Inbox with conversation list
   - One-to-one chat
   - Privacy rule: if either account is private, both must follow each other to chat
   - Unread DM count tracking

8. **Chatbot**
   - Chat page using Gemini API
   - Session-based chat history

---

## 4) Data Models (Important for Interviews)

- **User**
  - email, nickname, profilePic
  - followers[], following[]
  - isPrivate
  - dm_unread_count

- **Post**
  - userId, image, caption
  - likes[]
  - comments[] (`userId`, `text`, `createdAt`)

- **Message**
  - sender, recipient, content, read, createdAt

- **Notification**
  - recipientId, senderId, postId (optional), followRequestId (optional)
  - type: `like | comment | followRequest`
  - commentText (optional), read, createdAt

- **FollowRequest**
  - senderId, recipientId, createdAt
  - unique index on (senderId, recipientId)

---

## 5) Routes / APIs

### Auth (`routes/auth.js`)
- `GET /` -> redirect to `/home` or `/login`
- `GET /login`, `GET /signup`, `GET /nickname`, `GET /logout`
- `POST /signup`, `POST /login`, `POST /nickname`
- `GET /auth/google`
- `GET /auth/google/callback`

### Home (`routes/index.js`)
- `GET /home`

### User/Profile (`routes/user.js`)
- `GET /profile`
- `GET /profile/:id`
- `POST /profile/update-nickname`
- `POST /profile/update-profile-pic`
- `POST /profile/toggle-privacy`
- `POST /user/follow/:id`
- `POST /user/follow-request/accept/:requestId`
- `POST /user/follow-request/decline/:requestId`

### Posts (`routes/post.js`)
- `GET /posts/create`
- `POST /posts/create`
- `POST /posts/delete/:id`
- `POST /posts/like/:id`
- `POST /posts/comment/:id`

### Notifications (`routes/notifications.js`)
- `GET /notifications` (JSON list)
- `POST /notifications/mark-read`

### Messages (`routes/messages.js`)
- `GET /messages` (inbox page)
- `GET /messages/:otherUserId` (chat page)
- `GET /messages/total-unread` (JSON unread count)

### Chatbot (`routes/chatbot.js`)
- `GET /chatbot`
- `POST /chatbot/send-message`

---

## 6) Socket.IO Events (Real-time DM)

- `join_chat(otherUserId)`  
  Joins a deterministic room: `chat_<smallUserId>_<largeUserId>`, marks chat messages as read.

- `send_message({ recipientId, content })`  
  Saves message, emits `receive_message`, updates unread DM badge.

- Server emits:
  - `receive_message`
  - `dm_unread_count_updated`
  - `dm_error`

---

## 7) Environment Variables

Create `.env` with:

```env
MONGO_URI=
SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
GEMINI_API_KEY=
CLIENT_URL=http://localhost:3000
PORT=3000
```

---

## 8) Run Locally

```bash
npm install
npm run dev
```

or

```bash
npm start
```

---

## 9) Interview Quick Notes (Remember These)

- The app is a **server-rendered monolith** using Express + EJS.
- Auth uses **Passport + sessions** (not JWT).
- Feed is generated from `following + self`.
- Private account logic is handled via **FollowRequest** and follow checks.
- Notifications are stored in DB and read/unread is tracked.
- DMs are real-time with **Socket.IO**, but also persisted in MongoDB.
- DM unread total is optimized with `User.dm_unread_count`.
- Chatbot integrates external LLM API with retry (exponential backoff).

---

## 10) Limitations / Improvements

- Add route-level validation and stronger input sanitization.
- Add tests (unit/integration/e2e).
- Add pagination for posts, inbox, and notifications.
- Improve notification type design (separate `follow` vs `followRequestAccepted`).
- Move repeated auth middleware into shared utility.
