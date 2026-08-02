import dotenv from 'dotenv';
dotenv.config();

// ─── Brevo API Helper ─────────────────────────────────────────
async function sendBrevoEmail(payload) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('⚠️  BREVO_API_KEY not configured. Email sending is disabled.');
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API Error:', errorData);
    } else {
      const data = await response.json();
      console.log('📧 Brevo Email sent successfully, messageId:', data.messageId);
    }
  } catch (error) {
    console.error('Failed to send email via Brevo API:', error);
  }
}

// ─── HTML Email Template ────────────────────────────────────
function getMeetingInviteHTML(meeting, senderName) {
  const startDate = new Date(meeting.startTime).toLocaleString('en-IN', {
    timeZone: meeting.timezone || 'Asia/Kolkata',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  const endDate = meeting.endTime
    ? new Date(meeting.endTime).toLocaleString('en-IN', {
        timeZone: meeting.timezone || 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      })
    : null;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
  <div style="background: #1a1a2e; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
    <img src="${frontendUrl}/Hi_Logo.png" alt="hi logo" style="max-height: 50px; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));" />
    <br/>
    <img src="${frontendUrl}/powered_by_aiRender.png" alt="powered by aiRender" style="max-height: 24px; opacity: 0.9;" />
  </div>
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e; margin: 0 0 8px;">Meeting Invitation</h2>
    <p style="color: #666; margin: 0 0 24px;">${senderName} has invited you to a meeting</p>
    
    <div style="background: #f8f9ff; border-left: 4px solid #6c63ff; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <h3 style="color: #1a1a2e; margin: 0 0 12px; font-size: 18px;">${meeting.title}</h3>
      <p style="margin: 4px 0; color: #444;">Date & Time: ${startDate}${endDate ? ` — ${endDate}` : ''}</p>
      ${meeting.description ? `<p style="margin: 8px 0 0; color: #666; font-style: italic;">Description: ${meeting.description}</p>` : ''}
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${meeting.link}" style="display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #5a52d5 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Join Video Conference
      </a>
    </div>

    <div style="background: #f0f0f0; border-radius: 8px; padding: 12px 16px; margin-top: 16px;">
      <p style="margin: 0; color: #888; font-size: 13px;">Meeting Link:</p>
      <p style="margin: 4px 0 0; word-break: break-all; color: #6c63ff; font-size: 13px;">${meeting.link}</p>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #aaa; font-size: 11px; text-align: center; margin: 0;">
      This invitation was sent via <strong>hi</strong> — Premium Video Conferencing by aiRender
    </p>
  </div>
</body>
</html>`;
}

function getMeetingReminderHTML(meeting) {
  const startDate = new Date(meeting.startTime).toLocaleString('en-IN', {
    timeZone: meeting.timezone || 'Asia/Kolkata',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  const notif = meeting.notification || { amount: 30, unit: 'minutes before' };
  const timeText = `${notif.amount} ${notif.unit.replace(' before', '')}`;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
  <div style="background: #1a1a2e; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
    <img src="${frontendUrl}/Hi_Logo.png" alt="hi logo" style="max-height: 50px; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));" />
    <br/>
    <img src="${frontendUrl}/powered_by_aiRender.png" alt="powered by aiRender" style="max-height: 24px; opacity: 0.9;" />
  </div>
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e; margin: 0 0 8px;">Meeting Reminder</h2>
    <p style="color: #666; font-size: 16px; margin: 0 0 24px;">This is an automated reminder that your scheduled video conference will begin in <strong>${timeText}</strong>.</p>
    
    <div style="background: #fff5f5; border-left: 4px solid #ff6b6b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <h3 style="color: #1a1a2e; margin: 0 0 12px; font-size: 18px;">${meeting.title}</h3>
      <p style="margin: 4px 0; color: #444;">Scheduled Time: ${startDate}</p>
      ${meeting.description ? `<p style="margin: 8px 0 0; color: #666; font-style: italic;">Description: ${meeting.description}</p>` : ''}
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${meeting.link}" style="display: inline-block; background: linear-gradient(135deg, #00c853 0%, #009624 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Join Now
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #aaa; font-size: 11px; text-align: center; margin: 0;">
      This reminder was sent via <strong>hi</strong> — Premium Video Conferencing by aiRender
    </p>
  </div>
</body>
</html>`;
}

// ─── Generate ICS content ───────────────────────────────────
function generateICS(meeting, senderName) {
  const fmtDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = fmtDate(meeting.startTime);
  const end = meeting.endTime ? fmtDate(meeting.endTime) : fmtDate(new Date(new Date(meeting.startTime).getTime() + 3600000));
  const dtStamp = fmtDate(new Date());
  const uid = meeting._id ? meeting._id.toString() : `meeting-${new Date().getTime()}`;
  const senderEmail = process.env.SMTP_USER || 'ayush.airender@gmail.com';

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hi by aiRender//Video Conference//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `ORGANIZER;CN="${senderName}":mailto:${senderEmail}`,
    `SEQUENCE:0`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${meeting.title}`,
    `DESCRIPTION:Join: ${meeting.link}`,
    `URL:${meeting.link}`,
    `LOCATION:${meeting.link}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

// ─── Send Meeting Invite ────────────────────────────────────
export async function sendMeetingInvite(meeting, recipientEmail, senderName) {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`📧 Email skipped (Brevo API not configured): Invite to ${recipientEmail} for "${meeting.title}"`);
    return;
  }

  const icsContent = generateICS(meeting, senderName);
  const senderEmail = process.env.SMTP_USER || 'ayush.airender@gmail.com';

  const payload = {
    sender: { name: 'hi Video', email: senderEmail },
    to: [{ email: recipientEmail }],
    subject: `Meeting Invitation: ${meeting.title}`,
    htmlContent: getMeetingInviteHTML(meeting, senderName),
    attachment: [{
      name: 'invite.ics',
      content: Buffer.from(icsContent).toString('base64')
    }]
  };

  await sendBrevoEmail(payload);
}

// ─── Send Meeting Reminder ──────────────────────────────────
export async function sendMeetingReminder(meeting, recipientEmail) {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`📧 Reminder skipped (Brevo API not configured): to ${recipientEmail} for "${meeting.title}"`);
    return;
  }
  
  const senderEmail = process.env.SMTP_USER || 'ayush.airender@gmail.com';

  const payload = {
    sender: { name: 'hi Video', email: senderEmail },
    to: [{ email: recipientEmail }],
    subject: `Reminder: ${meeting.title} is starting soon`,
    htmlContent: getMeetingReminderHTML(meeting),
  };

  await sendBrevoEmail(payload);
}

