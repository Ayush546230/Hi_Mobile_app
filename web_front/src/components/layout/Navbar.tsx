import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, HelpCircle, Menu, LogOut, Cloud, CloudRain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useMeetings } from '../../context/MeetingContext';
import { getCurrentTime, getFormattedNow } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext.jsx';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const { theme, toggleTheme, toggleGreyTheme } = useTheme();
  const { userProfile } = useMeetings();
  const { logout, user } = useAuth() as any;
  const navigate = useNavigate();
  const [time, setTime] = useState(getCurrentTime());
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(getCurrentTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="navbar" id="navbar">
      <div className="navbar-left">
        <button className="icon-btn mobile-menu-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        {/* <div className="navbar-search">
          <Search size={18} color="var(--text-muted)" />
          <input type="text" placeholder="Search meetings, people, or settings..." />
        </div> */}
        <div className="navbar-time hide-on-mobile" style={{ marginLeft: '16px', textAlign: 'left' }}>
          <div className="time">{time}</div>
          <div className="date">{getFormattedNow()}</div>
        </div>
      </div>
      <div className="navbar-right">
        <button className="icon-btn" onClick={toggleTheme} style={{ fontSize: '1.2rem' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="icon-btn" onClick={toggleGreyTheme} style={{ filter: theme === 'grey' ? 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' : 'none', fontSize: '1.2rem' }}>
          ☁️
        </button>
        <div style={{ position: 'relative' }} ref={helpRef}>
          <button className="icon-btn" onClick={() => setShowHelp(!showHelp)}><HelpCircle size={20} /></button>
          {showHelp && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 100, width: 250,
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)', padding: 16, color: 'var(--text)', fontSize: '0.875rem'
            }}>
              <h4 style={{ marginBottom: 8, color: 'var(--primary)' }}>Need Help?</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                Welcome to <strong>hi</strong>! You can start or schedule a new meeting from your Dashboard, or manage your profile and preferences in Settings.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                For technical support, please contact our team at <em>support@airender.com</em>.
              </p>
            </div>
          )}
        </div>
        <button className="icon-btn hide-on-mobile" aria-label="Settings" onClick={() => navigate('/settings')}><Settings size={20} /></button>
        <button className="icon-btn hide-on-mobile" aria-label="Sign out" onClick={logout} title="Sign out" style={{ color: 'var(--error)' }}>
          <LogOut size={20} />
        </button>
        <div className="avatar" title={user?.name || userProfile.displayName} style={userProfile.avatar ? { padding: 0, overflow: 'hidden' } : {}}>
          {userProfile.avatar ? (
            <img src={userProfile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name?.[0]?.toUpperCase() || userProfile.initials
          )}
        </div>
      </div>
    </nav>
  );
}
