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

  console.log('[JaaS-ULTRA] === KEY LOADING START ===');
  console.log('[JaaS-ULTRA] raw typeof:', typeof raw);
  console.log('[JaaS-ULTRA] raw length:', raw.length);
  console.log('[JaaS-ULTRA] raw first 60 chars (hex):', Buffer.from(raw.substring(0, 60)).toString('hex'));
  console.log('[JaaS-ULTRA] raw first 60 chars (text):', raw.substring(0, 60).replace(/\n/g, '[NL]').replace(/\r/g, '[CR]'));
  console.log('[JaaS-ULTRA] Has real newline (\\n char):', raw.indexOf('\n') !== -1);
  console.log('[JaaS-ULTRA] Has literal backslash-n:', raw.indexOf('\\n') !== -1);
  console.log('[JaaS-ULTRA] Starts with quote:', raw.startsWith('"') || raw.startsWith("'"));
  console.log('[JaaS-ULTRA] Has BEGIN header:', raw.includes('BEGIN PRIVATE KEY'));
  console.log('[JaaS-ULTRA] Has BEGIN RSA header:', raw.includes('BEGIN RSA PRIVATE KEY'));

  // Strip surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
    console.log('[JaaS-ULTRA] Stripped quotes. New length:', raw.length);
  }

  // Handle both storage formats
  if (raw.indexOf('\n') === -1) {
    console.log('[JaaS-ULTRA] No real newlines — converting literal \\n to real newlines');
    raw = raw.split('\\n').join('\n');
    console.log('[JaaS-ULTRA] After conversion length:', raw.length);
  } else {
    console.log('[JaaS-ULTRA] Real newlines found — no conversion needed');
  }

  console.log('[JaaS-ULTRA] Final PEM first line:', raw.split('\n')[0]);
  console.log('[JaaS-ULTRA] Final PEM last line:', raw.split('\n').slice(-1)[0]);
  console.log('[JaaS-ULTRA] Final PEM total lines:', raw.split('\n').length);
  console.log('[JaaS-ULTRA] Final PEM has BEGIN:', raw.includes('-----BEGIN PRIVATE KEY-----'));
  console.log('[JaaS-ULTRA] Final PEM has END:', raw.includes('-----END PRIVATE KEY-----'));

  // Try parsing to validate key
  try {
    const testKey = crypto.createPrivateKey(raw);
    console.log('[JaaS-ULTRA] ✅ crypto.createPrivateKey SUCCEEDED. keyType:', testKey.asymmetricKeyType);
    privateKey = raw;
  } catch (e) {
    console.error('[JaaS-ULTRA] ❌ crypto.createPrivateKey FAILED:', e.message);
    console.log('[JaaS-ULTRA] Full raw value (first 200 chars):', raw.substring(0, 200).replace(/\n/g, '[NL]'));
    // Still try using it directly
    privateKey = raw;
  }

  console.log('[JaaS-ULTRA] === KEY LOADING DONE ===');
} else {
  console.warn('[JaaS-ULTRA] JAAS_PRIVATE_KEY env var NOT SET — trying file');
  try {
    privateKey = fs.readFileSync(path.join(__dirname, '..', 'jaas_private.pk'), 'utf8');
    console.log('[JaaS-ULTRA] Key loaded from file. Length:', privateKey.length);
  } catch (error) {
    console.warn('[JaaS-ULTRA] Key file not found either. JWT generation will fail.');
  }
}

/**
 * Generate a JWT token for JaaS (Jitsi as a Service)
 */
export const generateJaaSToken = (user, roomName, isModerator = false) => {
  const appId = process.env.JAAS_APP_ID;
  const kid = process.env.JAAS_API_KEY_ID;

  console.log('[JaaS-ULTRA] generateJaaSToken called. appId:', appId ? 'SET' : 'MISSING', '| kid:', kid ? 'SET' : 'MISSING', '| privateKey:', privateKey ? `SET (len=${typeof privateKey === 'string' ? privateKey.length : 'obj'})` : 'MISSING');

  if (!privateKey || !appId || !kid) {
    throw new Error('JaaS configuration is incomplete. Missing private key, APP_ID, or API_KEY_ID.');
  }

  // Log key details at sign time
  if (typeof privateKey === 'string') {
    console.log('[JaaS-ULTRA] privateKey at sign: len=', privateKey.length,
      '| starts=', privateKey.substring(0, 27),
      '| hasNewline=', privateKey.includes('\n'),
      '| hasBEGIN=', privateKey.includes('BEGIN'));
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
    algorithm: 'RS256',
    header: {
      kid: kid,
      typ: 'JWT',
    },
    expiresIn: '24h',
  };

  return jwt.sign(payload, privateKey, options);
};
