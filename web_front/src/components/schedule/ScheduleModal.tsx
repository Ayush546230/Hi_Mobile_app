import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Globe, Search, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { DateTime } from 'luxon';

const ALL_TZS = Intl.supportedValuesOf('timeZone').map(tz => {
  if (tz === 'Asia/Kolkata') return { id: tz, name: 'India Standard Time' };
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date());
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || tz;
  return { id: tz, name: tzName };
});
import { useMeetings } from '../../context/MeetingContext';
import { getCurrentDateTime, getOneHourLaterDateTime } from '../../utils/dateUtils';
import type { Meeting, Participant } from '../../types';
import CustomDateTimePicker from './CustomDateTimePicker';

type NotifUnit = 'minutes before' | 'hours before' | 'days before' | 'weeks before';
type NotifType = 'As Notification' | 'As Email';
interface NotifState { amount: number | string; unit: NotifUnit; type: NotifType; }

interface Props {
  initialIsConsultation?: boolean;
  onClose: () => void;
  onCreated: (meeting: Meeting) => void;
}

export default function ScheduleModal({ initialIsConsultation, onClose, onCreated }: Props) {
  const { scheduleMeeting } = useMeetings();
  const [title, setTitle] = useState(initialIsConsultation ? 'Consultation' : '');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(getCurrentDateTime());
  const [endTime, setEndTime] = useState(getOneHourLaterDateTime());
  const [emailInput, setEmailInput] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState<number>(4);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationMins, setCustomDurationMins] = useState(60);
  
  const durationOptions = useMemo(() => {
    const start = new Date(startTime || Date.now());
    if (isNaN(start.getTime())) return [];
    
    const minutesList = [];
    for (let i = 0; i <= 60; i += 15) minutesList.push(i);
    for (let i = 90; i <= 12 * 60; i += 30) minutesList.push(i);

    const options = minutesList.map(i => {
      const end = new Date(start.getTime() + i * 60000);
      const timeString = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
      
      let durationStr = '';
      if (i === 0) durationStr = '(0 mins)';
      else if (i < 60) durationStr = `(${i} mins)`;
      else if (i === 60) durationStr = '(1 hr)';
      else {
        const hrs = i / 60;
        durationStr = `(${hrs} hr${hrs > 1 ? 's' : ''})`;
      }

      
      const tzOffset = end.getTimezoneOffset() * 60000;
      const value = new Date(end.getTime() - tzOffset).toISOString().slice(0, 16);
      return { label: `${timeString} ${durationStr}`, value };
    });
    return options;
  }, [startTime]);

  useEffect(() => {
    if (durationOptions.length > 0 && !isCustomDuration) {
      const exists = durationOptions.find(o => o.value === endTime);
      if (!exists) {
        setEndTime(durationOptions[4]?.value || durationOptions[0].value);
      }
    }
  }, [startTime, durationOptions, isCustomDuration, endTime]);
  
  const handleCustomDurationChange = (h: number, m: number) => {
    const totalMins = h * 60 + m;
    setCustomDurationMins(totalMins);
    const start = new Date(startTime || Date.now());
    const end = new Date(start.getTime() + totalMins * 60000);
    const tzOffset = end.getTimezoneOffset() * 60000;
    setEndTime(new Date(end.getTime() - tzOffset).toISOString().slice(0, 16));
  };
  
  const [timezone, setTimezone] = useState({ id: 'Asia/Kolkata', name: 'India Standard Time' });
  const [showTzDropdown, setShowTzDropdown] = useState(false);
  const [tzSearch, setTzSearch] = useState('');
  const [tzPage, setTzPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [notification, setNotification] = useState<NotifState>({ amount: 30, unit: 'minutes before', type: 'As Notification' });
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifMode, setNotifMode] = useState<'quick' | 'custom'>('quick');
  const [tempNotif, setTempNotif] = useState<NotifState>(notification);

  const filteredTzs = useMemo(() => {
    if (!tzSearch) return ALL_TZS;
    const lower = tzSearch.toLowerCase();
    return ALL_TZS.filter(t => t.name.toLowerCase().includes(lower) || t.id.toLowerCase().includes(lower));
  }, [tzSearch]);

  const totalPages = Math.ceil(filteredTzs.length / ITEMS_PER_PAGE);
  const paginatedTzs = filteredTzs.slice((tzPage - 1) * ITEMS_PER_PAGE, tzPage * ITEMS_PER_PAGE);

  const tzRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tzRef.current && !tzRef.current.contains(e.target as Node)) {
        setShowTzDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) {
        setShowDurationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addParticipant = () => {
    const email = emailInput.trim();
    if (email && email.includes('@') && !participants.find(p => p.email === email)) {
      setParticipants(prev => [...prev, {
        id: Date.now().toString(),
        name: email.split('@')[0],
        email,
      }]);
      setEmailInput('');
    }
  };

  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addParticipant();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const startDt = DateTime.fromISO(startTime, { zone: timezone.id });
      const endDt = endTime ? DateTime.fromISO(endTime, { zone: timezone.id }) : undefined;

      const meeting = await scheduleMeeting({
        title: title || 'Scheduled Meeting',
        description,
        startTime: startDt.toUTC().toISO() || undefined,
        endTime: endDt ? (endDt.toUTC().toISO() || undefined) : undefined,
        participants,
        timezone: timezone.id,
        notification: {
          amount: typeof notification.amount === 'string' ? parseInt(notification.amount) : notification.amount,
          unit: notification.unit,
          type: notification.type,
        },
        recurrence,
        recurrenceCount: recurrence !== 'none' ? recurrenceCount : undefined,
        isPrivate,
        isConsultation: initialIsConsultation,
      });
      onCreated(meeting);
      onClose();
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initialIsConsultation ? 'Schedule Consultation' : 'Schedule Meeting'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Meeting Title</label>
              <input className="form-input" placeholder="Add title" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ zIndex: 100 }}>
                <label>Start Time</label>
                <CustomDateTimePicker value={startTime} onChange={setStartTime} />
              </div>
              <div className="form-group" style={{ position: 'relative' }} ref={durationRef}>
                <label>Duration</label>
                {isCustomDuration ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <input type="number" min="0" value={Math.floor(customDurationMins / 60)} onChange={e => handleCustomDurationChange(parseInt(e.target.value) || 0, customDurationMins % 60)} className="form-input" style={{ width: 48, padding: '4px 8px', textAlign: 'center' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>h</span>
                      <input type="number" min="0" max="59" value={customDurationMins % 60} onChange={e => handleCustomDurationChange(Math.floor(customDurationMins / 60), parseInt(e.target.value) || 0)} className="form-input" style={{ width: 48, padding: '4px 8px', textAlign: 'center' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>m</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setIsCustomDuration(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
                        Use preset duration
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div 
                      className="form-input" 
                      onClick={() => setShowDurationDropdown(!showDurationDropdown)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--bg)' }}
                    >
                      <span>{durationOptions.find(o => o.value === endTime)?.label || ''}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setIsCustomDuration(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
                        Custom duration...
                      </button>
                    </div>
                  </div>
                )}
                {showDurationDropdown && !isCustomDuration && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 150,
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)', width: '100%', 
                    maxHeight: 'calc(5 * 38px)',
                    overflowY: 'auto'
                  }}>
                    {durationOptions.map(opt => (
                      <div
                        key={opt.value}
                        onClick={() => { 
                          setIsCustomDuration(false);
                          setEndTime(opt.value); 
                          setShowDurationDropdown(false); 
                        }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '0.875rem',
                          background: endTime === opt.value ? 'var(--bg-hover)' : 'transparent',
                          color: endTime === opt.value ? 'var(--primary)' : 'var(--text)'
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ position: 'relative', marginTop: -8 }} ref={tzRef}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', width: 'fit-content' }}
                onClick={() => setShowTzDropdown(!showTzDropdown)}
              >
                <Globe size={16} />
                <span>{timezone.name}</span>
              </div>
              
              {showTzDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  width: 'min(320px, calc(100vw - 32px))', boxShadow: 'var(--shadow-lg)', padding: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                    <Search size={14} color="var(--text-muted)" style={{ marginRight: 8, flexShrink: 0 }} />
                    <input 
                      autoFocus
                      placeholder="Search timezone..."
                      value={tzSearch}
                      onChange={e => { setTzSearch(e.target.value); setTzPage(1); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: '220px' }}>
                    {paginatedTzs.length > 0 ? paginatedTzs.map(tz => (
                      <div 
                        key={tz.id}
                        onClick={() => { setTimezone(tz); setShowTzDropdown(false); setTzSearch(''); setTzPage(1); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', background: timezone.id === tz.id ? 'var(--bg-card)' : 'transparent' }}
                      >
                        <div style={{ fontWeight: timezone.id === tz.id ? 600 : 400 }}>{tz.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{tz.id}</div>
                      </div>
                    )) : (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No results found</div>
                    )}
                  </div>
                  
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <button type="button" className="icon-btn" onClick={() => setTzPage(p => Math.max(1, p - 1))} disabled={tzPage === 1} style={{ opacity: tzPage === 1 ? 0.5 : 1 }}>
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tzPage} of {totalPages}</span>
                      <button type="button" className="icon-btn" onClick={() => setTzPage(p => Math.min(totalPages, p + 1))} disabled={tzPage === totalPages} style={{ opacity: tzPage === totalPages ? 0.5 : 1 }}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group" style={{ position: 'relative', marginTop: 8 }} ref={notifRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <Bell size={16} />
                  <span>{notification.amount} {notification.unit} {notification.type === 'As Email' ? '(Email)' : ''}</span>
                </div>
                <div 
                  style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                  onClick={() => {
                    setTempNotif(notification);
                    setNotifMode('quick');
                    setShowNotifDropdown(!showNotifDropdown);
                  }}
                >
                  Add Notification
                </div>
              </div>

              {showNotifDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)', padding: '16px'
                }}>
                  {notifMode === 'quick' ? (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {[
                          { a: 5, u: 'minutes before' },
                          { a: 10, u: 'minutes before' },
                          { a: 15, u: 'minutes before' },
                          { a: 30, u: 'minutes before' },
                          { a: 1, u: 'hours before' },
                          { a: 1, u: 'days before' }
                        ].map(opt => (
                          <div 
                            key={`${opt.a}-${opt.u}`}
                            onClick={() => setTempNotif({ ...tempNotif, amount: opt.a, unit: opt.u as NotifUnit })}
                            style={{ 
                              padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer',
                              border: tempNotif.amount === opt.a && tempNotif.unit === opt.u ? '1px solid var(--primary)' : '1px solid var(--border)',
                              color: tempNotif.amount === opt.a && tempNotif.unit === opt.u ? 'var(--primary)' : 'var(--text)'
                            }}
                          >
                            {opt.a} {opt.u.split(' ')[0]}
                          </div>
                        ))}
                        <div 
                          onClick={() => { setNotifMode('custom'); setTempNotif({ ...tempNotif, amount: 10 }); }}
                          style={{ 
                            padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer',
                            border: '1px solid var(--border)', color: 'var(--text)'
                          }}
                        >
                          Custom
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <input 
                          type="number" 
                          value={tempNotif.amount}
                          onChange={e => setTempNotif({ ...tempNotif, amount: e.target.value })}
                          style={{ 
                            width: '80px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', 
                            border: `1px solid ${Number(tempNotif.amount) < 1 ? 'var(--error, #ef4444)' : 'var(--border)'}`, 
                            background: 'var(--bg-card)', color: 'var(--text)',
                            fontSize: '0.9rem', outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {['minutes before', 'hours before', 'days before', 'weeks before'].map(u => (
                          <div 
                            key={u}
                            onClick={() => setTempNotif({ ...tempNotif, unit: u as NotifUnit })}
                            style={{ 
                              padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer',
                              border: tempNotif.unit === u ? '1px solid var(--primary)' : '1px solid var(--border)',
                              color: tempNotif.unit === u ? 'var(--primary)' : 'var(--text)'
                            }}
                          >
                            {u.split(' ')[0]}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {['As Notification', 'As Email'].map(t => (
                          <div 
                            key={t}
                            onClick={() => setTempNotif({ ...tempNotif, type: t as NotifType })}
                            style={{ 
                              padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer',
                              border: tempNotif.type === t ? '1px solid var(--primary)' : '1px solid var(--border)',
                              color: tempNotif.type === t ? 'var(--primary)' : 'var(--text)'
                            }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm"
                      disabled={notifMode === 'custom' && Number(tempNotif.amount) < 1}
                      onClick={() => {
                        setNotification(tempNotif);
                        setShowNotifDropdown(false);
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Repeat</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <select 
                  className="form-input" 
                  style={{ flex: 1, backgroundColor: 'var(--bg-card)', color: 'var(--text)' }}
                  value={recurrence} 
                  onChange={e => setRecurrence(e.target.value as any)}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                {recurrence !== 'none' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>For</span>
                    <input 
                      type="number" 
                      min="2" max="30" 
                      className="form-input" 
                      style={{ width: 80 }}
                      value={recurrenceCount} 
                      onChange={e => setRecurrenceCount(parseInt(e.target.value))} 
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>occurrences</span>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Description</label>
              <textarea className="form-input" placeholder="Add description..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            
            <div className="form-group" style={{ marginTop: 16, padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <label style={{ marginBottom: 8, color: 'var(--text)', fontWeight: 500 }}>Meeting Privacy</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="radio" name="privacy" checked={!isPrivate} onChange={() => setIsPrivate(false)} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>Public</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="radio" name="privacy" checked={isPrivate} onChange={() => setIsPrivate(true)} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>Private</span>
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Add Participants</label>
              <div className="chips-wrap">
                {participants.map(p => (
                  <span key={p.id} className="chip">
                    {p.email}
                    <button type="button" onClick={() => removeParticipant(p.id)}>×</button>
                  </span>
                ))}
                <input
                  className="chips-input"
                  placeholder="Enter email and press Enter"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={addParticipant}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{initialIsConsultation ? 'Schedule Consultation' : 'Schedule Meeting'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
