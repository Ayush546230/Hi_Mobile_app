import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard } from 'lucide-react';
import { extractRoomFromLink } from '../../utils/meetingUtils';

export default function JoinMeetingInput() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    setError('');
    const room = extractRoomFromLink(code);
    if (room) {
      setCode('');
      navigate(`/meeting/${room}`);
    } else {
      setError('Invalid room ID');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div className="join-input-wrap">
        <div className="join-input">
          <Keyboard size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Enter a code or link"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            id="join-input"
          />
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleJoin}
          disabled={!code.trim()}
          style={{ opacity: code.trim() ? 1 : 0.5 }}
          id="join-btn"
        >
          Join
        </button>
      </div>
      {error && <span style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginLeft: '8px' }}>{error}</span>}
    </div>
  );
}
