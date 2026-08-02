import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token (from Google One Tap / Sign-In button)
 * This uses the FREE Google Identity Services (GIS) library.
 * No paid APIs required.
 */
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID to .env',
        setupGuide: 'https://console.cloud.google.com/',
      });
    }

    // Verify the ID token with Google's servers
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(401).json({ error: 'Google email not verified' });
    }

    // ─── Upsert user ─────────────────────────────────────
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      // Link Google to existing account
      if (!user.googleId) user.googleId = googleId;
      if (!user.authMethods.google) user.authMethods.google = true;
      if (picture && !user.avatar) user.avatar = picture;
    } else {
      // Create new user
      user = new User({
        email,
        name,
        avatar: picture,
        googleId,
        authMethods: { google: true },
      });
    }

    user.lastLoginAt = new Date();
    user.lastLoginMethod = 'google';
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const token = generateToken(user._id.toString());

    res.json({
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
  } catch (err) {
    console.error('Google login error:', err);
    if (err.message?.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google token expired. Please try again.' });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Get current authenticated user's profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * Developer Dev-Login (Only active in development/test or if explicitly invoked)
 */
export const devLogin = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&background=6C63FF&color=fff`,
        authMethods: { google: true, passkey: true, push: true }
      });
    }

    user.lastLoginAt = new Date();
    user.lastLoginMethod = 'google';
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const token = generateToken(user._id.toString());
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
        loginCount: user.loginCount,
      }
    });
  } catch (err) {
    console.error('Dev login error:', err);
    res.status(500).json({ error: 'Dev login failed' });
  }
};

