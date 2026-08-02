import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKey;
if (process.env.JAAS_PRIVATE_KEY) {
  // Render sometimes passes multi-line secrets with literal \n strings
  privateKey = process.env.JAAS_PRIVATE_KEY.replace(/\\n/g, '\n');
} else {
  try {
    privateKey = fs.readFileSync(path.join(__dirname, '..', 'jaas_private.pk'), 'utf8');
  } catch (error) {
    console.warn('JaaS Private Key not found in Env or File. Video meeting JWT generation will fail.');
  }
}

/**
 * Generate a JWT token for JaaS (Jitsi as a Service)
 * @param {Object} user - User profile object (id, displayName, email)
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

  // JaaS expects standard JWT claims + custom context
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: '*', // Best practice for JaaS is to allow '*' and control access via your own backend routing
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
    expiresIn: '24h', // Token valid for 24 hours
  };

  return jwt.sign(payload, privateKey, options);
};
