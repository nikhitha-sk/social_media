const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env file

const fetch = require('node-fetch'); // This should work with node-fetch@2

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
}

// Function for exponential backoff
const exponentialBackoff = async (fn, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            // Only log retries, don't throw immediately
            console.warn(`Retrying after ${delay}ms due to error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Double the delay for the next retry
        }
    }
    throw new Error('Max retries reached, operation failed.'); // Re-throw after all retries
};

// GET route to render the chatbot UI
router.get('/', isAuthenticated, (req, res) => {
    // Initialize chat history in session if it doesn't exist
    if (!req.session.chatHistory) {
        req.session.chatHistory = [];
    }
    res.render('chatbot', { user: req.user, chatHistory: req.session.chatHistory });
});

// POST route to send message to chatbot and get response from LLM
router.post('/send-message', isAuthenticated, async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage || userMessage.trim() === '') {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    // Initialize chat history if it's not already
    if (!req.session.chatHistory) {
        req.session.chatHistory = [];
    }

    // Add user message to history
    req.session.chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

    try {
        const chatHistory = req.session.chatHistory; // Full history for context

        const payload = {
            contents: chatHistory,
        };

        // FIXED: Get API Key from environment variable
        const apiKey = process.env.GEMINI_API_KEY; 

        if (!apiKey) {
            console.error("GEMINI_API_KEY is not set in environment variables.");
            req.session.chatHistory.push({ role: "model", parts: [{ text: "Chatbot setup error: API Key is missing." }] });
            return res.status(500).json({ error: 'Chatbot not configured. API Key missing.' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const response = await exponentialBackoff(async () => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`API call failed with status ${res.status}: ${errorBody}`);
            }
            return res.json();
        });

        const result = response;
        let botResponseText = 'Sorry, I could not generate a response.';

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            botResponseText = result.candidates[0].content.parts[0].text;
        }

        // Add bot response to history
        req.session.chatHistory.push({ role: "model", parts: [{ text: botResponseText }] });

        res.json({ response: botResponseText });

    } catch (error) {
        console.error('Error interacting with Gemini API:', error);
        // Add a generic error message to chat history if API call fails
        req.session.chatHistory.push({ role: "model", parts: [{ text: "I'm sorry, I'm having trouble connecting right now. Please try again later." }] });
        res.status(500).json({ error: 'Failed to get response from chatbot.' });
    }
});

module.exports = router;
