import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className="navbar">
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', width: '100%'
      }}>
        {/* Logo */}
        <div className="navbar-left">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '32px' }} />
            <img src="/powered_by_aiRender.png" alt="Powered by aiRender" className="powered-by-logo" />
          </Link>
        </div>

        {/* Nav */}
        <div className="navbar-right">
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
                {user.avatar && (
                  <img
                    src={user.avatar} alt={user.name}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)' }}
                  />
                )}
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'none' }}
                  className="nav-name">
                  {user.name?.split(' ')[0]}
                </span>
              </div>
              <Link to="/dashboard">
                <button className="btn btn-ghost btn-sm" style={{
                  color: location.pathname === '/dashboard' ? 'var(--text)' : 'var(--text-secondary)'
                }}>
                  Dashboard
                </button>
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              {location.pathname !== '/login' && (
                <Link to="/login">
                  <button className="btn btn-primary btn-sm">
                    Sign in
                  </button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @media (min-width: 480px) { .nav-name { display: block !important; } }
      `}</style>
    </header>
  );
}
