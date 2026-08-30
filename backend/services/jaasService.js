import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKeyObject = null;

function parseKey(raw) {
  if (!raw) return null;
  
  // Clean surrounding quotes
  let cleaned = raw.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }

  // Handle literal escaped newlines
  if (cleaned.includes('\\n')) {
    cleaned = cleaned.replace(/\\n/g, '\n');
  }

  cleaned = cleaned.replace(/\r/g, '').trim();

  try {
    const keyObj = crypto.createPrivateKey({
      key: cleaned,
      format: 'pem',
    });
    console.log('[JaaS] ✅ Private key loaded successfully. Key type:', keyObj.asymmetricKeyType);
    return keyObj;
  } catch (err) {
    console.error('[JaaS] ❌ Failed to parse private key:', err.message);
    return null;
  }
}

// 1. Try Environment Variable first
if (process.env.JAAS_PRIVATE_KEY) {
  console.log('[JaaS] Loading private key from JAAS_PRIVATE_KEY env var...');
  privateKeyObject = parseKey(process.env.JAAS_PRIVATE_KEY);
}

// 2. Fallback to jaas_private.pk file in backend directory
if (!privateKeyObject) {
  try {
    const keyPath = path.join(__dirname, '..', 'jaas_private.pk');
    if (fs.existsSync(keyPath)) {
      console.log('[JaaS] Loading private key from fallback file: jaas_private.pk...');
      const fileKey = fs.readFileSync(keyPath, 'utf8');
      privateKeyObject = parseKey(fileKey);
    }
  } catch (error) {
    console.warn('[JaaS] Fallback file read error:', error.message);
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

  if (!privateKeyObject || !appId || !kid) {
    throw new Error('JaaS configuration is incomplete. Missing valid private key, APP_ID, or API_KEY_ID.');
  }

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: '*',
    context: {
      user: {
        id: user?._id ? user._id.toString() : 'guest',
        name: user?.name || user?.email || 'Guest',
        email: user?.email || '',
        avatar: (user?.avatar && user.avatar.length < 500) ? user.avatar : '',
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
    algorithm: 'RS256',
    header: {
      kid: kid,
      typ: 'JWT',
    },
    expiresIn: '24h',
  };

  const token = jwt.sign(payload, privateKeyObject, options);
  console.log('[JaaS] ✅ JWT generated successfully for user:', user?.email, '| isModerator:', isModerator);
  return token;
};
