import Meeting from '../models/Meeting.js';
import { sendMeetingInvite, sendMeetingCancellation } from '../services/emailService.js';
import { generateJaaSToken } from '../services/jaasService.js';
import { io } from '../server.js';

// ─── Helper: Generate room name ─────────────────────────────
function generateRoomName() {
  const adjectives = ['swift', 'bright', 'cool', 'keen', 'bold', 'calm', 'fair', 'glad', 'kind', 'warm'];
  const nouns = ['falcon', 'river', 'summit', 'cloud', 'spark', 'orbit', 'pulse', 'nexus', 'prism', 'forge'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}-${noun}-${num}`;
}

function generateMeetingId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

function getMeetingLink(roomName) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl}/meeting/${roomName}`;
}

// ─── GET /api/meetings ──────────────────────────────────────
export const getMeetings = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const now = new Date();
    
    // Base query: User is either the host or a participant
    const baseQuery = {
      $and: [
        {
          $or: [
            { userId: req.user._id },
            { 'participants.email': req.user.email }
          ]
        },
        { hiddenFor: { $ne: req.user._id } }
      ]
    };
    
    let timeQuery = {};
    let sortQuery = { createdAt: -1 };
    
    if (type === 'upcoming') {
      timeQuery = {
        $or: [
          { endTime: { $gte: now } },
          { endTime: { $exists: false }, startTime: { $gte: now } },
          { status: 'scheduled' } // Always show newly scheduled instant meetings that might have past start time momentarily
        ],
        status: { $ne: 'completed' },
        status: { $ne: 'cancelled' }
      };
      // Wait, MongoDB object keys cannot be duplicated in object literals.
      timeQuery = {
        $and: [
          {
            $or: [
              { endTime: { $gte: now } },
              { endTime: { $exists: false }, startTime: { $gte: now } },
              { hostJoined: true, status: { $ne: 'completed' } } // If host joined and it's active
            ]
          },
          { status: { $nin: ['completed', 'cancelled'] } }
        ]
      };
      sortQuery = { startTime: 1 };
    } else if (type === 'history') {
      timeQuery = {
        $or: [
          { endTime: { $lt: now } },
          { endTime: { $exists: false }, startTime: { $lt: now }, hostJoined: false },
          { status: { $in: ['completed', 'cancelled'] } }
        ]
      };
      sortQuery = { startTime: -1 };
    }
    
    const finalQuery = type ? { $and: [baseQuery, timeQuery] } : baseQuery;
    
    const [meetings, total] = await Promise.all([
      Meeting.find(finalQuery).sort(sortQuery).skip(skip).limit(limitNum),
      Meeting.countDocuments(finalQuery)
    ]);
    
    res.json({ 
      meetings,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total
      }
    });
  } catch (err) {
    console.error('Get meetings error:', err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
};

// ─── GET /api/meetings/room/:roomName ───────────────────────
export const getMeetingByRoomName = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomName: req.params.roomName });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    
    res.json({ 
      meeting: {
        id: meeting._id,
        type: meeting.type,
        title: meeting.title,
        status: meeting.status,
        hostJoined: meeting.hostJoined,
        isPrivate: meeting.isPrivate,
        isConsultation: meeting.isConsultation,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        userId: meeting.userId,
        participants: meeting.participants
      } 
    });
  } catch (err) {
    console.error('Get meeting by room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── GET /api/meetings/room/:roomName/token ─────────────────
export const getJaaSToken = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomName: req.params.roomName });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Determine if the requesting user is the host
    const isHost = meeting.userId.toString() === req.user._id.toString();

    // Generate the JaaS token
    const token = generateJaaSToken(req.user, req.params.roomName, isHost);
    
    res.json({ token });
  } catch (err) {
    console.error('Get JaaS token error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate token' });
  }
};

