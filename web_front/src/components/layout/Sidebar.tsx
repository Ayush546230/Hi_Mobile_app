import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Clock, CalendarDays, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout } = useAuth() as any;
  const links = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/history', icon: Clock, label: 'Meeting History' },
    { to: '/settings', icon: Settings, label: 'Settings & Preferences' },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-logo">
          <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '32px' }} />
        </div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
              end={link.to === '/dashboard'}
            >
              <link.icon size={20} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto' }}>
          <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="powered-by-logo" style={{ height: '72px' }} />
          <button 
            className="btn btn-ghost mobile-only-flex" 
            onClick={logout} 
            style={{ marginTop: '16px', color: 'var(--error)', gap: '8px', width: '100%', justifyContent: 'center' }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
