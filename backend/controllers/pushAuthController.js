import admin from 'firebase-admin';
import crypto from 'crypto';
import User from '../models/User.js';
import PushLoginRequest from '../models/PushLoginRequest.js';
import { generateToken } from '../middleware/auth.js';

// ─── Configure Firebase Admin (lazy init) ────────────────
let firebaseInitialized = false;

function ensureFirebaseInitialized() {
  if (firebaseInitialized) return true;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    console.warn('Firebase not configured: FIREBASE_SERVICE_ACCOUNT env var missing');
    return false;
  }

  try {
    const parsed = JSON.parse(serviceAccount);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized successfully');
    return true;
  } catch (err) {
    console.error('Firebase init error:', err.message);
    return false;
  }
}

// ─── REGISTER FCM TOKEN (Protected — user must be logged in) ──
export const registerFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.fcmToken = fcmToken;
    user.authMethods.push = true;
    await user.save();

    res.json({
      success: true,
      message: 'FCM token registered for push login',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
      },
    });
  } catch (err) {
    console.error('Register FCM token error:', err);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
};

// ─── REMOVE FCM TOKEN (Protected) ─────────────────────────
export const removeFcmToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.fcmToken = undefined;
    user.authMethods.push = false;
    await user.save();

    res.json({
      success: true,
      message: 'Push notifications disabled',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
      },
    });
  } catch (err) {
    console.error('Remove FCM token error:', err);
    res.status(500).json({ error: 'Failed to remove FCM token' });
  }
};

// ─── INITIATE PUSH LOGIN (Public) ──────────────────────────
export const initiateLogin = async (req, res) => {
  try {
    const { fcmToken, email } = req.body;

    // Find user with push enabled
    let user;
    if (fcmToken) {
      user = await User.findOne({ fcmToken });
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase(), 'authMethods.push': true });
    }

    if (!user) {
      return res.status(404).json({ error: 'No active device subscription found.' });
    }

    if (!user.fcmToken) {
      return res.status(400).json({ error: 'No FCM token registered for this user. Open the app to register.' });
    }

    if (!ensureFirebaseInitialized()) {
      return res.status(503).json({ error: 'Firebase notifications not configured on server. Set FIREBASE_SERVICE_ACCOUNT in .env' });
    }

    await PushLoginRequest.updateMany(
      { userId: user._id, status: 'pending' },
      { status: 'expired' }
    );

    const loginRequest = new PushLoginRequest({
      userId: user._id,
      email: user.email,
      deviceInfo: req.headers['user-agent'] || 'Hi Mobile',
    });
    await loginRequest.save();

    const message = {
      token: user.fcmToken,
      notification: {
        title: 'Login Request',
        body: 'Someone wants to sign in to your Hi account',
      },
      data: {
        type: 'push_login',
        requestId: loginRequest._id.toString(),
        token: loginRequest.token,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'auth_requests',
          priority: 'max',
          sound: 'default',
        },
      },
    };

    try {
      await admin.messaging().send(message);
    } catch (fcmErr) {
      console.error('FCM send error:', fcmErr);
      if (fcmErr.code === 'messaging/registration-token-not-registered' ||
          fcmErr.code === 'messaging/invalid-registration-token') {
        user.fcmToken = undefined;
        user.authMethods.push = false;
        await user.save();
      }
      return res.status(500).json({ error: 'Failed to send FCM push notification' });
    }

    res.json({
      success: true,
      requestId: loginRequest._id.toString(),
      message: 'Push notification sent! Check your device.',
      expiresAt: loginRequest.expiresAt,
    });
  } catch (err) {
    console.error('Initiate push login error:', err);
    res.status(500).json({ error: 'Failed to initiate push login' });
  }
};

// ─── CHECK LOGIN STATUS (Public — Polling) ─────────────────
export const checkStatus = async (req, res) => {
  try {
    const { requestId } = req.params;

    const loginRequest = await PushLoginRequest.findById(requestId);

    if (!loginRequest) {
      return res.status(404).json({ status: 'expired', error: 'Login request not found or expired' });
    }

    if (new Date() > loginRequest.expiresAt) {
      loginRequest.status = 'expired';
      await loginRequest.save();
      return res.json({ status: 'expired' });
    }

    if (loginRequest.status === 'approved') {
      const user = await User.findById(loginRequest.userId);
      if (!user) {
        return res.status(404).json({ status: 'error', error: 'User not found' });
      }

      user.lastLoginAt = new Date();
      user.lastLoginMethod = 'push';
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();

      const token = generateToken(user._id.toString());

      loginRequest.status = 'expired';
      await loginRequest.save();

      return res.json({
        status: 'approved',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          authMethods: user.authMethods,
          loginCount: user.loginCount,
        },
      });
    }

    if (loginRequest.status === 'denied') {
      return res.json({ status: 'denied' });
    }

    res.json({
      status: 'pending',
      expiresAt: loginRequest.expiresAt,
    });
  } catch (err) {
    console.error('Check status error:', err);
    res.status(500).json({ status: 'error', error: 'Failed to check status' });
  }
};

// ─── RESPOND TO LOGIN REQUEST (From notification) ──────────
export const respondToRequest = async (req, res) => {
  try {
    const { requestId, token, action } = req.body;

    if (!requestId || !token || !action) {
      return res.status(400).json({ error: 'requestId, token, and action are required' });
    }

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approve" or "deny"' });
    }

    const loginRequest = await PushLoginRequest.findById(requestId);

    if (!loginRequest) {
      return res.status(404).json({ error: 'Login request not found or expired' });
    }

    if (loginRequest.token !== token) {
      return res.status(403).json({ error: 'Invalid request token' });
    }

    if (loginRequest.status !== 'pending') {
      return res.status(409).json({
        error: `This request has already been ${loginRequest.status}`,
        status: loginRequest.status,
      });
    }

    if (new Date() > loginRequest.expiresAt) {
      loginRequest.status = 'expired';
      await loginRequest.save();
      return res.status(410).json({ error: 'Login request has expired' });
    }

    loginRequest.status = action === 'approve' ? 'approved' : 'denied';
    await loginRequest.save();

    let jwtToken, userResponse;
    if (action === 'approve') {
      const user = await User.findById(loginRequest.userId);
      if (user) {
        jwtToken = generateToken(user._id.toString());
        userResponse = {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          authMethods: user.authMethods,
          loginCount: user.loginCount,
        };
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`push-${requestId}`).emit('push-login-response', {
        status: loginRequest.status,
        token: jwtToken,
        user: userResponse
      });
    }

    res.json({
      success: true,
      status: loginRequest.status,
      token: jwtToken,
      user: userResponse,
      message: action === 'approve'
        ? 'Login approved! The requesting device will be signed in.'
        : 'Login denied. The requesting device has been blocked.',
    });
  } catch (err) {
    console.error('Respond to request error:', err);
    res.status(500).json({ error: 'Failed to process response' });
  }
};
