import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getProfile, updateProfile, updatePreferences } from '../controllers/userController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/preferences', updatePreferences);

export default router;
