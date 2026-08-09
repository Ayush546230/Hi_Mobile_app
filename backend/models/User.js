import mongoose from 'mongoose';

// ─── Passkey / Authenticator Sub-Schema ───────────────────
const authenticatorSchema = new mongoose.Schema({
  credentialID: { type: String, required: true },
  credentialPublicKey: { type: String, required: true }, // base64url encoded
  counter: { type: Number, required: true, default: 0 },
  credentialDeviceType: { type: String, enum: ['singleDevice', 'multiDevice'] },
  credentialBackedUp: { type: Boolean, default: false },
  transports: [{ type: String }],
  aaguid: { type: String },
  name: { type: String, default: 'My Passkey' }, // user-friendly label
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
});

// ─── Main User Schema ──────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // Core identity
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    name: { type: String, trim: true },
    avatar: { type: String },

    // Auth methods flags
    authMethods: {
      google: { type: Boolean, default: false },
      passkey: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },

    // Google OAuth
    googleId: { type: String, sparse: true },

    // WebAuthn Passkeys (multiple devices supported)
    passkeys: [authenticatorSchema],

    // FCM Device Token (for native push notifications)
    fcmToken: { type: String },

    // Web Push Subscription (for identifying web clients)
    webPushSubscription: { type: Object },

    // User Preferences (for meeting defaults & UI)
    preferences: {
      displayName: { type: String },
      micDefault: { type: Boolean, default: false },
      speakerDefault: { type: Boolean, default: false },
      cameraDefault: { type: Boolean, default: false },
      notifications: { type: Boolean, default: true },
      soundEffects: { type: Boolean, default: true },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },

    // Security metadata
    lastLoginAt: { type: Date },
    lastLoginMethod: { type: String, enum: ['google', 'passkey', 'push'] },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        // Never expose raw passkey keys in API responses
        if (ret.passkeys) {
          ret.passkeys = ret.passkeys.map((p) => ({
            id: p._id,
            name: p.name,
            credentialID: p.credentialID,
            createdAt: p.createdAt,
            lastUsedAt: p.lastUsedAt,
            credentialDeviceType: p.credentialDeviceType,
            credentialBackedUp: p.credentialBackedUp,
          }));
        }
        return ret;
      },
    },
  }
);

// ─── Indexes ───────────────────────────────────────────────
userSchema.index({ 'passkeys.credentialID': 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema);
