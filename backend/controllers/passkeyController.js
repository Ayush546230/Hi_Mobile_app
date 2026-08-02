import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import crypto from 'crypto';
import User from '../models/User.js';
import Challenge from '../models/Challenge.js';
import { generateToken } from '../middleware/auth.js';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'Auth Showcase';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://video-conferencing-website-one.vercel.app';

// ─── REGISTRATION ──────────────────────────────────────────

/**
 * Step 1: Generate registration challenge
 */
export const generateRegisterOptions = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user record
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        authMethods: {},
      });
      await user.save();
    }

    // Get existing credential IDs to exclude (prevent re-registering same device)
    const excludeCredentials = user.passkeys.map((pk) => ({
      id: pk.credentialID,
      type: 'public-key',
      transports: pk.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(user._id.toString())),
      userName: user.email,
      userDisplayName: user.name || user.email,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Store challenge in database (stateless verification for mobile apps)
    const challengeId = crypto.randomUUID();
    await Challenge.create({
      challengeId,
      challenge: options.challenge,
      userId: user._id.toString(),
      type: 'registration',
    });

    res.json({ options, challengeId });
  } catch (err) {
    console.error('Generate register options error:', err);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
};

/**
 * Step 2: Verify registration response from authenticator
 */
export const verifyRegister = async (req, res) => {
  try {
    const { response, passkeyName, challengeId } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: 'challengeId is required for mobile passkey verification' });
    }

    // Retrieve challenge from database
    const challengeDoc = await Challenge.findOne({ challengeId, type: 'registration' });
    if (!challengeDoc) {
      return res.status(400).json({ error: 'No registration challenge found or it has expired. Please try again.' });
    }

    const expectedChallenge = challengeDoc.challenge;
    const userId = challengeDoc.userId;

    // Delete used challenge
    await Challenge.deleteOne({ challengeId });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const expectedOrigins = [ORIGIN];
    const apkHashHex = (process.env.ANDROID_SHA256 || '').replace(/:/g, '');
    if (apkHashHex) {
      const apkHashBase64 = Buffer.from(apkHashHex, 'hex').toString('base64url');
      expectedOrigins.push(`android:apk-key-hash:${apkHashBase64}`);
    }

    // Verify with SimpleWebAuthn
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return res.status(400).json({ error: 'Registration verification failed' });
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp,
    } = registrationInfo;

    // Check for duplicate credential
    const existingPasskey = user.passkeys.find(
      (pk) => pk.credentialID === credentialID
    );
    if (existingPasskey) {
      return res.status(409).json({ error: 'This passkey is already registered' });
    }

    // Save the new passkey
    user.passkeys.push({
      credentialID,
      credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey),
      counter: counter || 0,
      credentialDeviceType,
      credentialBackedUp,
      transports: response.response?.transports || [],
      aaguid: registrationInfo.aaguid,
      name: passkeyName || 'Mobile Passkey',
    });

    user.authMethods.passkey = true;
    user.lastLoginAt = new Date();
    user.lastLoginMethod = 'passkey';
    user.loginCount = (user.loginCount || 0) + 1;

    await user.save();

    const token = generateToken(user._id.toString());

    res.json({
      verified: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
        passkeys: user.passkeys,
        loginCount: user.loginCount,
      },
    });
  } catch (err) {
    console.error('Verify register error:', err);
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
};

// ─── AUTHENTICATION ────────────────────────────────────────

/**
 * Step 1: Generate authentication challenge
 */
export const generateAuthOptions = async (req, res) => {
  try {
    const { email } = req.body;

    let allowCredentials = [];

    if (email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((pk) => ({
          id: pk.credentialID,
          type: 'public-key',
          transports: pk.transports,
        }));
      }
    }

    const authOptions = {
      timeout: 60000,
      userVerification: 'preferred',
      rpID: RP_ID,
      allowCredentials,
    };

    const options = await generateAuthenticationOptions(authOptions);

    if (options.allowCredentials && options.allowCredentials.length === 0) {
      delete options.allowCredentials;
    }

    // Store challenge in database
    const challengeId = crypto.randomUUID();
    await Challenge.create({
      challengeId,
      challenge: options.challenge,
      email: email ? email.toLowerCase() : undefined,
      type: 'authentication',
    });

    res.json({ options, challengeId });
  } catch (err) {
    console.error('Generate auth options error:', err);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
};

/**
 * Step 2: Verify authentication response
 */
export const verifyAuth = async (req, res) => {
  try {
    const { response, challengeId } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: 'challengeId is required for mobile passkey verification' });
    }

    // Retrieve challenge from database
    const challengeDoc = await Challenge.findOne({ challengeId, type: 'authentication' });
    if (!challengeDoc) {
      return res.status(400).json({ error: 'No auth challenge found or it has expired. Please try again.' });
    }

    const expectedChallenge = challengeDoc.challenge;
    const challengeEmail = challengeDoc.email;

    // Delete used challenge
    await Challenge.deleteOne({ challengeId });

    // Find user by credential ID (works for both email-based and discoverable)
    const credentialID = response.id;
    let user;

    if (challengeEmail) {
      user = await User.findOne({
        email: challengeEmail,
        'passkeys.credentialID': credentialID,
      });
    } else {
      user = await User.findOne({ 'passkeys.credentialID': credentialID });
    }

    if (!user) {
      return res.status(404).json({ error: 'Passkey not found. Please register first.' });
    }

    const passkey = user.passkeys.find((pk) => pk.credentialID === credentialID);
    if (!passkey) {
      return res.status(404).json({ error: 'Passkey not found' });
    }

    const expectedOrigins = [ORIGIN];
    const apkHashHex = (process.env.ANDROID_SHA256 || '').replace(/:/g, '');
    if (apkHashHex) {
      const apkHashBase64 = Buffer.from(apkHashHex, 'hex').toString('base64url');
      expectedOrigins.push(`android:apk-key-hash:${apkHashBase64}`);
    }

    // Verify with SimpleWebAuthn
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: passkey.credentialID,
        credentialPublicKey: isoBase64URL.toBuffer(passkey.credentialPublicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      requireUserVerification: true,
    });

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      return res.status(401).json({ error: 'Authentication verification failed' });
    }

    // Update counter (prevents replay attacks)
    passkey.counter = authenticationInfo.newCounter;
    passkey.lastUsedAt = new Date();

    user.lastLoginAt = new Date();
    user.lastLoginMethod = 'passkey';
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const token = generateToken(user._id.toString());

    res.json({
      verified: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        authMethods: user.authMethods,
        loginCount: user.loginCount,
      },
    });
  } catch (err) {
    console.error('Verify auth error:', err);
    res.status(401).json({ error: 'Authentication failed: ' + err.message });
  }
};

/**
 * Delete a passkey
 */
export const deletePasskey = async (req, res) => {
  try {
    const { credentialID } = req.params;
    const user = req.user;

    const fullUser = await User.findById(user._id);
    const passkeyIndex = fullUser.passkeys.findIndex(
      (pk) => pk.credentialID === credentialID
    );

    if (passkeyIndex === -1) {
      return res.status(404).json({ error: 'Passkey not found' });
    }

    fullUser.passkeys.splice(passkeyIndex, 1);

    if (fullUser.passkeys.length === 0) {
      fullUser.authMethods.passkey = false;
    }

    await fullUser.save();

    res.json({ success: true, message: 'Passkey removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete passkey' });
  }
};
