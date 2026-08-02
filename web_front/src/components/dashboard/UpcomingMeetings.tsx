import React, { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Meeting } from '../../types';
import MeetingCard from './MeetingCard';

interface Props {
  meetings: Meeting[];
  onShowToast: (msg: string) => void;
  onInvite: (meeting: Meeting) => void;
}

const UpcomingMeetings = React.memo(function UpcomingMeetings({ meetings, onShowToast, onInvite }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const upcoming = meetings.filter((m) => {
    if (m.status !== 'scheduled') return false;
    if (m.title === 'Instant Meeting') return false; // Hide instant meetings

    const endTime = m.endTime ? new Date(m.endTime).getTime() : new Date(m.startTime).getTime() + 60 * 60 * 1000;
    return endTime > now;
  });

  if (upcoming.length === 0) {
    return (
      <div>
        <div className="section-header"><h2>Upcoming Meetings</h2></div>
        <div className="empty-state">
          <CalendarDays size={64} />
          <h3>No upcoming meetings</h3>
          <p>Create a new meeting or schedule one to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2>Upcoming Meetings ({upcoming.length})</h2>
      </div>
      <div className="meetings-grid">
        {upcoming.slice(0, 6).map((m) => (
          <MeetingCard key={m.id} meeting={m} onShowToast={onShowToast} onInvite={onInvite} />
        ))}
      </div>
    </div>
  );
});

export default UpcomingMeetings;
