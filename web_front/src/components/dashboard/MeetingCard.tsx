import React from 'react';
import { Calendar, Clock, Users, Video, Copy, ExternalLink, Info, HelpCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Meeting } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { copyToClipboard } from '../../utils/meetingUtils';
import { useMeetings } from '../../context/MeetingContext';
import { useAuth } from '../../context/AuthContext';

interface Props {
  meeting: Meeting;
  onShowToast: (msg: string) => void;
  onInvite: (meeting: Meeting) => void;
}

const MeetingCard = React.memo(function MeetingCard({ meeting, onShowToast, onInvite }: Props) {
  const [showDesc, setShowDesc] = React.useState(false);
  const navigate = useNavigate();
  const { cancelMeeting } = useMeetings();
  const { user } = useAuth() as any;
  const isHost = !meeting.userId || meeting.userId === (user?.id || user?._id);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(meeting.link);
    onShowToast('Link copied!');
  };

  const calculatedDuration = meeting.duration || (meeting.endTime ? Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / 60000) : null);

  return (
    <div className="meeting-card" id={`meeting-card-${meeting.id}`}>
      <div className="meeting-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3>{meeting.title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {meeting.description && (
              <div
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: 'var(--primary)', marginTop: 2 }}
                title="Description"
                onClick={() => setShowDesc(!showDesc)}
              >
                <Info size={18} strokeWidth={2.5} />
              </div>
            )}
            <div
              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default', color: 'var(--text-muted)', marginTop: 2 }}
              title={`Room ID: ${meeting.roomName}`}
            >
              <HelpCircle size={18} strokeWidth={2.5} />
            </div>
          </div>
        </div>
        <span className={`status ${meeting.status === 'completed' ? 'status-completed' : 'status-scheduled'}`}>
          {meeting.status === 'completed' ? 'Completed' : (meeting.isConsultation ? 'Upcoming Consultation' : 'Upcoming')}
        </span>
      </div>
      <div className="meeting-card-info">
        <span><Calendar size={14} /> {formatDate(meeting.startTime)}</span>
        {calculatedDuration && <span><Clock size={14} /> {calculatedDuration} min</span>}
        <span><Users size={14} /> {meeting.participants.length || 'No'} participant{meeting.participants.length !== 1 ? 's' : ''}</span>
      </div>
      {meeting.participants.length > 0 && (
        <div className="participants-row" style={{ marginBottom: 12 }}>
          {meeting.participants.slice(0, 4).map((p, i) => (
            <div key={i} className="participant-avatar" title={p.name}>
              {p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          ))}
          {meeting.participants.length > 4 && (
            <div className="participant-avatar">+{meeting.participants.length - 4}</div>
          )}
        </div>
      )}
      {meeting.description && showDesc && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            color: 'var(--text)',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            width: '100%',
            maxHeight: 'calc(4.8em + 20px)',
            overflowY: 'auto'
          }}>
            {meeting.description}
          </div>
        </div>
      )}
      <div className="meeting-card-actions">
        {meeting.status === 'scheduled' && (
          <button className="btn btn-green btn-sm" onClick={() => navigate(`/meeting/${meeting.roomName}`)}>
            <Video size={14} /> Join
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={handleCopy}><Copy size={14} /> Copy</button>
        {isHost && (
          <button className="btn btn-ghost btn-sm" onClick={() => onInvite(meeting)}><ExternalLink size={14} /> Invite</button>
        )}
        {meeting.status === 'scheduled' && isHost && (
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ color: 'var(--error)' }}
            onClick={async () => {
              if (window.confirm('Are you sure you want to cancel this meeting? Participants will be notified.')) {
                await cancelMeeting(meeting.id);
                onShowToast('Meeting cancelled');
              }
            }}
          >
            <XCircle size={14} /> Cancel
          </button>
        )}
      </div>
    </div>
  );
});

export default MeetingCard;
