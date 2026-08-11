import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parsePemKey(raw) {
  // Step 1: Strip surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }

  // Step 2: Try replacing literal \n with real newlines
  raw = raw.replace(/\\n/g, '\n');

  // Step 3: Also handle double-escaped \\n
  raw = raw.replace(/\\n/g, '\n');

  // Step 4: If still no proper newlines, reconstruct PEM from raw base64
  if (!raw.includes('\n') || raw.split('\n').filter(l => l.trim()).length < 3) {
    const match = raw.match(/-----BEGIN[^-]*-----(.+?)-----END[^-]*-----/s);
    if (match) {
      const base64Body = match[1].replace(/[\s\r\n]+/g, '');
      const lines = base64Body.match(/.{1,64}/g) || [];
      raw = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----\n';
    }
  }

  return raw;
}

let privateKey;
if (process.env.JAAS_PRIVATE_KEY) {
  const envRaw = process.env.JAAS_PRIVATE_KEY;
  
  // Diagnostic dump
  console.log('[JaaS-KEY-DEBUG] Raw env length:', envRaw.length);
  console.log('[JaaS-KEY-DEBUG] First 80 chars:', JSON.stringify(envRaw.substring(0, 80)));
  console.log('[JaaS-KEY-DEBUG] Last 60 chars:', JSON.stringify(envRaw.substring(envRaw.length - 60)));
  console.log('[JaaS-KEY-DEBUG] Contains literal backslash-n:', envRaw.includes('\\n'));
  console.log('[JaaS-KEY-DEBUG] Contains real newline:', envRaw.includes('\n'));
  console.log('[JaaS-KEY-DEBUG] Starts with quote:', envRaw[0]);

  const parsed = parsePemKey(envRaw);
  
  console.log('[JaaS-KEY-DEBUG] Parsed key lines:', parsed.split('\n').length);
  console.log('[JaaS-KEY-DEBUG] Parsed first 60:', JSON.stringify(parsed.substring(0, 60)));

  // Use crypto.createPrivateKey to validate and normalize the key
  try {
    const keyObject = crypto.createPrivateKey(parsed);
    privateKey = keyObject.export({ type: 'pkcs8', format: 'pem' });
    console.log('[JaaS] ✅ Private key loaded and validated successfully from env var.');
  } catch (cryptoErr) {
    console.error('[JaaS] ❌ crypto.createPrivateKey failed:', cryptoErr.message);
    console.error('[JaaS] Falling back to raw parsed string...');
    privateKey = parsed;
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
