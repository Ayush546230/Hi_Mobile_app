import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKey = null;
let privateKeyObject = null;

// =====================================================
// LOAD JAAS PRIVATE KEY
// =====================================================

if (process.env.JAAS_PRIVATE_KEY) {
  let raw = process.env.JAAS_PRIVATE_KEY;

  console.log('[JaaS] ===== PRIVATE KEY LOADING =====');

  // Remove surrounding quotes if Render/env has them
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1);
  }

  // Convert literal \n into real newlines
  if (raw.includes('\\n')) {
    raw = raw.replace(/\\n/g, '\n');
  }

  // Remove accidental CR characters
  raw = raw.replace(/\r/g, '');

  privateKey = raw.trim();

  console.log('[JaaS] Key length:', privateKey.length);
  console.log('[JaaS] Has BEGIN PRIVATE KEY:', privateKey.includes('-----BEGIN PRIVATE KEY-----'));
  console.log('[JaaS] Has END PRIVATE KEY:', privateKey.includes('-----END PRIVATE KEY-----'));
  console.log('[JaaS] Has real newline:', privateKey.includes('\n'));
  console.log('[JaaS] First 60 chars:', privateKey.substring(0, 60).replace(/\n/g, '[NL]'));

  // IMPORTANT: Convert PEM string into Node.js asymmetric KeyObject
  try {
    privateKeyObject = crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
    });

    console.log('[JaaS] ✅ Private key parsed successfully');
    console.log('[JaaS] Key type:', privateKeyObject.asymmetricKeyType);

    if (privateKeyObject.asymmetricKeyType !== 'rsa') {
      throw new Error(`Expected RSA private key, got ${privateKeyObject.asymmetricKeyType}`);
    }

    console.log('[JaaS] ✅ RSA private key confirmed');
  } catch (error) {
    console.error('[JaaS] ❌ Private key parsing FAILED:', error.message);
    privateKeyObject = null;
  }

  console.log('[JaaS] ===== PRIVATE KEY LOADING DONE =====');

} else {
  // FALLBACK: LOAD PRIVATE KEY FROM FILE
  try {
    const keyPath = path.join(__dirname, '..', 'jaas_private.pk');
    privateKey = fs.readFileSync(keyPath, 'utf8').trim();
    console.log('[JaaS] Private key loaded from file.');

    try {
      privateKeyObject = crypto.createPrivateKey({ key: privateKey, format: 'pem' });
      console.log('[JaaS] ✅ File private key parsed successfully. Type:', privateKeyObject.asymmetricKeyType);
    } catch (error) {
      console.error('[JaaS] ❌ File private key parsing FAILED:', error.message);
      privateKeyObject = null;
    }
  } catch (error) {
    console.warn('[JaaS] ❌ Private key not found in Env or File.');
  }
}

// =====================================================
// GENERATE JAAS JWT
// =====================================================

export const generateJaaSToken = (user, roomName, isModerator = false) => {
  const appId = process.env.JAAS_APP_ID;
  const kid = process.env.JAAS_API_KEY_ID;

  console.log('[JaaS-DEBUG] generateJaaSToken | appId:', appId ? 'SET' : 'MISSING',
    '| kid:', kid ? 'SET' : 'MISSING',
    '| privateKeyObject:', privateKeyObject ? 'SET' : 'MISSING');

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
    header: { kid: kid, typ: 'JWT' },
    expiresIn: '24h',
  };

  try {
    const token = jwt.sign(payload, privateKeyObject, options);
    console.log('[JaaS-DEBUG] ✅ JWT generated successfully. Length:', token.length);
    return token;
  } catch (error) {
    console.error('[JaaS-DEBUG] ❌ JWT signing FAILED:', error.message);
    throw error;
  }
};
