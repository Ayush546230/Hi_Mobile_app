import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useMeetings } from '../context/MeetingContext';
import PreJoinScreen from '../components/meeting/PreJoinScreen';
import JitsiRoom from '../components/meeting/JitsiRoom';
import { API, useAuth } from '../context/AuthContext';

// Initialize socket outside component to avoid reconnects on every render if possible,
// but since we need it connected dynamically, we'll instantiate it inside or use a ref.

export default function MeetingRoom() {
  const { roomName } = useParams<{ roomName: string }>();
  const navigate = useNavigate();
  const { userProfile, userPreferences, addToHistory, upcomingMeetings, loading } = useMeetings();
  const { user, loading: authLoading } = useAuth();
  const joinTime = useRef<number>(Date.now());
  const [roomData, setRoomData] = useState<any>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // Post-meeting screen state
  const [hasLeft, setHasLeft] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [skipPrejoin, setSkipPrejoin] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [hasJoined, setHasJoined] = useState(false);

  // Custom Waiting Room States
  type GuestStatus = 'checking' | 'knocking' | 'waiting' | 'admitted' | 'denied';
  const [guestStatus, setGuestStatus] = useState<GuestStatus>('checking');
  const [knockingGuests, setKnockingGuests] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Consultation states
  const [consultationTimeLeft, setConsultationTimeLeft] = useState<number | null>(null);
  const [showWarningPopup, setShowWarningPopup] = useState<number | null>(null);
  const [showExtendMenu, setShowExtendMenu] = useState(false);
  const [customExtendValue, setCustomExtendValue] = useState(15);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?returnUrl=/meeting/${roomName}`);
    }
  }, [authLoading, user, navigate, roomName]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const fetchRoom = async () => {
      try {
        const res = await API.get(`/meetings/room/${roomName}`);
        setRoomData(res.data.meeting);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Meeting not found');
        } else {
          setError('Failed to fetch meeting');
        }
      }
    };

    fetchRoom();
  }, [roomName]);

  // WebSocket Connection for Real-Time Updates
  useEffect(() => {
    if (!roomName) return;
    
    // Connect to the backend WebSocket server
    // Strip '/api' from the URL if it exists so Socket.io connects to the root namespace
    let apiUrl = (import.meta as any).env.VITE_API_URL || '';
    if (apiUrl.endsWith('/api')) {
      apiUrl = apiUrl.replace(/\/api$/, '');
    }
    
    const socket: Socket = apiUrl
      ? io(apiUrl, { withCredentials: true })
      : io({ withCredentials: true }); // Automatically uses current host and Vite proxies /socket.io
      
    socketRef.current = socket;

    // Join the specific meeting room channel
    socket.emit('join-room', roomName);

    // Listen for the termination event
    socket.on('meeting-ended', () => {
      setIsEnded(prev => {
        if (!prev) setTimeLeft(30);
        return true;
      });
    });

    // Listen for host joining to automatically let guests in
    socket.on('host-joined', () => {
      setRoomData((prev: any) => {
        if (prev) {
          return { ...prev, hostJoined: true };
        }
        return prev;
      });
    });

    socket.on('consultation-extended', (newEndTime) => {
      setRoomData((prev: any) => {
        if (prev) {
          return { ...prev, endTime: newEndTime };
        }
        return prev;
      });
      setShowWarningPopup(null);
    });

    // Waiting Room Listeners
    socket.on('guest-knocking', (guest) => {
      setKnockingGuests(prev => {
        if (prev.find(g => g.socketId === guest.socketId)) return prev;
        return [...prev, guest];
      });
    });

    socket.on('guest-admitted', () => {
      setGuestStatus('admitted');
    });

    socket.on('guest-denied', () => {
      setGuestStatus('denied');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomName]);

  // Timer for post-meeting and ended screens
  useEffect(() => {
    const showEndedScreen = isEnded || roomData?.status === 'completed';
    if (!hasLeft && !showEndedScreen) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasLeft, isEnded, roomData?.status, navigate]);

  // Consultation Timer
  useEffect(() => {
    if (!roomData?.isConsultation || !roomData?.endTime) return;
    if (isEnded || hasLeft || roomData.status === 'completed') return;

    const updateTimer = () => {
      const remainingMs = new Date(roomData.endTime).getTime() - Date.now();
      const remainingSecs = Math.max(0, Math.floor(remainingMs / 1000));
      setConsultationTimeLeft(remainingSecs);

      if (remainingSecs <= 0) {
        if (userProfile?.id === roomData.userId) {
          // If host, end it for all
          const durationMin = Math.round((Date.now() - joinTime.current) / 60000);
          setRoomData((prev: any) => ({ ...prev, status: 'completed' }));
          setIsEnded(prev => {
            if (!prev) setTimeLeft(30);
            return true;
          });
          API.put(`/meetings/${roomData.id}`, { status: 'completed', duration: durationMin })
            .catch(err => console.error('Failed to update meeting status', err));
        } else {
          // If guest, end locally if host hasn't ended it yet
          setIsEnded(prev => {
            if (!prev) setTimeLeft(30);
            return true;
          });
        }
        return;
      }

      // Only host gets warning popups
      if (userProfile?.id === roomData.userId) {
        if (remainingSecs === 300) setShowWarningPopup(300); // 5 min
        else if (remainingSecs === 120) setShowWarningPopup(120); // 2 min
        else if (remainingSecs === 60) setShowWarningPopup(60); // 1 min
        else if (remainingSecs === 10) setShowWarningPopup(10); // 10 sec
      }
    };

    updateTimer(); // Initial check
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [roomData?.isConsultation, roomData?.endTime, isEnded, hasLeft, roomData?.status, userProfile?.id, roomData?.userId]);

  // When host joins, set hostJoined to true
  useEffect(() => {
    if (roomData && userProfile?.id === roomData.userId && !roomData.hostJoined && roomData.status === 'scheduled') {
      API.put(`/meetings/${roomData.id}`, { hostJoined: true }).catch(console.error);
    }
  }, [roomData?.id, roomData?.userId, roomData?.hostJoined, roomData?.status, userProfile?.id]);

  // Fetch JWT Token for authenticated users
  useEffect(() => {
    if (roomData?.id && userProfile?.id) {
      API.get(`/meetings/room/${roomName}/token`)
        .then(res => setJwtToken(res.data.token))
        .catch(err => {
          console.error('Failed to get JaaS token:', err);
          setJwtToken(''); // fallback to empty
        });
    } else if (roomData && !userProfile?.id) {
      setJwtToken(''); // guests don't get a token
    }
  }, [roomData?.id, userProfile?.id, roomName]);

  if (!roomName) {
    navigate('/');
    return null;
  }

  // If auth is still loading, show a spinner
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--primary)', width: 40, height: 40, borderWidth: 3 }}></div>
      </div>
    );
  }

  // If user is not authenticated, render nothing while redirecting
  if (!user) {
    return null;
  }

  // If user is logged in, wait for preferences
  if (loading && userProfile?.id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading preferences...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: 8 }}>Error</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Return to Dashboard</button>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-muted)' }}>Joining meeting...</div>
      </div>
    );
  }

  if (roomData.status === 'cancelled') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: 8 }}>Meeting Cancelled</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>This meeting has been cancelled by the host and is no longer available.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Return to Dashboard</button>
      </div>
    );
  }

  const showEndedScreen = isEnded || roomData.status === 'completed';
  if (showEndedScreen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '40px' }} />
          <div className="hide-on-mobile" style={{ width: '1px', height: '50px', background: 'var(--border)' }}></div>
          <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="hide-on-mobile" style={{ height: '72px' }} />
        </div>
        <h2 style={{ color: 'var(--error)', marginBottom: 8 }}>{roomData.isConsultation ? 'Consultation Time Ended' : 'Meeting Ended'}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          {roomData.isConsultation ? 'The consultation time has ended.' : 'This meeting has been concluded by the host.'}<br/>
          Returning to dashboard in <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{timeLeft}</span> seconds...
        </p>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/dashboard')}
        >
          Return to Home
        </button>
      </div>
    );
  }

  const isHost = userProfile?.id === roomData.userId;
  const isInvitee = roomData.participants?.some((p: any) => p.email === userProfile?.email);
  const isInstantMeeting = roomData.type === 'instant';

  let requiresPermission = false;
  if (!isHost) {
    if (isInstantMeeting) {
      requiresPermission = false;
    } else if (roomData.isPrivate) {
      requiresPermission = true; // Everyone must knock
    } else {
      requiresPermission = !isInvitee; // Invitees join directly, guests knock
    }
  }
  const isGuest = requiresPermission;

  if (!isHost && !roomData.hostJoined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '40px' }} />
          <div className="hide-on-mobile" style={{ width: '1px', height: '50px', background: 'var(--border)' }}></div>
          <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="hide-on-mobile" style={{ height: '72px' }} />
        </div>
        <div className="spinner" style={{ borderTopColor: 'var(--primary)', borderLeftColor: 'var(--primary)', borderBottomColor: 'var(--primary)', width: 40, height: 40, marginBottom: 24, borderWidth: 3 }}></div>
        <h2 style={{ marginBottom: 8 }}>Waiting for Host</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Please wait, the meeting will start as soon as the host joins.</p>
      </div>
    );
  }

  // Waiting Room Logic for Guests
  if (isGuest && guestStatus !== 'admitted') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '40px' }} />
          <div className="hide-on-mobile" style={{ width: '1px', height: '50px', background: 'var(--border)' }}></div>
          <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="hide-on-mobile" style={{ height: '72px' }} />
        </div>
        
        {guestStatus === 'checking' && (
          <>
            <h2 style={{ marginBottom: 8 }}>Private Meeting</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 400, marginBottom: 24 }}>
              {isInvitee
                ? 'This is a private meeting. You must ask the host for permission to join.'
                : 'You are not on the invite list for this meeting. You must ask the host for permission to join.'}
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setGuestStatus('knocking');
                if (socketRef.current) {
                  socketRef.current.emit('guest-knocking', { 
                    roomName, 
                    user: { name: userProfile?.displayName, email: userProfile?.email, isInvitee } 
                  });
                  setGuestStatus('waiting');
                }
              }}
            >
              Ask to Join
            </button>
          </>
        )}

        {(guestStatus === 'knocking' || guestStatus === 'waiting') && (
          <>
            <div className="spinner" style={{ borderTopColor: 'var(--primary)', borderLeftColor: 'var(--primary)', borderBottomColor: 'var(--primary)', width: 40, height: 40, marginBottom: 24, borderWidth: 3 }}></div>
            <h2 style={{ marginBottom: 8 }}>Asking to join...</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Waiting for the host to let you in.</p>
          </>
        )}

        {guestStatus === 'denied' && (
          <>
            <h2 style={{ color: 'var(--error)', marginBottom: 8 }}>Entry Denied</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 400, marginBottom: 24 }}>The host declined your request to join.</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
          </>
        )}
      </div>
    );
  }

  // If user is authenticated, we MUST wait for the JWT token to be fetched before loading Jitsi.
  // We initialize it to null to represent 'fetching'. If it fails or user is a guest, we set it to empty string.
  if (userProfile?.id && jwtToken === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '40px' }} />
          <div className="hide-on-mobile" style={{ width: '1px', height: '50px', background: 'var(--border)' }}></div>
          <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="hide-on-mobile" style={{ height: '72px' }} />
        </div>
        <div className="spinner" style={{ borderTopColor: 'var(--primary)', borderLeftColor: 'var(--primary)', borderBottomColor: 'var(--primary)', width: 40, height: 40, marginBottom: 24, borderWidth: 3 }}></div>
        <h2 style={{ marginBottom: 8 }}>Securing connection...</h2>
      </div>
    );
  }

  const handleLeave = () => {
    setHasLeft(prev => {
      if (!prev) setTimeLeft(30);
      return true;
    });
  };

  const handleEndForAll = () => {
    if (isHost && roomData) {
      const durationMin = Math.round((Date.now() - joinTime.current) / 60000);
      
      if (roomData.isConsultation) {
        setRoomData((prev: any) => ({ ...prev, status: 'completed' }));
        setIsEnded(prev => {
          if (!prev) setTimeLeft(30);
          return true;
        });
      } else {
        // Navigate instantly to avoid seeing the rejoin screen
        navigate('/dashboard');
      }

      // Update backend in the background
      API.put(`/meetings/${roomData.id}`, { status: 'completed', duration: durationMin })
        .then(() => {
          const meeting = upcomingMeetings.find((m: any) => m.roomName === roomName);
          if (meeting) {
            addToHistory({ ...meeting, duration: durationMin });
          }
        })
        .catch(err => console.error('Failed to update meeting status', err));
    }
  };

  const handleExtend = (minutes: number) => {
    if (!roomData?.id) return;
    const currentEnd = new Date(roomData.endTime).getTime();
    const newEndTime = new Date(currentEnd + minutes * 60000).toISOString();
    
    // Optimistic update so it reflects instantly for the host
    setRoomData((prev: any) => ({ ...prev, endTime: newEndTime }));
    
    API.put(`/meetings/${roomData.id}`, { endTime: newEndTime }).catch(console.error);
    setShowExtendMenu(false);
    setShowWarningPopup(null);
  };

  if (hasLeft) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '40px' }} />
          <div className="hide-on-mobile" style={{ width: '1px', height: '50px', background: 'var(--border)' }}></div>
          <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="hide-on-mobile" style={{ height: '72px' }} />
        </div>
        <h2 style={{ color: 'var(--text)', marginBottom: 8 }}>You left the meeting</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Returning to dashboard in <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{timeLeft}</span> seconds...</p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/dashboard')}
          >
            Go to Home
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setHasLeft(false);
              setSkipPrejoin(true);
              setTimeLeft(30);
            }}
          >
            Rejoin Meeting
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="meeting-room" style={{ height: '100dvh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <JitsiRoom
        roomName={roomName}
        displayName={userProfile?.displayName || 'Guest'}
        onLeave={handleLeave}
        onEndForAll={handleEndForAll}
        audioMuted={!userPreferences?.micDefault}
        videoMuted={!userPreferences?.cameraDefault}
        isHost={isHost}
        isPrivate={roomData.isPrivate}
        jwt={jwtToken || undefined}
        skipPrejoin={skipPrejoin}
        onJoin={() => setHasJoined(true)}
      />

      {/* Consultation Overlay UI */}
      {roomData?.isConsultation && consultationTimeLeft !== null && hasJoined && (
        <div style={{ position: 'absolute', bottom: '100px', left: '24px', zIndex: 1000, pointerEvents: 'none' }}>
          
          {/* Timer Badge (hidden when showing warning inline for host) */}
          {(!isHost || showWarningPopup === null) && (
            <div style={{
              background: consultationTimeLeft <= 60 ? 'var(--error, #ef4444)' : 'rgba(0,0,0,0.7)',
              color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', pointerEvents: 'auto',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {formatTime(consultationTimeLeft)}
            </div>
          )}
          
          {/* Warning Popup (Inline) - Host Only */}
          {isHost && showWarningPopup !== null && (
            <div style={{
              background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)', pointerEvents: 'auto', border: '1px solid var(--border)',
              animation: 'slideInLeft 0.3s ease-out', maxWidth: 'calc(100vw - 40px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.9rem' }}>⚠️ Warning! Meeting ends in</span>
                <span style={{ background: 'var(--error)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
                  {formatTime(consultationTimeLeft)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowWarningPopup(null)} style={{ padding: '4px 12px', borderRadius: '14px' }}>Ignore</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowExtendMenu(!showExtendMenu)} style={{ padding: '4px 12px', borderRadius: '14px' }}>Extend</button>
              </div>
            </div>
          )}

          {/* Extend Menu - Host Only */}
          {isHost && showExtendMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: 16, background: 'var(--bg-card)',
              padding: 20, borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.6)', border: '1px solid var(--border)',
              width: 320, maxWidth: 'calc(100vw - 40px)', pointerEvents: 'auto', animation: 'slideUp 0.2s ease-out'
            }}>
              <h3 style={{ color: 'var(--text)', margin: '0 0 16px 0' }}>Extend Consultation</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <button className="btn btn-secondary" onClick={() => handleExtend(5)}>+ 5 Minutes</button>
                <button className="btn btn-secondary" onClick={() => handleExtend(10)}>+ 10 Minutes</button>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input 
                    type="number" className="form-input" value={customExtendValue} 
                    onChange={(e) => setCustomExtendValue(parseInt(e.target.value) || 0)} 
                    style={{ flex: 1 }} min="1"
                  />
                  <button className="btn btn-primary" onClick={() => handleExtend(customExtendValue)}>Custom</button>
                </div>
              </div>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowExtendMenu(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Waiting Room Host Approval UI */}
      {isHost && knockingGuests.length > 0 && (
        <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {knockingGuests.map((guest, index) => (
            <div key={guest.socketId + index} style={{
              background: 'var(--bg-card)', padding: '16px', borderRadius: '12px',
              boxShadow: 'var(--shadow-lg)', border: '1px solid var(--primary)',
              animation: 'slideInRight 0.3s ease-out', width: '300px'
            }}>
              <h4 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>{guest.isInvitee ? 'Invitee Knocking' : 'Guest Knocking'}</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>{guest.name || guest.email}</strong> wants to join the meeting.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    socketRef.current?.emit('admit-guest', guest.socketId);
                    setKnockingGuests(prev => prev.filter(g => g.socketId !== guest.socketId));
                  }}
                >
                  Admit
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    socketRef.current?.emit('deny-guest', guest.socketId);
                    setKnockingGuests(prev => prev.filter(g => g.socketId !== guest.socketId));
                  }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
