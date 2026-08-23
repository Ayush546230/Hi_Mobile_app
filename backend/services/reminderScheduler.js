import cron from 'node-cron';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import { sendMeetingReminder, sendMeetingInvite } from './emailService.js';
import admin from 'firebase-admin';
import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCxnaLatVz56iGkM6Z96xjUTi7nR8hIWXIERFlZ2_ZbUWTObDWdbFbbAj2PV-ADaf3hBOX1PJwcC21avnMwaQTo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DOZ39UJVR-sJTsrufyuPiAWJ6WOyZQu12d89XO6eBTY';

webpush.setVapidDetails(
  'mailto:admin@hi-app.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

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
  if (user.preferences?.notifications === false) {
    console.log(`🔔 Push reminder skipped: User ${user.email} has disabled reminders.`);
    return;
  }

  const notif = meeting.notification || { amount: 30, unit: 'minutes before' };
  const timeText = `${notif.amount} ${notif.unit.replace(' before', '')}`;
  const hasSounds = user.preferences?.soundEffects !== false;

  // 1. Send FCM Push Notification (Mobile)
  if (user.fcmToken) {
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
          channelId: hasSounds ? 'meeting_reminders' : 'meeting_reminders_silent',
          sound: hasSounds ? 'default' : undefined,
        },
      },
    };

    try {
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

  // 2. Send Web Push Notification (Browser)
  if (user.webPushSubscription) {
    const payload = JSON.stringify({
      title: `Meeting Reminder: ${meeting.title}`,
      body: `Your video conference is starting in ${timeText}. Tap to join.`,
      tag: `meeting-reminder-${meeting._id}`,
      actions: [
        { action: 'join', title: 'Join' },
        { action: 'cancel', title: 'Cancel' }
      ],
      data: {
        url: `/meeting/${meeting.roomName}`,
      },
    });

    try {
      await webpush.sendNotification(user.webPushSubscription, payload);
      console.log(`🔔 Web Push reminder sent to ${user.email} for "${meeting.title}"`);
    } catch (webPushErr) {
      console.error(`🔔 Web Push reminder failed for ${user.email}:`, webPushErr.message);
      if (webPushErr.statusCode === 410 || webPushErr.statusCode === 404) {
        user.webPushSubscription = undefined;
        await user.save();
      }
    }
  }

  if (!user.fcmToken && !user.webPushSubscription) {
    console.warn(`🔔 Push skipped: No FCM token or Web Push subscription registered for user ${user.email}`);
  }
}

// ─── Process Delayed Invitations (Sent 6 hours before meeting) ───
async function processDelayedInvites() {
  try {
    const now = new Date();
    // 6 hours in milliseconds = 6 * 60 * 60 * 1000 = 21,600,000 ms
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Find meetings that are scheduled, invite not yet sent, and starting within the next 6 hours
    const pendingInvites = await Meeting.find({
      status: 'scheduled',
      inviteSent: false,
      startTime: { $lte: sixHoursLater },
    });

    for (const meeting of pendingInvites) {
      try {
        console.log(`✉️ Triggering delayed invitation email for "${meeting.title}" (starts at ${meeting.startTime})`);

        // Get the meeting owner (sender)
        const owner = await User.findById(meeting.userId);
        const senderName = owner ? (owner.name || 'Someone') : 'Someone';

        // Send email invitations to all participants
        if (meeting.participants && meeting.participants.length > 0) {
          for (const p of meeting.participants) {
            if (p.email) {
              await sendMeetingInvite(meeting.toJSON(), p.email, senderName).catch(err =>
                console.error(`Delayed invite email failed for ${p.email}:`, err.message)
              );
            }
          }
        }

        // Mark as invite sent
        await Meeting.updateOne({ _id: meeting._id }, { $set: { inviteSent: true } });
      } catch (innerErr) {
        console.error(`Delayed invitation failed for meeting ${meeting._id}:`, innerErr);
        // Force update to prevent infinite loops on error
        await Meeting.updateOne({ _id: meeting._id }, { $set: { inviteSent: true } })
          .catch(e => console.error(`Failed to force update inviteSent for ${meeting._id}:`, e));
      }
    }
  } catch (err) {
    console.error('Delayed invitation scheduler error:', err);
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
            const remindersEnabled = owner.preferences?.notifications !== false;

            if (remindersEnabled) {
              if (notifType === 'As Email') {
                // Send email to the owner
                await sendMeetingReminder(meeting.toJSON(), owner.email).catch(err =>
                  console.error(`Email reminder failed for ${owner.email}:`, err.message)
                );
              } else {
                // Send push notification to owner
                await sendPushReminder(meeting, owner);
              }
            } else {
              console.log(`⏰ Reminder skipped: Meeting owner ${owner.email} has disabled reminders.`);
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
    await processDelayedInvites();
    await processReminders();
    await autoCompleteMeetings();
  });

  console.log('🕐 Reminder scheduler started (runs every 60 seconds)');
}
