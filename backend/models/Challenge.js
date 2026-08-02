import mongoose from 'mongoose';

// Temporary challenge storage for WebAuthn flows
// Replaces session-based storage which doesn't work with mobile apps
const challengeSchema = new mongoose.Schema({
  challengeId: { type: String, required: true, unique: true },
  challenge: { type: String, required: true },
  userId: { type: String }, // For registration flows
  email: { type: String },  // For auth flows
  type: { type: String, enum: ['registration', 'authentication'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // Auto-delete after 5 minutes
});

export default mongoose.model('Challenge', challengeSchema);
