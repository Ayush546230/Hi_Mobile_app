import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import passkeyRoutes from './routes/passkeys.js';
import pushAuthRoutes from './routes/pushAuth.js';
import meetingRoutes from './routes/meetings.js';
import userRoutes from './routes/users.js';
import { startReminderScheduler } from './services/reminderScheduler.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (e.g. localtunnel, ngrok, Render, Heroku)
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// CORS: Allow both the web frontend and mobile app origins
const allowedOrigins = [
  'https://hi-mobile-app.vercel.app',
  'https://video-conferencing-website-one.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

const getCorsOrigin = () => {
  return (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all origins for mobile app compatibility
  };
};

// ─── Socket.io Initialization ──────────────────────────────
export const io = new Server(server, {
  cors: {
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[SOCKET] New client connected: ${socket.id}`);

  // Client joins a specific meeting room
  socket.on('join-room', (roomName) => {
    socket.join(roomName);
    console.log(`[SOCKET] Client ${socket.id} joined room: ${roomName}`);
  });

  // Host joined and notifies guests in the room
  socket.on('host-joined', (roomName) => {
    socket.to(roomName).emit('host-joined');
    console.log(`[SOCKET] Host joined room: ${roomName}. Notifying guests.`);
  });

  // Guest knocking to join a meeting
  socket.on('guest-knocking', (data) => {
    console.log(`[SOCKET] Guest ${data.user?.name || socket.id} knocking in room: ${data.roomName}`);
    socket.to(data.roomName).emit('guest-knocking', { ...data.user, socketId: socket.id });
  });

  // Host admits a guest
  socket.on('admit-guest', (socketId) => {
    console.log(`[SOCKET] Host admitted guest socket: ${socketId}`);
    io.to(socketId).emit('guest-admitted');
  });

  // Host denies a guest
  socket.on('deny-guest', (socketId) => {
    console.log(`[SOCKET] Host denied guest socket: ${socketId}`);
    io.to(socketId).emit('guest-denied');
  });

  // Client joins a push authentication room to listen for login approval
  socket.on('join-push-room', (requestId) => {
    socket.join(`push-${requestId}`);
    console.log(`[SOCKET] Client ${socket.id} joined push auth room: push-${requestId}`);
  });

  socket.on('join-dashboard', (email) => {
    socket.join(`dashboard-${email.toLowerCase()}`);
    console.log(`[SOCKET] Client ${socket.id} joined dashboard room: dashboard-${email.toLowerCase()}`);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// ─── Connect MongoDB ───────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/auth-showcase', {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging forever
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err.message));

// ─── Security Middleware ───────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: false, // Adjust for production
  })
);


app.use(
  cors({
    origin: getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate Limiting ─────────────────────────────────────────
// General API rate limiter (protects against general DDoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Strict rate limiter for Authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // relaxed to 100 attempts for testing
  message: { error: 'Too many authentication attempts, please try again after 15 minutes' }
});

// ─── Body Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Routes ────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/passkeys', authLimiter, passkeyRoutes);
app.use('/api/push-auth', authLimiter, pushAuthRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', userRoutes);

// ─── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Meeting Deep Link / Landing Redirection ────────────────
app.get('/meeting/:roomName', (req, res) => {
  const { roomName } = req.params;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Join hi Meeting</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          background: #0d0c15; 
          color: #fff; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
          margin: 0; 
          text-align: center; 
          padding: 20px; 
        }
        .card { 
          background: #171622; 
          padding: 35px 25px; 
          border-radius: 24px; 
          border: 1px solid #272635; 
          box-shadow: 0 12px 40px rgba(0,0,0,0.6); 
          max-width: 360px; 
          width: 100%;
        }
        h1 { 
          color: #f97316; 
          font-style: italic; 
          font-weight: 900; 
          margin: 0 0 10px; 
          font-size: 32px;
        }
        p { 
          color: #a0aec0; 
          font-size: 14px; 
          line-height: 1.6; 
          margin: 10px 0;
        }
        .code-box { 
          background: #0d0c15; 
          border: 1.5px dashed #f97316; 
          padding: 14px; 
          border-radius: 12px; 
          font-weight: 800; 
          letter-spacing: 1.5px; 
          color: #f97316; 
          font-size: 20px; 
          margin: 20px 0; 
          text-transform: uppercase;
        }
        .footer-text {
          font-size: 11px;
          color: #718096;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>hi</h1>
        <p>You have been invited to join a video meeting.</p>
        <p style="margin-top: 20px; font-weight: 600; color: #cbd5e0;">Meeting Room Code</p>
        <div class="code-box">${roomName}</div>
        <p>Open the <strong>hi Mobile App</strong> and enter this room code to join instantly.</p>
        <div class="footer-text">Powered by aiRender</div>
      </div>
    </body>
    </html>
  `);
});

// ─── Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startReminderScheduler();
});

// ─── Render Keep-Alive ─────────────────────────────────────
// Free instances spin down after 15 minutes of inactivity.
// This periodically pings the health endpoint to keep it awake.
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
if (RENDER_URL) {
  setInterval(() => {
    fetch(`${RENDER_URL}/api/health`)
      .then(res => console.log(`[Keep-Alive] Pinged ${RENDER_URL} - Status: ${res.status}`))
      .catch(err => console.error(`[Keep-Alive] Ping failed:`, err.message));
  }, 14 * 60 * 1000); // 14 minutes
}

export default app;
