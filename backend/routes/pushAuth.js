import express from 'express';
import {
  initiateLogin,
  checkStatus,
  respondToRequest,
  registerFcmToken,
  removeFcmToken,
  getVapidPublicKey,
  subscribeWebPush,
  unsubscribeWebPush,
} from '../controllers/pushAuthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Public routes ─────────────────────────────────────────
// POST /api/push-auth/initiate          → Start push login (send FCM notification)
router.post('/initiate', initiateLogin);

// GET  /api/push-auth/status/:requestId → Poll login request status
router.get('/status/:requestId', checkStatus);

// POST /api/push-auth/respond           → Approve/Deny login request
router.post('/respond', respondToRequest);

// GET  /api/push-auth/vapid-public-key   → Get VAPID key to configure web notifications
router.get('/vapid-public-key', getVapidPublicKey);

// ─── Protected routes (user must be logged in) ────────────
// POST   /api/push-auth/register-token  → Save FCM device token
router.post('/register-token', authenticateToken, registerFcmToken);

// DELETE /api/push-auth/register-token  → Remove FCM device token
router.delete('/register-token', authenticateToken, removeFcmToken);

// POST   /api/push-auth/subscribe       → Subscribe web browser for notifications
router.post('/subscribe', authenticateToken, subscribeWebPush);

// DELETE /api/push-auth/subscribe       → Unsubscribe web browser from notifications
router.delete('/subscribe', authenticateToken, unsubscribeWebPush);

export default router;
