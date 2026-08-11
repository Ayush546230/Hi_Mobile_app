import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKey;
if (process.env.JAAS_PRIVATE_KEY) {
  let raw = process.env.JAAS_PRIVATE_KEY;
  
  // Strip surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  // Replace literal \n with real newlines
  raw = raw.replace(/\\n/g, '\n');

  // Extract ONLY the base64 content (strip PEM headers/footers and ALL whitespace)
  const base64Content = raw
    .replace(/-----BEGIN[^-]*-----/g, '')
    .replace(/-----END[^-]*-----/g, '')
    .replace(/[\s\r\n]+/g, '');

  console.log('[JaaS-KEY] Base64 content length:', base64Content.length);
  console.log('[JaaS-KEY] First 40 base64 chars:', base64Content.substring(0, 40));

  try {
    // Decode base64 → DER binary buffer, then create key with explicit format hints
    const derBuffer = Buffer.from(base64Content, 'base64');
    const keyObject = crypto.createPrivateKey({ key: derBuffer, format: 'der', type: 'pkcs8' });
    privateKey = keyObject.export({ type: 'pkcs8', format: 'pem' });
    console.log('[JaaS] ✅ Private key loaded via DER decode. Lines:', privateKey.split('\n').length);
  } catch (derErr) {
    console.error('[JaaS] DER/PKCS8 failed:', derErr.message, '— trying PKCS1...');
    try {
      const derBuffer = Buffer.from(base64Content, 'base64');
      const keyObject = crypto.createPrivateKey({ key: derBuffer, format: 'der', type: 'pkcs1' });
      privateKey = keyObject.export({ type: 'pkcs8', format: 'pem' });
      console.log('[JaaS] ✅ Private key loaded via DER/PKCS1 decode.');
    } catch (pkcs1Err) {
      console.error('[JaaS] DER/PKCS1 also failed:', pkcs1Err.message);
      // Last resort: reconstruct clean PEM manually and use as-is
      const lines = base64Content.match(/.{1,64}/g) || [];
      privateKey = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----\n';
      console.log('[JaaS] ⚠️ Using manually reconstructed PEM (last resort). Lines:', privateKey.split('\n').length);
    }
  }
} else {
  try {
    privateKey = fs.readFileSync(path.join(__dirname, '..', 'jaas_private.pk'), 'utf8');
    console.log('[JaaS] Private key loaded from file.');
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
