import admin from 'firebase-admin';
import crypto from 'crypto';
import webpush from 'web-push';
import User from '../models/User.js';
import PushLoginRequest from '../models/PushLoginRequest.js';
import { generateToken } from '../middleware/auth.js';

// ─── Configure Web Push (VAPID) ──────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCxnaLatVz56iGkM6Z96xjUTi7nR8hIWXIERFlZ2_ZbUWTObDWdbFbbAj2PV-ADaf3hBOX1PJwcC21avnMwaQTo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DOZ39UJVR-sJTsrufyuPiAWJ6WOyZQu12d89XO6eBTY';

webpush.setVapidDetails(
  'mailto:admin@hi-app.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

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
    const { fcmToken, email, subscription } = req.body;
    console.log('[DEBUG] initiateLogin called. Payload email:', email, 'fcmToken:', !!fcmToken, 'hasSubscription:', !!subscription);
    if (subscription) {
      console.log('[DEBUG] subscription keys:', Object.keys(subscription), 'endpoint:', subscription.endpoint ? subscription.endpoint.slice(0, 50) + '...' : 'none');
    }

    // Find user with push enabled
    let user;
    if (subscription && subscription.endpoint) {
      user = await User.findOne({ 'webPushSubscription.endpoint': subscription.endpoint });
      console.log('[DEBUG] Search by webPushSubscription.endpoint result:', user ? user.email : 'NOT FOUND');
    }
    if (!user && fcmToken) {
      user = await User.findOne({ fcmToken });
      console.log('[DEBUG] Search by fcmToken result:', user ? user.email : 'NOT FOUND');
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase(), 'authMethods.push': true });
      console.log('[DEBUG] Search by email result:', user ? user.email : 'NOT FOUND');
    }

    if (!user) {
      console.log('[DEBUG] initiateLogin failed: User not found in DB');
      return res.status(404).json({ error: 'No active device subscription found.' });
    }

    console.log('[DEBUG] User found:', user.email, 'FCM token:', !!user.fcmToken, 'Web subscription:', !!user.webPushSubscription);

    if (!user.fcmToken && !user.webPushSubscription) {
      console.log('[DEBUG] initiateLogin failed: Neither FCM nor Web Push subscription is registered on the found User doc');
      return res.status(400).json({ error: 'No FCM token or browser push subscription registered for this user.' });
    }

    await PushLoginRequest.updateMany(
      { userId: user._id, status: 'pending' },
      { status: 'expired' }
    );

    const loginRequest = new PushLoginRequest({
      userId: user._id,
      email: user.email,
      deviceInfo: req.headers['user-agent'] || 'Hi Device',
    });
    await loginRequest.save();

    let sentToFcm = false;
    let sentToWebPush = false;

    // 1. Send FCM (Mobile)
    if (user.fcmToken && ensureFirebaseInitialized()) {
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
        sentToFcm = true;
      } catch (fcmErr) {
        console.error('FCM send error:', fcmErr);
        if (fcmErr.code === 'messaging/registration-token-not-registered' ||
            fcmErr.code === 'messaging/invalid-registration-token') {
          user.fcmToken = undefined;
          await user.save();
        }
      }
    }

    // 2. Send Web Push (Browser)
    if (user.webPushSubscription) {
      try {
        const payload = JSON.stringify({
          title: 'Login Request',
          body: 'Someone wants to sign in to your Hi account',
          data: {
            requestId: loginRequest._id.toString(),
            token: loginRequest.token,
            apiUrl: process.env.BACKEND_URL || 'https://hi-mobile-app.onrender.com'
          }
        });
        await webpush.sendNotification(user.webPushSubscription, payload);
        sentToWebPush = true;
      } catch (webPushErr) {
        console.error('Web Push send error:', webPushErr);
        if (webPushErr.statusCode === 410 || webPushErr.statusCode === 404) {
          user.webPushSubscription = undefined;
          await user.save();
        }
      }
    }

    // Sync push authentication status flag
    if (!user.fcmToken && !user.webPushSubscription && user.authMethods.push) {
      user.authMethods.push = false;
      await user.save();
    }

    if (!sentToFcm && !sentToWebPush) {
      return res.status(500).json({ error: 'Failed to deliver push notification on any device.' });
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

// ─── GET VAPID PUBLIC KEY (Public) ──────────────────────────
export const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
};

// ─── SUBSCRIBE TO WEB PUSH (Protected) ──────────────────────
export const subscribeWebPush = async (req, res) => {
  try {
    const { subscription } = req.body;
    console.log('[DEBUG] subscribeWebPush called for user:', req.user.email);
    console.log('[DEBUG] subscription payload:', JSON.stringify(subscription));

    const user = await User.findById(req.user._id);
    if (user) {
      user.authMethods.push = true;
      user.webPushSubscription = subscription;
      user.markModified('webPushSubscription');
      const savedUser = await user.save();
      
      console.log('[DEBUG] User subscription saved. DB authMethods.push:', savedUser.authMethods.push, 'hasSubscription:', !!savedUser.webPushSubscription);
      
      return res.json({
        success: true,
        user: {
          id: savedUser._id,
          email: savedUser.email,
          name: savedUser.name,
          avatar: savedUser.avatar,
          authMethods: savedUser.authMethods,
        }
      });
    }
    
    res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Web push subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe to web push' });
  }
};

// ─── UNSUBSCRIBE FROM WEB PUSH (Protected) ──────────────────
export const unsubscribeWebPush = async (req, res) => {
  try {
    console.log('[DEBUG] unsubscribeWebPush called for user:', req.user.email);
    const user = await User.findById(req.user._id);
    if (user) {
      user.authMethods.push = false;
      user.webPushSubscription = undefined;
      user.markModified('webPushSubscription');
      const savedUser = await user.save();
      
      console.log('[DEBUG] User unsubscribed. DB authMethods.push:', savedUser.authMethods.push);
      
      return res.json({
        success: true,
        user: {
          id: savedUser._id,
          email: savedUser.email,
          name: savedUser.name,
          avatar: savedUser.avatar,
          authMethods: savedUser.authMethods,
        }
      });
    }
    
    res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Web push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe from web push' });
  }
};
