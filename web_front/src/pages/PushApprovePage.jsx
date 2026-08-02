import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PushApprovePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { respondToPushLogin } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'approving' | 'approved' | 'denied' | 'error' | 'expired'
  const [error, setError] = useState('');

  const requestId = searchParams.get('requestId');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!requestId || !token) {
      setStatus('error');
      setError('Invalid or missing login request parameters.');
    } else {
      setStatus('ready');
    }
  }, [requestId, token]);

  const handleAction = async (action) => {
    setStatus(action === 'approve' ? 'approving' : 'denying');
    setError('');
    try {
      await respondToPushLogin(requestId, token, action);
      setStatus(action === 'approve' ? 'approved' : 'denied');
      
      if (action === 'approve') {
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Something went wrong';
      if (msg.includes('expired')) {
        setStatus('expired');
      } else {
        setStatus('error');
        setError(msg);
      }
    }
  };

  return (
    <main style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(184,150,62,0.06) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div className="card animate-fade-up" style={{
          padding: '44px 32px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>

          {/* ─── Ready State ─────────────────────────── */}
          {status === 'ready' && (
            <>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fff7e6 0%, #f0e6c8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, boxShadow: '0 8px 32px rgba(184,150,62,0.15)',
              }}>
                
              </div>
              <h2 style={{ fontSize: 24, fontFamily: 'var(--font-display)', marginTop: 8 }}>
                Login Request
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, maxWidth: 320 }}>
                Someone is trying to sign in to your <strong style={{ color: 'var(--ink)' }}>AuthCraft</strong> account.
                Do you want to allow this?
              </p>

              <div style={{
                width: '100%', padding: '16px', background: 'var(--cream)',
                borderRadius: 12, marginTop: 4, marginBottom: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>This request expires in 2 minutes</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 8 }}>
                <button
                  className="btn"
                  onClick={() => handleAction('deny')}
                  style={{
                    flex: 1, height: 48, fontSize: 15, fontWeight: 600,
                    background: 'transparent',
                    border: '2px solid var(--error)',
                    color: 'var(--error)',
                    borderRadius: 12,
                    transition: 'all 200ms ease',
                  }}
                  onMouseEnter={(e) => { e.target.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                >
                  Deny
                </button>
                <button
                  className="btn"
                  onClick={() => handleAction('approve')}
                  style={{
                    flex: 1, height: 48, fontSize: 15, fontWeight: 600,
                    background: 'linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(45,106,79,0.3)',
                    transition: 'all 200ms ease',
                  }}
                  onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 24px rgba(45,106,79,0.4)'; }}
                  onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 16px rgba(45,106,79,0.3)'; }}
                >
                  Approve
                </button>
              </div>
            </>
          )}

          {/* ─── Loading / Processing ────────────────── */}
          {(status === 'loading' || status === 'approving' || status === 'denying') && (
            <>
              <div className="push-pulse-ring" style={{ width: 80, height: 80, position: 'relative' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, color: 'var(--gold)' }} />
              </div>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 8 }}>
                {status === 'approving' ? 'Approving login...' :
                 status === 'denying' ? 'Denying login...' : 'Loading request...'}
              </p>
            </>
          )}

          {/* ─── Approved ────────────────────────────── */}
          {status === 'approved' && (
            <>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #d4edda 0%, #b7e4c7 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, boxShadow: '0 8px 32px rgba(45,106,79,0.15)',
              }}>
                
              </div>
              <h2 style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--success)', marginTop: 8 }}>
                Login Approved!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                The requesting device has been signed in successfully. You can close this page.
              </p>
            </>
          )}

          {/* ─── Denied ──────────────────────────────── */}
          {status === 'denied' && (
            <>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, boxShadow: '0 8px 32px rgba(192,57,43,0.15)',
              }}>
                
              </div>
              <h2 style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--error)', marginTop: 8 }}>
                Login Denied
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                The login attempt has been blocked. If this wasn't you, your account is safe. You can close this page.
              </p>
            </>
          )}

          {/* ─── Expired ─────────────────────────────── */}
          {status === 'expired' && (
            <>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fff7e6 0%, #f0e6c8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
              }}>
                
              </div>
              <h2 style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--gold)', marginTop: 8 }}>
                Request Expired
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                This login request has expired. Please try again from the login page.
              </p>
            </>
          )}

          {/* ─── Error ───────────────────────────────── */}
          {status === 'error' && (
            <>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
              }}>
                
              </div>
              <h2 style={{ fontSize: 24, fontFamily: 'var(--font-display)', marginTop: 8 }}>
                Something went wrong
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.7 }}>
                {error || 'Invalid request. Please try again.'}
              </p>
            </>
          )}

        </div>

        {/* Security notice */}
        <p style={{
          textAlign: 'center', fontSize: 12, color: 'var(--ink-muted)',
          marginTop: 20, lineHeight: 1.6,
        }}>
          This request is secured with a unique cryptographic token.<br />
          Never approve a login you didn't initiate.
        </p>
      </div>
    </main>
  );
}
