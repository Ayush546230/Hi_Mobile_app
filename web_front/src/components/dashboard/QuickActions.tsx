import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, CalendarPlus, Users, Clock, Copy } from 'lucide-react';
import { useMeetings } from '../../context/MeetingContext';
import { copyToClipboard } from '../../utils/meetingUtils';
import JoinMeetingInput from './JoinMeetingInput';

interface Props {
  onSchedule: (isConsultation?: boolean) => void;
  onShowToast: (msg: string) => void;
}

const QuickActions = React.memo(function QuickActions({ onSchedule, onShowToast }: Props) {
  const navigate = useNavigate();
  const { createInstantMeeting, upcomingMeetings } = useMeetings();
  const [linkBox, setLinkBox] = useState<{link: string, roomName: string} | null>(null);
  const [hoveredCard, setHoveredCard] = useState<'new' | 'schedule' | 'consult' | null>(null);

  const handleInstant = async () => {
    try {
      const meeting = await createInstantMeeting();
      setLinkBox({ link: meeting.link, roomName: meeting.roomName });
    } catch (err) {
      onShowToast('Failed to create meeting');
    }
  };

  const recentCount = (upcomingMeetings || []).filter(m => m.status === 'completed').length;

  return (
    <div>
      <div className="section-header"><h2>Quick Actions</h2></div>
      
      <div style={{ marginBottom: 24 }}>
        <JoinMeetingInput />
      </div>

      <div className="quick-actions">
        <div 
          className="quick-action-card" 
          onClick={handleInstant} 
          onMouseEnter={() => setHoveredCard('new')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{ 
            position: 'relative', 
            background: (hoveredCard === 'schedule' || hoveredCard === 'consult') ? 'var(--bg-card)' : 'var(--primary)',
            color: (hoveredCard === 'schedule' || hoveredCard === 'consult') ? 'var(--text)' : 'white',
            borderColor: (hoveredCard === 'schedule' || hoveredCard === 'consult') ? 'var(--border)' : 'var(--primary)'
          }}
        >
          <div className="quick-action-icon" style={{ background: (hoveredCard === 'schedule' || hoveredCard === 'consult') ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.2)', color: (hoveredCard === 'schedule' || hoveredCard === 'consult') ? 'var(--primary)' : 'white' }}><Video size={22} /></div>
          <div><h4>New Meeting</h4><p style={{ color: (hoveredCard === 'schedule' || hoveredCard === 'consult') ? 'var(--text-muted)' : 'rgba(255,255,255,0.8)' }}>Start instantly</p></div>
          {linkBox && (
            <div className="meeting-link-box" onClick={(e) => e.stopPropagation()} style={{ top: '100%', left: 0, marginTop: '8px' }}>
              <p>Share this link to the people</p>
              <div className="link-row">
                <code>{linkBox.link}</code>
                <button className="icon-btn" style={{ width: '28px', height: '28px' }} onClick={() => { copyToClipboard(linkBox.link); onShowToast('Meeting link copied!'); }}>
                  <Copy size={14} />
                </button>
              </div>
              <div className="actions">
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setLinkBox(null)}>Dismiss</button>
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate(`/meeting/${linkBox.roomName}`)}>Join</button>
              </div>
            </div>
          )}
        </div>
        <div 
          className="quick-action-card" 
          onClick={() => onSchedule()}
          onMouseEnter={() => setHoveredCard('schedule')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{ 
            background: hoveredCard === 'schedule' ? 'var(--primary)' : 'var(--bg-card)',
            color: hoveredCard === 'schedule' ? 'white' : 'var(--text)',
            borderColor: hoveredCard === 'schedule' ? 'var(--primary)' : 'var(--border)'
          }}
        >
          <div className="quick-action-icon" style={{ background: hoveredCard === 'schedule' ? 'rgba(255,255,255,0.2)' : 'rgba(0,200,83,0.12)', color: hoveredCard === 'schedule' ? 'white' : 'var(--accent-green)' }}><CalendarPlus size={22} /></div>
          <div><h4>Schedule</h4><p style={{ color: hoveredCard === 'schedule' ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>Plan ahead</p></div>
        </div>

        <div 
          className="quick-action-card" 
          onClick={() => onSchedule(true)}
          onMouseEnter={() => setHoveredCard('consult')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{ 
            background: hoveredCard === 'consult' ? 'var(--primary)' : 'var(--bg-card)',
            color: hoveredCard === 'consult' ? 'white' : 'var(--text)',
            borderColor: hoveredCard === 'consult' ? 'var(--primary)' : 'var(--border)'
          }}
        >
          <div className="quick-action-icon" style={{ background: hoveredCard === 'consult' ? 'rgba(255,255,255,0.2)' : 'rgba(239, 68, 68, 0.12)', color: hoveredCard === 'consult' ? 'white' : 'var(--error, #ef4444)' }}><Clock size={22} /></div>
          <div><h4>Consultation</h4><p style={{ color: hoveredCard === 'consult' ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>Timed session</p></div>
        </div>
      </div>
    </div>
  );
});

export default QuickActions;
