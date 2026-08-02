import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  clearHistory,
  sendInvites,
  getMeetingByRoomName,
  getJaaSToken,
} from '../controllers/meetingController.js';

const router = express.Router();

// Public route for guests
router.get('/room/:roomName', getMeetingByRoomName);

// All routes below require authentication
router.use(authenticateToken);

router.get('/room/:roomName/token', getJaaSToken);

router.get('/', getMeetings);
router.post('/', createMeeting);
router.put('/:id', updateMeeting);
router.delete('/history/clear', clearHistory);
router.delete('/:id', deleteMeeting);
router.post('/:id/invite', sendInvites);

export default router;
