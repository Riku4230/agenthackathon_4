import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleClientConnection } from './websocket/client-handler.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  console.error('Error: GOOGLE_AI_API_KEY is required');
  console.error('Please set it in your .env file or environment variables');
  process.exit(1);
}

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'chrome-extension://*'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Meet Artifact Generator API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      websocket: 'ws://localhost:' + PORT,
    },
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, /chrome-extension:\/\/.*/],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow binary data for audio streaming
  maxHttpBufferSize: 1e7, // 10MB
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  handleClientConnection(socket, GOOGLE_AI_API_KEY);
});

// Start server
httpServer.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('  Meet Artifact Generator - Backend Server');
  console.log('='.repeat(50));
  console.log(`  HTTP Server:    http://localhost:${PORT}`);
  console.log(`  WebSocket:      ws://localhost:${PORT}`);
  console.log(`  Frontend URL:   ${FRONTEND_URL}`);
  console.log('='.repeat(50));
  console.log('');
  console.log('Waiting for connections...');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  io.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
