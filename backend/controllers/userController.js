import User from '../models/User.js';

// ─── GET /api/users/profile ─────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passkeys.credentialPublicKey');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
        preferences: user.preferences || {},
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// ─── PUT /api/users/profile ─────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { displayName, avatar, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (displayName !== undefined) {
      user.name = displayName;
      user.set('preferences.displayName', displayName);
    }
    if (avatar !== undefined) user.avatar = avatar;
    // Don't allow email change for security — it's tied to auth

    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
        preferences: user.preferences || {},
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ─── PUT /api/users/preferences ─────────────────────────────
export const updatePreferences = async (req, res) => {
  try {
    const { micDefault, speakerDefault, cameraDefault, notifications, soundEffects, timezone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (micDefault !== undefined) user.set('preferences.micDefault', micDefault);
    if (speakerDefault !== undefined) user.set('preferences.speakerDefault', speakerDefault);
    if (cameraDefault !== undefined) user.set('preferences.cameraDefault', cameraDefault);
    if (notifications !== undefined) user.set('preferences.notifications', notifications);
    if (soundEffects !== undefined) user.set('preferences.soundEffects', soundEffects);
    if (timezone !== undefined) user.set('preferences.timezone', timezone);
    await user.save();

    res.json({
      preferences: user.preferences,
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};