// ─── POST /api/meetings ─────────────────────────────────────
export const createMeeting = async (req, res) => {
  try {
    const {
      title, description, startTime, endTime, participants,
      timezone, notification, type, recurrence, recurrenceCount, isPrivate, isConsultation
    } = req.body;

    const roomName = generateRoomName();
    const link = getMeetingLink(roomName);

    const meetingsToCreate = [];
    const count = (recurrence === 'daily' || recurrence === 'weekly') ? (recurrenceCount || 2) : 1;
    
    for (let i = 0; i < count; i++) {
      let currentStartTime = startTime ? new Date(startTime) : new Date();
      let currentEndTime = endTime ? new Date(endTime) : undefined;
      
      if (i > 0) {
        const daysToAdd = recurrence === 'daily' ? i : (recurrence === 'weekly' ? i * 7 : 0);
        currentStartTime.setDate(currentStartTime.getDate() + daysToAdd);
        if (currentEndTime) {
          currentEndTime.setDate(currentEndTime.getDate() + daysToAdd);
        }
      }
      
      meetingsToCreate.push({
        userId: req.user._id,
        type: type === 'instant' ? 'instant' : 'scheduled',
        title: title || (type === 'instant' ? 'Instant Meeting' : 'Scheduled Meeting'),
        roomName,
        link,
        startTime: currentStartTime,
        endTime: currentEndTime,
        timezone: timezone || 'Asia/Kolkata',
        description,
        participants: participants || [],
        status: 'scheduled',
        isPrivate: isPrivate || false,
        isConsultation: isConsultation || false,
        notification: notification || { amount: 30, unit: 'minutes before', type: 'As Notification' },
        hostJoined: type === 'instant' ? true : false,
      });
    }

    const createdMeetings = await Meeting.insertMany(meetingsToCreate);

    // Send email invitations to all participants (non-blocking)
    if (participants && participants.length > 0) {
      for (const meeting of createdMeetings) {
        const meetingData = meeting.toJSON();
        for (const p of participants) {
          if (p.email) {
            io.to(`dashboard-${p.email.toLowerCase()}`).emit('dashboard-update');
            sendMeetingInvite(meetingData, p.email, req.user.name || 'Someone').catch(err =>
              console.error(`Failed to send invite to ${p.email}:`, err.message)
            );
          }
        }
      }
    }

    res.status(201).json({ meeting: createdMeetings[0].toJSON() });
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
};

// ─── PUT /api/meetings/:id ──────────────────────────────────
export const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, userId: req.user._id });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const { title, description, status, duration, startTime, endTime, hostJoined } = req.body;

    const isCancelling = status === 'cancelled' && meeting.status !== 'cancelled';

    if (title !== undefined) meeting.title = title;
    if (description !== undefined) meeting.description = description;
    if (status !== undefined) meeting.status = status;
    if (duration !== undefined) meeting.duration = duration;
    if (startTime !== undefined) meeting.startTime = new Date(startTime);
    if (endTime !== undefined) {
      meeting.endTime = new Date(endTime);
      if (meeting.isConsultation) {
        io.to(meeting.roomName).emit('consultation-extended', meeting.endTime);
      }
    }
    
    if (hostJoined !== undefined) {
      meeting.hostJoined = hostJoined;
      if (hostJoined === true) {
        io.to(meeting.roomName).emit('host-joined');
      }
    }

    await meeting.save();

    // If meeting is marked as completed, notify all clients in the room via WebSocket
    if (status === 'completed') {
      io.to(meeting.roomName).emit('meeting-ended');
    }

    // Send cancellation emails
    if (isCancelling && meeting.participants && meeting.participants.length > 0) {
      const meetingData = meeting.toJSON();
      const senderName = req.user.name || req.user.email || 'The Host';
      for (const p of meeting.participants) {
        if (p.email) {
          sendMeetingCancellation(meetingData, p.email, senderName).catch(err =>
            console.error(`Failed to send cancellation to ${p.email}:`, err.message)
          );
        }
      }
    }

    // Notify participants via WebSocket to update their dashboards
    if (meeting.participants && meeting.participants.length > 0) {
      meeting.participants.forEach(p => {
        if (p.email) io.to(`dashboard-${p.email.toLowerCase()}`).emit('dashboard-update');
      });
    }

    res.json({ meeting: meeting.toJSON() });
  } catch (err) {
    console.error('Update meeting error:', err);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
};

// ─── DELETE /api/meetings/:id ───────────────────────────────
export const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { 'participants.email': req.user.email }
      ]
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    
    if (!meeting.hiddenFor.includes(req.user._id)) {
      meeting.hiddenFor.push(req.user._id);
      await meeting.save();
    }
    
    res.json({ message: 'Meeting deleted from your history' });
  } catch (err) {
    console.error('Delete meeting error:', err);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
};

// ─── POST /api/meetings/:id/invite ──────────────────────────
export const sendInvites = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, userId: req.user._id });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const { emails } = req.body; // optional additional emails
    const recipients = [];
    let updatedParticipants = false;

    // Add meeting participants
    if (meeting.participants && meeting.participants.length > 0) {
      meeting.participants.forEach(p => { if (p.email) recipients.push(p.email); });
    }

    // Add extra emails from request body
    if (emails && Array.isArray(emails)) {
      emails.forEach(e => { 
        if (e && !recipients.includes(e)) {
          recipients.push(e); 
          meeting.participants.push({ name: e.split('@')[0], email: e });
          updatedParticipants = true;
        } 
      });
    }

    if (updatedParticipants) {
      await meeting.save();
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients to send invites to' });
    }

    const senderName = req.user.name || req.user.email;
    const results = [];

    for (const email of recipients) {
      try {
        io.to(`dashboard-${email.toLowerCase()}`).emit('dashboard-update');
        await sendMeetingInvite(meeting.toJSON(), email, senderName);
        results.push({ email, status: 'sent' });
      } catch (err) {
        results.push({ email, status: 'failed', error: err.message });
      }
    }

    res.json({ message: 'Invites processed', results });
  } catch (err) {
    console.error('Send invites error:', err);
    res.status(500).json({ error: 'Failed to send invites' });
  }
};

// ─── DELETE /api/meetings/history/clear ────────────────────
export const clearHistory = async (req, res) => {
  try {
    await Meeting.updateMany(
      {
        $or: [
          { userId: req.user._id },
          { 'participants.email': req.user.email }
        ],
        hiddenFor: { $ne: req.user._id }
      },
      { $push: { hiddenFor: req.user._id } }
    );

    res.json({ message: 'History cleared successfully' });
  } catch (err) {
    console.error('Clear history error:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
};
