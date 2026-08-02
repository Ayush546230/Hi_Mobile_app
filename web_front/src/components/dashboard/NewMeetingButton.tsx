import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, CalendarPlus, ChevronDown, Plus, Copy } from 'lucide-react';
import { useMeetings } from '../../context/MeetingContext';
import { copyToClipboard } from '../../utils/meetingUtils';

interface Props {
  onSchedule: () => void;
  onShowToast: (msg: string) => void;
}

export default function NewMeetingButton({ onSchedule, onShowToast }: Props) {
  const [open, setOpen] = useState(false);
  const [linkBox, setLinkBox] = useState<{link: string, roomName: string} | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { createInstantMeeting } = useMeetings();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInstant = () => {
    const meeting = createInstantMeeting();
    setOpen(false);
    setLinkBox({ link: meeting.link, roomName: meeting.roomName });
  };

  const handleSchedule = () => {
    setOpen(false);
    onSchedule();
  };

  return (
    <div className="new-meeting-wrap" ref={ref}>
      <button className="btn btn-primary" onClick={() => {}} id="new-meeting-btn">
        <Plus size={18} /> New meeting
      </button>
      {/* 
      {open && (
        <div className="new-meeting-dropdown" id="new-meeting-dropdown">
          <button className="dropdown-item" onClick={handleInstant}>
            <Video size={20} />
            <div><div className="label">Start an instant meeting</div><div className="desc">Join right away</div></div>
          </button>
          <button className="dropdown-item" onClick={handleSchedule}>
            <CalendarPlus size={20} />
            <div><div className="label">Schedule a meeting</div><div className="desc">Set up a future meeting</div></div>
          </button>
        </div>
      )}
      */}
      {linkBox && (
        <div className="meeting-link-box">
          <p>Share this link to the people</p>
          <div className="link-row">
            <code>{linkBox.link}</code>
            <button className="icon-btn" style={{ width: '28px', height: '28px' }} onClick={() => { copyToClipboard(linkBox.link); onShowToast('Meeting link copied!'); }}>
              <Copy size={14} />
            </button>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setLinkBox(null)}>Dismiss</button>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => {}}>Join</button>
          </div>
        </div>
      )}
    </div>
  );
}
