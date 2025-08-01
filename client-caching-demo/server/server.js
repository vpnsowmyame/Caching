const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3001;

// Enable CORS for all origins (for local development)
app.use(cors());

// Serve static files (like a logo)
app.use('/static', express.static(path.join(__dirname, 'static')));

// Endpoint to serve a cached image (simulate a logo or icon)
app.get('/cached-logo.png', (req, res) => {
    // Set Cache-Control for 1 hour (3600 seconds)
    res.set('Cache-Control', 'public, max-age=3600, immutable');
    res.sendFile(path.join(__dirname, 'static', 'logo.png')); // Make sure you have a logo.png in 'server/static'
});

// Simple API endpoint
let apiData = { message: "Hello from API!", timestamp: new Date().toISOString() };
let etag = `"${Math.random().toString(36).substring(7)}"`; // Initial ETag

app.get('/api/data', (req, res) => {
    console.log('API Request received');

    // Simulate a changing resource every 10 seconds or so
    if (Math.random() < 0.2) { // 20% chance to update data and ETag
        apiData = { message: "Updated Hello from API!", timestamp: new Date().toISOString() };
        etag = `"${Math.random().toString(36).substring(7)}"`;
        console.log('API data updated.');
    }

    const ifNoneMatch = req.headers['if-none-match'];

    if (ifNoneMatch === etag) {
        console.log('304 Not Modified for /api/data');
        return res.status(304).send();
    }

    res.set('Cache-Control', 'public, max-age=10'); // Revalidate every 10 seconds
    res.set('ETag', etag);
    res.json(apiData);
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}/api/data in your browser to test.`);
});

// Create a 'static' directory and put an image named 'logo.png' inside it
// Example: server/static/logo.png