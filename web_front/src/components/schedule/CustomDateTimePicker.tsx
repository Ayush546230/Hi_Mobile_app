import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface Props {
  value: string; // YYYY-MM-DDThh:mm
  onChange: (val: string) => void;
}

export default function CustomDateTimePicker({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(value || Date.now()));
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempDate(new Date(value || Date.now()));
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const year = tempDate.getFullYear();
  const month = tempDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setTempDate(new Date(year, month - 1, tempDate.getDate(), tempDate.getHours(), tempDate.getMinutes()));
  };
  const handleNextMonth = () => {
    setTempDate(new Date(year, month + 1, tempDate.getDate(), tempDate.getHours(), tempDate.getMinutes()));
  };

  const handleDayClick = (day: number) => {
    setTempDate(new Date(year, month, day, tempDate.getHours(), tempDate.getMinutes()));
  };

  const handleTimeChange = (type: 'h' | 'm' | 'ampm', val: string) => {
    const newD = new Date(tempDate);
    let h = newD.getHours();
    let m = newD.getMinutes();
    const isPm = h >= 12;

    if (type === 'h') {
      let hr12 = parseInt(val, 10);
      if (isNaN(hr12)) hr12 = 12;
      if (hr12 === 12) hr12 = 0;
      newD.setHours(isPm ? hr12 + 12 : hr12);
    } else if (type === 'm') {
      let min = parseInt(val, 10);
      if (isNaN(min)) min = 0;
      newD.setMinutes(min);
    } else if (type === 'ampm') {
      if (val === 'PM' && !isPm) newD.setHours(h + 12);
      if (val === 'AM' && isPm) newD.setHours(h - 12);
    }
    setTempDate(newD);
  };

  const handleOk = () => {
    const tzOffset = tempDate.getTimezoneOffset() * 60000;
    const iso = new Date(tempDate.getTime() - tzOffset).toISOString().slice(0, 16);
    onChange(iso);
    setIsOpen(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const displayDate = new Date(value);
  const formattedDisplay = isNaN(displayDate.getTime()) ? '' : displayDate.toLocaleString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
  });

  const currentHr12 = tempDate.getHours() % 12 || 12;
  const currentMin = tempDate.getMinutes().toString().padStart(2, '0');
  const currentAmPm = tempDate.getHours() >= 12 ? 'PM' : 'AM';

  return (
    <div style={{ position: 'relative' }} ref={popupRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'var(--bg)', 
          border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--text)', fontSize: '0.875rem'
        }}
      >
        <CalendarIcon size={16} color="var(--text-muted)" />
        <span>{formattedDisplay || 'Select start time'}</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', width: '100%', minWidth: '280px', maxWidth: '320px', overflow: 'hidden'
        }}>
          {/* Calendar Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <button type="button" onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}><ChevronLeft size={20}/></button>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {tempDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <button type="button" onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}><ChevronRight size={20}/></button>
          </div>

          {/* Calendar Grid */}
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const d = new Date(year, month, day);
                const isPast = d.getTime() < today.getTime();
                const isSelected = day === tempDate.getDate() && month === tempDate.getMonth() && year === tempDate.getFullYear();
                
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleDayClick(day)}
                    style={{
                      height: 32, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', cursor: isPast ? 'not-allowed' : 'pointer',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: isSelected ? '#fff' : isPast ? 'var(--text-muted)' : 'var(--text)',
                      opacity: isPast ? 0.4 : 1,
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selector */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <Clock size={16} />
                <span style={{ fontSize: '0.85rem' }}>Time</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isCustomTime ? (
                  <>
                    <input 
                      type="number" min="1" max="12" value={currentHr12} 
                      onChange={e => handleTimeChange('h', e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px', color: 'var(--text)', outline: 'none', width: '44px', textAlign: 'center' }}
                    />
                    <span>:</span>
                    <input 
                      type="number" min="0" max="59" value={parseInt(currentMin, 10)} 
                      onChange={e => handleTimeChange('m', e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px', color: 'var(--text)', outline: 'none', width: '44px', textAlign: 'center' }}
                    />
                  </>
                ) : (
                  <>
                    <select 
                      value={currentHr12} 
                      onChange={e => handleTimeChange('h', e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px', color: 'var(--text)', outline: 'none' }}
                    >
                      {Array.from({ length: 12 }).map((_, i) => {
                        const hr12 = i + 1;
                        const hr24 = currentAmPm === 'PM' ? (hr12 === 12 ? 12 : hr12 + 12) : (hr12 === 12 ? 0 : hr12);
                        const isToday = tempDate.toDateString() === new Date().toDateString();
                        const currentHour = new Date().getHours();
                        const disabled = isToday && hr24 < currentHour;
                        return <option key={hr12} value={hr12} disabled={disabled}>{hr12}</option>;
                      })}
                    </select>
                    <span>:</span>
                    <select 
                      value={currentMin} 
                      onChange={e => handleTimeChange('m', e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px', color: 'var(--text)', outline: 'none' }}
                    >
                      {['00', '15', '30', '45'].map(m => {
                        const min = parseInt(m, 10);
                        const isToday = tempDate.toDateString() === new Date().toDateString();
                        const hr24 = tempDate.getHours();
                        const currentHour = new Date().getHours();
                        const currentMinute = new Date().getMinutes();
                        const disabled = isToday && hr24 === currentHour && min < currentMinute;
                        return <option key={m} value={m} disabled={disabled}>{m}</option>;
                      })}
                    </select>
                  </>
                )}
                <select 
                  value={currentAmPm} 
                  onChange={e => handleTimeChange('ampm', e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px', color: 'var(--text)', outline: 'none', marginLeft: 4 }}
                >
                  <option value="AM" disabled={tempDate.toDateString() === new Date().toDateString() && new Date().getHours() >= 12}>AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setIsCustomTime(!isCustomTime)} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
              >
                {isCustomTime ? 'Use preset time' : 'Custom time...'}
              </button>
            </div>
          </div>

          {/* Footer OK button */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg)' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOk}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
