#!/usr/bin/env node
// y-webrtc Signaling Server for Render deployment
const PORT = process.env.PORT || 4444;
process.env.PORT = PORT.toString();

console.log(`Starting y-webrtc signaling server on port ${PORT}...`);
require('y-webrtc/bin/server.js');
