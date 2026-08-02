import type { Meeting } from '../types';

export function generateICSFile(meeting: Meeting): string {
  const start = new Date(meeting.startTime);
  const end = meeting.endTime ? new Date(meeting.endTime) : new Date(start.getTime() + 60 * 60 * 1000);

  const fmtDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const attendees = meeting.participants
    .map((p) => `ATTENDEE;CN=${p.name}:mailto:${p.email}`)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AiRender//Video Conference//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmtDate(start)}`,
    `DTEND:${fmtDate(end)}`,
    `SUMMARY:${meeting.title}`,
    `DESCRIPTION:Join: ${meeting.link}\\n${meeting.description || ''}`,
    `URL:${meeting.link}`,
    `LOCATION:${meeting.link}`,
    attendees,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(meeting: Meeting): void {
  const ics = generateICSFile(meeting);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meeting.title.replace(/\s+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getEmailInviteUrl(meeting: Meeting): string {
  const subject = encodeURIComponent(`Meeting Invitation: ${meeting.title}`);
  const body = encodeURIComponent(
    `You are invited to a video conference.\n\n` +
    `Title: ${meeting.title}\n` +
    `Date & Time: ${new Date(meeting.startTime).toLocaleString()}\n` +
    (meeting.description ? `Description: ${meeting.description}\n` : '') +
    `\nMeeting Link: ${meeting.link}\n\n` +
    `This invitation was sent via hi — Premium Video Conferencing by aiRender`
  );
  return `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
}

export function getWhatsAppShareUrl(meeting: Meeting): string {
  const text = encodeURIComponent(
    `Join my video conference on hi!\nTitle: ${meeting.title}\nTime: ${new Date(meeting.startTime).toLocaleString()}\n\nLink: ${meeting.link}`
  );
  return `https://wa.me/?text=${text}`;
}

export function getTelegramShareUrl(meeting: Meeting): string {
  const text = encodeURIComponent(
    `Join my video conference on hi!\nTitle: ${meeting.title}\nTime: ${new Date(meeting.startTime).toLocaleString()}\n\nLink: ${meeting.link}`
  );
  return `https://t.me/share/url?url=${encodeURIComponent(meeting.link)}&text=${text}`;
}
