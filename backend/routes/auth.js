import express from 'express';
import { googleLogin, getProfile, devLogin } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/google  — verify Google ID token
router.post('/google', googleLogin);

// POST /api/auth/dev-login — developer/testing email login
router.post('/dev-login', devLogin);

// GET  /api/auth/me      — get current user profile (protected)
router.get('/me', authenticateToken, getProfile);

export default router;
