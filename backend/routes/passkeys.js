import express from 'express';
import {
  generateRegisterOptions,
  verifyRegister,
  generateAuthOptions,
  verifyAuth,
  deletePasskey,
} from '../controllers/passkeyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Registration (add a passkey) ──────────────────────────
// POST /api/passkeys/register/options   → get challenge
router.post('/register/options', generateRegisterOptions);

// POST /api/passkeys/register/verify    → verify & save passkey
router.post('/register/verify', verifyRegister);

// ─── Authentication (login with passkey) ───────────────────
// POST /api/passkeys/auth/options       → get challenge
router.post('/auth/options', generateAuthOptions);

// POST /api/passkeys/auth/verify        → verify & issue JWT
router.post('/auth/verify', verifyAuth);

// ─── Manage passkeys (protected) ───────────────────────────
// DELETE /api/passkeys/:credentialID    → remove passkey
router.delete('/:credentialID', authenticateToken, deletePasskey);

export default router;
