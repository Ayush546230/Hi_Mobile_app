import React, { useState } from 'react';
import { useMeetings } from '../context/MeetingContext';

import UpcomingMeetings from '../components/dashboard/UpcomingMeetings';
import QuickActions from '../components/dashboard/QuickActions';
import ScheduleModal from '../components/schedule/ScheduleModal';
import InviteModal from '../components/invite/InviteModal';
import type { Meeting } from '../types';

export default function Dashboard() {
  const { upcomingMeetings } = useMeetings();
  const [showSchedule, setShowSchedule] = useState<{ visible: boolean; isConsultation?: boolean }>({ visible: false });
  const [inviteMeeting, setInviteMeeting] = useState<Meeting | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSchedule = React.useCallback((isConsultation?: boolean) => setShowSchedule({ visible: true, isConsultation }), []);

  return (
    <div className="dashboard" id="dashboard">
      <div className="dashboard-hero">
        <div className="hero-left">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Welcome to</span>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '1em', verticalAlign: 'middle' }} />
            </span>
          </h1>
          <p>Premium video conferencing — secure, simple, and stunning.</p>
          <div className="hero-actions">
          </div>
        </div>
      </div>

      <QuickActions onSchedule={handleSchedule} onShowToast={showToast} />

      <UpcomingMeetings meetings={upcomingMeetings} onShowToast={showToast} onInvite={setInviteMeeting} />

      {showSchedule.visible && (
        <ScheduleModal
          initialIsConsultation={showSchedule.isConsultation}
          onClose={() => setShowSchedule({ visible: false })}
          onCreated={(meeting) => {
            showToast('Meeting scheduled successfully!');
            setInviteMeeting(meeting);
          }}
        />
      )}

      {inviteMeeting && (
        <InviteModal meeting={inviteMeeting} onClose={() => setInviteMeeting(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
