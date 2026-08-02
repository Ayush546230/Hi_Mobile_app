import cron from 'node-cron';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import { sendMeetingReminder } from './emailService.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

// ─── Calculate reminder trigger time (UTC) ──────────────────
function getReminderTriggerTime(meeting) {
  const start = new Date(meeting.startTime);
  const notif = meeting.notification || { amount: 30, unit: 'minutes before' };
  const amount = parseInt(notif.amount) || 30;

  let msOffset = 0;
  switch (notif.unit) {
    case 'minutes before': msOffset = amount * 60 * 1000; break;
    case 'hours before': msOffset = amount * 60 * 60 * 1000; break;
    case 'days before': msOffset = amount * 24 * 60 * 60 * 1000; break;
    case 'weeks before': msOffset = amount * 7 * 24 * 60 * 60 * 1000; break;
    default: msOffset = 30 * 60 * 1000;
  }

  return new Date(start.getTime() - msOffset);
}

// ─── Send Push Reminder via Firebase FCM ────────────────────
async function sendPushReminder(meeting, user) {
  if (!user.fcmToken) {
    console.warn(`🔔 Push skipped: No FCM token registered for user ${user.email}`);
    return;
  }

  const notif = meeting.notification || { amount: 30, unit: 'minutes before' };
  const timeText = `${notif.amount} ${notif.unit.replace(' before', '')}`;

  const message = {
    token: user.fcmToken,
    notification: {
      title: `Reminder: ${meeting.title}`,
      body: `Your video conference is starting in ${timeText}. Tap to join.`,
    },
    data: {
      type: 'meeting_reminder',
      meetingId: meeting._id.toString(),
      link: meeting.link || '',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'meeting_reminders',
        sound: 'default',
      },
    },
  };

  try {
    // Only send if firebase-admin is initialized
    if (admin.apps.length > 0) {
      await admin.messaging().send(message);
      console.log(`🔔 FCM reminder sent to ${user.email} for "${meeting.title}"`);
    } else {
      console.warn('🔔 FCM skipped: Firebase Admin has not been initialized yet.');
    }
  } catch (err) {
    console.error(`🔔 FCM reminder failed for ${user.email}:`, err.message);
  }
}

// ─── Process Reminders ──────────────────────────────────────
async function processReminders() {
  try {
    const now = new Date();

    // Find meetings that are scheduled, not yet reminded, and upcoming
    const pendingMeetings = await Meeting.find({
      status: 'scheduled',
      reminderSent: false,
      startTime: { $gt: now }, // Only future meetings
    });

    for (const meeting of pendingMeetings) {
      const triggerTime = getReminderTriggerTime(meeting);

      if (now >= triggerTime) {
        try {
          console.log(`⏰ Triggering reminder for "${meeting.title}" (starts at ${meeting.startTime})`);

          // Get the meeting owner
          const owner = await User.findById(meeting.userId);
          
          if (owner) {
            const notifType = meeting.notification?.type || 'As Notification';

            if (notifType === 'As Email') {
              // Send email to the owner
              await sendMeetingReminder(meeting.toJSON(), owner.email).catch(err =>
                console.error(`Email reminder failed for ${owner.email}:`, err.message)
              );
            } else {
              // Send push notification to owner
              await sendPushReminder(meeting, owner);
            }
          }

          // ALWAYS send email to all participants
          for (const p of meeting.participants) {
            if (p.email && (!owner || p.email !== owner.email)) {
              await sendMeetingReminder(meeting.toJSON(), p.email).catch(err =>
                console.error(`Email reminder failed for ${p.email}:`, err.message)
              );
            }
          }

          // Mark as reminded using updateOne to bypass full document validation
          await Meeting.updateOne({ _id: meeting._id }, { $set: { reminderSent: true } });
        } catch (innerErr) {
          console.error(`Reminder failed for meeting ${meeting._id}:`, innerErr);
          // Force update so we don't get stuck in an infinite loop
          await Meeting.updateOne({ _id: meeting._id }, { $set: { reminderSent: true } })
            .catch(e => console.error(`Failed to force update for meeting ${meeting._id}:`, e));
        }
      }
    }
  } catch (err) {
    console.error('Reminder scheduler error:', err);
  }
}

// ─── Auto-complete past meetings ────────────────────────────
async function autoCompleteMeetings() {
  try {
    const now = new Date();
    await Meeting.updateMany(
      {
        status: 'scheduled',
        endTime: { $lt: now },
      },
      { $set: { status: 'completed' } }
    );
  } catch (err) {
    console.error('Auto-complete error:', err);
  }
}

// ─── Start Scheduler ────────────────────────────────────────
export function startReminderScheduler() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await processReminders();
    await autoCompleteMeetings();
  });

  console.log('🕐 Reminder scheduler started (runs every 60 seconds)');
}