// ─── HTML Cancellation Email Template ───────────────────────
function getMeetingCancellationHTML(meeting, senderName) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
  <div style="background: #1a1a2e; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
    <img src="${frontendUrl}/Hi_Logo.png" alt="hi logo" style="max-height: 50px; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));" />
    <br/>
    <img src="${frontendUrl}/powered_by_aiRender.png" alt="powered by aiRender" style="max-height: 24px; opacity: 0.9;" />
  </div>
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e; margin: 0 0 8px;">Meeting Cancelled</h2>
    <p style="color: #666; margin: 0 0 24px;">${senderName} has cancelled the following scheduled meeting.</p>
    
    <div style="background: #f8f9ff; border-left: 4px solid #475569; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <h3 style="color: #1a1a2e; margin: 0 0 12px; font-size: 18px; text-decoration: line-through;">${meeting.title}</h3>
      <p style="margin: 4px 0; color: #888;">This event has been removed from your calendar.</p>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #aaa; font-size: 11px; text-align: center; margin: 0;">
      This notification was sent via <strong>hi</strong> — Premium Video Conferencing by aiRender
    </p>
  </div>
</body>
</html>`;
}

// ─── Generate ICS Cancellation ──────────────────────────────
function generateICSCancellation(meeting, senderName) {
  const fmtDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = fmtDate(meeting.startTime);
  const end = meeting.endTime ? fmtDate(meeting.endTime) : fmtDate(new Date(new Date(meeting.startTime).getTime() + 3600000));
  const dtStamp = fmtDate(new Date());
  const uid = meeting._id ? meeting._id.toString() : `meeting-${new Date().getTime()}`;
  const senderEmail = process.env.SMTP_USER || 'ayush.airender@gmail.com';

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hi by aiRender//Video Conference//EN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `ORGANIZER;CN="${senderName}":mailto:${senderEmail}`,
    `SEQUENCE:1`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${start}`, `DTEND:${end}`,
    `STATUS:CANCELLED`,
    `SUMMARY:Cancelled: ${meeting.title}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

// ─── Send Meeting Cancellation ──────────────────────────────
export async function sendMeetingCancellation(meeting, recipientEmail, senderName) {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`📧 Email skipped (Brevo API not configured): Cancellation to ${recipientEmail} for "${meeting.title}"`);
    return;
  }

  const icsContent = generateICSCancellation(meeting, senderName);
  const senderEmail = process.env.SMTP_USER || 'ayush.airender@gmail.com';

  const payload = {
    sender: { name: 'hi Video', email: senderEmail },
    to: [{ email: recipientEmail }],
    subject: `Cancelled: ${meeting.title}`,
    htmlContent: getMeetingCancellationHTML(meeting, senderName),
    attachment: [{
      name: 'cancel.ics',
      content: Buffer.from(icsContent).toString('base64')
    }]
  };

  await sendBrevoEmail(payload);
}
