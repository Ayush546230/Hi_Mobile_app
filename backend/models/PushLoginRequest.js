import mongoose from 'mongoose';
import crypto from 'crypto';

const pushLoginRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired'],
    default: 'pending',
  },
  deviceInfo: {
    type: String,
    default: 'Unknown device',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 1000), // 2 minutes TTL
  },
});

// Auto-delete expired requests via MongoDB TTL index
pushLoginRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Ensure only one active pending request per user
pushLoginRequestSchema.index({ userId: 1, status: 1 });

export default mongoose.model('PushLoginRequest', pushLoginRequestSchema);
