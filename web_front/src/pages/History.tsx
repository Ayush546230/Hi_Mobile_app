import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Clock, Search, Trash2, Copy, Calendar } from 'lucide-react';
import { useMeetings } from '../context/MeetingContext';
import { API, useAuth } from '../context/AuthContext';
import { formatDate, formatDuration, getRelativeTime } from '../utils/dateUtils';
import { copyToClipboard } from '../utils/meetingUtils';

export default function History() {
  const { deleteMeeting, clearHistory } = useMeetings();
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null);

  const [historyMeetings, setHistoryMeetings] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await API.get(`/meetings?type=history&page=${pageNum}&limit=20`);
      const newMeetings = res.data.meetings.map((m: any) => ({
        id: m.id || m._id,
        userId: m.userId,
        title: m.title,
        roomName: m.roomName,
        link: m.link,
        startTime: m.startTime,
        endTime: m.endTime,
        description: m.description,
        participants: m.participants || [],
        status: m.status,
        hostJoined: m.hostJoined,
        isPrivate: m.isPrivate,
        isConsultation: m.isConsultation,
        createdAt: m.createdAt,
        duration: m.duration,
      }));
      
      if (pageNum === 1) {
        setHistoryMeetings(newMeetings);
      } else {
        setHistoryMeetings(prev => [...prev, ...newMeetings]);
      }
      setHasMore(res.data.pagination?.hasMore || false);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  const allMeetings = historyMeetings.filter(m => {
    const s = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(s) ||
      (m.description && m.description.toLowerCase().includes(s)) ||
      m.id.toLowerCase().includes(s)
    );
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="history-page" id="history-page">
      <h1 style={{ marginBottom: 8 }}>Meeting History</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        View and manage your past and upcoming meetings
      </p>

      <div className="history-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="join-input history-search" style={{ flex: 1, minWidth: '200px', maxWidth: '400px', margin: 0 }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {historyMeetings.length > 0 && (
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ color: 'var(--accent-red)' }} 
            onClick={async () => {
              if (window.confirm('Are you sure you want to clear your entire meeting history? This action cannot be undone.')) {
                try {
                  await clearHistory();
                  setHistoryMeetings([]);
                  showToast('Meeting history cleared');
                } catch (err) {
                  showToast('Failed to clear history');
                }
              }
            }}
          >
            <Trash2 size={16} /> Clear All
          </button>
        )}
      </div>

      {allMeetings.length === 0 ? (
        <div className="empty-state">
          <Calendar size={64} />
          <h3>No meetings found</h3>
          <p>{search ? 'Try a different search term' : 'Your meeting history will appear here'}</p>
        </div>
      ) : (
        <div className="history-list">
          {allMeetings.map(m => (
            <div key={m.id} className="history-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'center' }}>
                <div className={`history-icon ${m.status === 'completed' ? '' : ''}`} style={{ flexShrink: 0 }}>
                  <Video size={20} />
                </div>
                <div className="history-details" style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.3', marginBottom: '4px' }}>{m.title}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDate(m.startTime)} • 👥 {m.participants.length} 
                    <span className="hide-on-mobile">
                      {typeof m.duration === 'number' ? ` • ⏱️ ${formatDuration(m.duration)}` : ''}
                    </span>
                    <span style={{ opacity: 0.7 }}> • {getRelativeTime(m.createdAt)}</span>
                  </p>
                </div>
                <div className="history-right" style={{ flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                  <button className="btn btn-green btn-sm btn-icon" onClick={() => navigate(`/meeting/${m.roomName}`)} title="Join">
                    <Video size={16} />
                  </button>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={async () => { await copyToClipboard(m.link); showToast('Link copied!'); }} title="Copy link">
                    <Copy size={16} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={async () => {
                    await deleteMeeting(m.id);
                    setHistoryMeetings(prev => prev.filter(x => x.id !== m.id));
                  }} title="Delete" style={{ color: 'var(--accent-red)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {m.description && (
                <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg)', padding: '12px', borderRadius: '8px' }}>
                  {m.description.length <= 80 ? (
                    <span style={{ wordBreak: 'break-word' }}>{m.description}</span>
                  ) : expandedDescId === m.id ? (
                    <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '10em', overflowY: 'auto', paddingRight: 4 }}>
                      {m.description}
                      <span 
                        style={{ color: 'var(--primary)', cursor: 'pointer', marginLeft: 8, fontWeight: 500, whiteSpace: 'nowrap' }}
                        onClick={() => setExpandedDescId(null)}
                      >
                        show less
                      </span>
                    </div>
                  ) : (
                    <span style={{ wordBreak: 'break-word' }}>
                      {m.description.slice(0, 80)}...
                      <span 
                        style={{ color: 'var(--primary)', cursor: 'pointer', marginLeft: 8, fontWeight: 500, whiteSpace: 'nowrap' }}
                        onClick={() => setExpandedDescId(m.id)}
                      >
                        see more
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

          ))}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchHistory(nextPage);
                }}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
