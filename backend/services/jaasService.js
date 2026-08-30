import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKey;
if (process.env.JAAS_PRIVATE_KEY) {
  let raw = process.env.JAAS_PRIVATE_KEY;

  // Strip surrounding quotes if any
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }

  // Handle both storage formats:
  // Format 1 (Render with real newlines): raw already has \n chars → no change needed
  // Format 2 (single-line with escaped sequences): "...\\nMIIEv..." → split on literal \n and join with real newline
  if (raw.indexOf('\n') === -1) {
    // No real newlines found — must be using literal \n sequences
    raw = raw.split('\\n').join('\n');
  }

  // Use the PEM string directly — jwt.sign() accepts PEM strings for RS256
  privateKey = raw;
  console.log('[JaaS] ✅ Private key loaded from env. Length:', raw.length, '| Has PEM header:', raw.includes('BEGIN PRIVATE KEY'));
} else {
  try {
    privateKey = fs.readFileSync(path.join(__dirname, '..', 'jaas_private.pk'), 'utf8');
    console.log('[JaaS] Private key loaded from file.');
  } catch (error) {
    console.warn('[JaaS] Private Key not found in Env or File. JWT generation will fail.');
  }
}

/**
 * Generate a JWT token for JaaS (Jitsi as a Service)
 * @param {Object} user - User profile object
 * @param {string} roomName - The name of the meeting room
 * @param {boolean} isModerator - Whether the user is the host/moderator
 * @returns {string} - Signed JWT token
 */
export const generateJaaSToken = (user, roomName, isModerator = false) => {
  const appId = process.env.JAAS_APP_ID;
  const kid = process.env.JAAS_API_KEY_ID;

  if (!privateKey || !appId || !kid) {
    throw new Error('JaaS configuration is incomplete. Missing private key, APP_ID, or API_KEY_ID.');
  }

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: '*',
    context: {
      user: {
        id: user._id ? user._id.toString() : 'guest',
        name: user.name || user.email || 'Guest',
        email: user.email || '',
        avatar: (user.avatar && user.avatar.length < 500) ? user.avatar : '',
        moderator: isModerator,
      },
      features: {
        livestreaming: isModerator,
        recording: isModerator,
        transcription: isModerator,
        'outbound-call': isModerator,
        'end-conference': isModerator,
      },
    },
  };

  const options = {
    header: {
      kid: kid,
      typ: 'JWT',
      alg: 'RS256',
    },
    expiresIn: '24h',
  };

  return jwt.sign(payload, privateKey, options);
};
