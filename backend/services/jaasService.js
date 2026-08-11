import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKey;
if (process.env.JAAS_PRIVATE_KEY) {
  let raw = process.env.JAAS_PRIVATE_KEY;

  // 1. Strip surrounding quotes if present (Render UI sometimes adds them)
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }

  // 2. Replace literal escaped newlines with real newlines
  //    Handles \\n (double-escaped) and \n (single-escaped literal)
  raw = raw.replace(/\\n/g, '\n');

  // 3. If there are still no real newlines (pasted as one long line), reconstruct PEM
  if (!raw.includes('\n') || raw.split('\n').length < 3) {
    // Extract the base64 body between BEGIN/END markers
    const match = raw.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----(.*?)-----END (?:RSA )?PRIVATE KEY-----/s);
    if (match) {
      const base64Body = match[1].replace(/\s+/g, '');
      // Rebuild PEM with 64-char line wrapping
      const lines = base64Body.match(/.{1,64}/g) || [];
      raw = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  }

  privateKey = raw;
  console.log(`[JaaS] Private key loaded from env. First 50 chars: ${privateKey.substring(0, 50)}...`);
  console.log(`[JaaS] Key contains ${privateKey.split('\n').length} lines, total length=${privateKey.length}`);
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
