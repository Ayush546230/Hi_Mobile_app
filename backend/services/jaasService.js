import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let privateKeyObject = null;

// =====================================================
// LOAD JAAS PRIVATE KEY
// =====================================================

function loadPrivateKey(raw) {
  // Strip surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }

  // Convert literal \n to real newlines (handles single-line stored keys)
  if (raw.includes('\\n')) {
    raw = raw.replace(/\\n/g, '\n');
  }

  // Remove CR characters
  raw = raw.replace(/\r/g, '').trim();

  console.log('[JaaS] Key length:', raw.length, '| Has BEGIN:', raw.includes('-----BEGIN PRIVATE KEY-----'));

  // Extract base64 content
  const base64Content = raw
    .replace(/-----BEGIN[^-]*-----/g, '')
    .replace(/-----END[^-]*-----/g, '')
    .replace(/[\s\r\n]+/g, '');

  const derBuffer = Buffer.from(base64Content, 'base64');
  console.log('[JaaS] DER length:', derBuffer.length);
  console.log('[JaaS] DER OID bytes (9-19):', derBuffer.slice(9, 20).toString('hex'));

  // =====================================================
  // FIX NON-STANDARD OID
  // The key has OID 1.2.840.113549.1.1.5 (sha1WithRSAEncryption)
  // But PKCS8 requires OID 1.2.840.113549.1.1.1 (rsaEncryption)
  // This is a 1-byte fix: byte[19] = 0x05 → 0x01
  // =====================================================
  if (
    derBuffer.length > 20 &&
    derBuffer[9]  === 0x06 &&  // OID tag
    derBuffer[10] === 0x09 &&  // OID length = 9
    derBuffer[11] === 0x2A &&  // 1.2...
    derBuffer[12] === 0x86 &&
    derBuffer[13] === 0x48 &&
    derBuffer[14] === 0x86 &&
    derBuffer[15] === 0xF7 &&  // .840...
    derBuffer[16] === 0x0D &&  // .113549...
    derBuffer[17] === 0x01 &&
    derBuffer[18] === 0x01 &&
    derBuffer[19] === 0x05    // sha1WithRSAEncryption (WRONG) → need 0x01 (rsaEncryption)
  ) {
    console.log('[JaaS] ⚠️ Non-standard OID detected (sha1WithRSAEncryption). Patching to rsaEncryption...');
    derBuffer[19] = 0x01;
    console.log('[JaaS] OID patched. New bytes:', derBuffer.slice(9, 20).toString('hex'));
  } else {
    console.log('[JaaS] OID check passed or unexpected format. Byte[19]:', derBuffer[19]?.toString(16));
  }

  // Create KeyObject from patched DER
  try {
    const keyObj = crypto.createPrivateKey({ key: derBuffer, format: 'der', type: 'pkcs8' });
    console.log('[JaaS] ✅ KeyObject created! asymmetricKeyType:', keyObj.asymmetricKeyType);
    return keyObj;
  } catch (e) {
    console.error('[JaaS] ❌ DER KeyObject failed:', e.message, '— trying PEM fallback...');
    // Fallback: try using the PEM string directly
    try {
      const keyObj = crypto.createPrivateKey({ key: raw, format: 'pem' });
      console.log('[JaaS] ✅ PEM fallback succeeded!');
      return keyObj;
    } catch (e2) {
      console.error('[JaaS] ❌ PEM fallback also failed:', e2.message);
      return null;
    }
  }
}

if (process.env.JAAS_PRIVATE_KEY) {
  console.log('[JaaS] Loading private key from environment...');
  privateKeyObject = loadPrivateKey(process.env.JAAS_PRIVATE_KEY);
} else {
  try {
    const keyPath = path.join(__dirname, '..', 'jaas_private.pk');
    const fileKey = fs.readFileSync(keyPath, 'utf8');
    console.log('[JaaS] Loading private key from file...');
    privateKeyObject = loadPrivateKey(fileKey);
  } catch (error) {
    console.warn('[JaaS] ❌ Private key not found in env or file.');
  }
}

// =====================================================
// GENERATE JAAS JWT
// =====================================================

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
    header: { kid, typ: 'JWT' },
    expiresIn: '24h',
  };

  const token = jwt.sign(payload, privateKeyObject, options);
  console.log('[JaaS] ✅ JWT signed successfully. Length:', token.length);
  return token;
};
