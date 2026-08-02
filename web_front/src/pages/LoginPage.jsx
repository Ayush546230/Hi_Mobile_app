import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { io } from 'socket.io-client';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = new URLSearchParams(location.search).get('returnUrl') || '/dashboard';
  const { user, registerPasskey, enablePushAuth } = useAuth();
  const [showPasskeyPopup, setShowPasskeyPopup] = useState(false);
  const [popupStatus, setPopupStatus] = useState('ask'); // 'ask' | 'creating' | 'success' | 'error'
  const [popupError, setPopupError] = useState('');
  
  const [showPushPopup, setShowPushPopup] = useState(false);
  const [pushPopupStatus, setPushPopupStatus] = useState('ask'); // 'ask' | 'creating' | 'success' | 'error'
  const [pushPopupError, setPushPopupError] = useState('');
  const [wantsPush, setWantsPush] = useState(false);
  const [showGoogleFirstPopup, setShowGoogleFirstPopup] = useState(false);
  
  const popupIntentRef = useRef(false);
  const tempUserRef = useRef(null);

  useEffect(() => {
    if (user && !showPasskeyPopup && !showPushPopup && !popupIntentRef.current) {
      navigate(returnUrl);
    }
  }, [user, showPasskeyPopup, showPushPopup, navigate, returnUrl]);

  const handleGoogleSuccess = (loggedInUser) => {
    const pushEnabled = localStorage.getItem('pushEnabled') === 'true';
    
    // 1. Show Push Auth popup if not enabled on this device
    if (!pushEnabled) {
      popupIntentRef.current = true;
      setShowPushPopup(true);
      setPushPopupStatus('ask');
      setPushPopupError('');
      tempUserRef.current = loggedInUser;
      return;
    }

    // 2. Otherwise, check if user already has a passkey
    if (loggedInUser?.authMethods?.passkey) {
      popupIntentRef.current = false;
      navigate(returnUrl);
      return;
    }

    // 3. Otherwise show create passkey popup
    popupIntentRef.current = true;
    setShowPasskeyPopup(true);
    setPopupStatus('ask');
    setPopupError('');
  };

  const proceedAfterPushPopup = () => {
    setShowPushPopup(false);
    const u = tempUserRef.current || user;
    
    if (!u?.authMethods?.passkey) {
      setShowPasskeyPopup(true);
      setPopupStatus('ask');
    } else {
      popupIntentRef.current = false;
      navigate(returnUrl);
    }
  };

  const handleEnablePushAuth = async () => {
    setPushPopupStatus('creating');
    setPushPopupError('');
    try {
      await enablePushAuth();
      localStorage.setItem('pushEnabled', 'true');
      setPushPopupStatus('success');
      setTimeout(() => {
        proceedAfterPushPopup();
      }, 1500);
    } catch (err) {
      setPushPopupError(err?.response?.data?.error || err?.message || 'Failed to enable push authentication');
      setPushPopupStatus('error');
    }
  };

  const handlePasskeySuccess = () => navigate(returnUrl);

  const handleCreatePasskey = async () => {
    setPopupStatus('creating');
    setPopupError('');
    try {
      await registerPasskey(user.email, user.name, 'My Device');
      setPopupStatus('success');
      setTimeout(() => {
        popupIntentRef.current = false;
        setShowPasskeyPopup(false);
        navigate(returnUrl);
      }, 1500);
    } catch (err) {
      setPopupError(err?.response?.data?.error || err?.message || 'Failed to create passkey');
      setPopupStatus('error');
    }
  };

  const handleSkipPasskey = () => {
    popupIntentRef.current = false;
    setShowPasskeyPopup(false);
    navigate(returnUrl);
  };

  return (
    <main style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 5%',
      gap: '8%',
      maxWidth: 1400,
      margin: '0 auto',
      flexWrap: 'wrap'
    }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'transparent 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* ─── Image Carousel ─── */}
      <div className="animate-fade-up" style={{ flex: '1 1 400px', maxWidth: 600, padding: '20px 0', zIndex: 1 }}>
        <ImageCarousel />
      </div>

      {/* ─── Sign In Card ─── */}
      <div style={{ flex: '1 1 400px', width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div className="pre-join-card animate-fade-up" style={{ animationDelay: '150ms', display: 'flex', flexDirection: 'column', gap: 20, padding: '40px 30px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: 24, fontFamily: 'var(--font-heading)', marginBottom: 8 }}>Sign In</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Welcome back to</p>
            <img src="/Hi_Logo.png" alt="hi logo" style={{ height: '28px', verticalAlign: 'middle' }} />
          </div>

          <GooglePanel onBeforeLogin={() => { popupIntentRef.current = true; }} onSuccess={handleGoogleSuccess} clientId={GOOGLE_CLIENT_ID} />
          <PasskeyPanel onBeforeLogin={() => { popupIntentRef.current = true; }} onSuccess={handlePasskeySuccess} onRequiresGoogle={() => setShowGoogleFirstPopup(true)} />

          <div className="divider">or</div>

          <PushLoginPanel 
            onBeforeLogin={() => { popupIntentRef.current = true; }} 
            onAfterLogin={() => { popupIntentRef.current = false; }} 
          />
        </div>
      </div>

      {/* ─── Passkey Creation Popup (shown after Google Sign-In) ──── */}
      {showPasskeyPopup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
          <div className="pre-join-card animate-fade-up" style={{ maxWidth: 420, width: '100%', padding: '40px 32px', textAlign: 'center' }}>

            {popupStatus === 'ask' && (
              <>
                <h3 style={{ fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 10 }}>Create a Passkey?</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8, maxWidth: 320, margin: '0 auto 24px' }}>
                  Set up a passkey to sign in faster next time using your fingerprint, face recognition, or device PIN.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <button className="btn btn-primary" onClick={handleCreatePasskey} style={{
                    width: '100%', height: 48, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: 15, fontWeight: 600, borderRadius: 14,
                  }}>
                    Yes, create passkey
                  </button>
                  <button onClick={handleSkipPasskey} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>Skip for now</button>
                </div>
              </>
            )}

            {popupStatus === 'creating' && (
              <div style={{ padding: '20px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px', width: 36, height: 36, color: 'var(--primary)' }} />
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 12 }}>Follow the prompt on your device...</p>
              </div>
            )}

            {popupStatus === 'success' && (
              <div style={{ padding: '20px 0' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, #d4edda 0%, #b7e4c7 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, boxShadow: '0 8px 32px rgba(45,106,79,0.15)',
                }}>

                </div>
                <h3 style={{ fontSize: 22, fontFamily: 'var(--font-heading)', color: 'var(--success)', marginBottom: 8 }}>Passkey Created!</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Redirecting to dashboard...
                </p>
              </div>
            )}

            {popupStatus === 'error' && (
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                <h3 style={{ fontSize: 20, fontFamily: 'var(--font-heading)', marginBottom: 8 }}>Could not create passkey</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>{popupError}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <button className="btn btn-secondary" onClick={() => { setPopupStatus('ask'); setPopupError(''); }} style={{ width: '100%', height: 42, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Try again</button>
                  <button onClick={handleSkipPasskey} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}>Skip for now</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─── Google First Popup (shown if Passkey clicked without setup) ──── */}
      {showGoogleFirstPopup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
          <div className="pre-join-card animate-fade-up" style={{ maxWidth: 420, width: '100%', padding: '40px 32px', textAlign: 'center' }}>
            <h3 style={{ fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 10 }}>Sign in with Google First</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8, maxWidth: 320, margin: '0 auto 24px' }}>
              Please sign in with Google first to set up Passkeys.
            </p>
            <button className="btn btn-primary" onClick={() => setShowGoogleFirstPopup(false)} style={{ width: '100%', height: 48, borderRadius: 14, fontWeight: 600 }}>
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ─── Push Auth Enable Popup (shown after Google Sign-In) ──── */}
      {showPushPopup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
          <div className="pre-join-card animate-fade-up" style={{ maxWidth: 420, width: '100%', padding: '40px 32px', textAlign: 'center' }}>

            {pushPopupStatus === 'ask' && (
              <>
                <h3 style={{ fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 10 }}>Enable Push Authentication?</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8, maxWidth: 320, margin: '0 auto 24px' }}>
                  Get a notification on this device to instantly approve logins with a single click next time. No passwords needed.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setWantsPush(!wantsPush)}>
                    <div style={{ textAlign: 'left' }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Single Click Login</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Instant approval via push</p>
                    </div>
                    {/* Toggle Switch UI */}
                    <div style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: wantsPush ? 'var(--primary)' : 'var(--border)',
                      position: 'relative', transition: 'background 0.3s ease'
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 2, left: wantsPush ? 22 : 2,
                        transition: 'left 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>

                  <button className="btn btn-primary" onClick={wantsPush ? handleEnablePushAuth : proceedAfterPushPopup} style={{
                    width: '100%', height: 48, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: 15, fontWeight: 600, borderRadius: 14,
                  }}>
                    Continue
                  </button>
                </div>
              </>
            )}

            {pushPopupStatus === 'creating' && (
              <div style={{ padding: '20px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px', width: 36, height: 36, color: 'var(--primary)' }} />
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 12 }}>Please allow notifications when prompted...</p>
              </div>
            )}

            {pushPopupStatus === 'success' && (
              <div style={{ padding: '20px 0' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, #d4edda 0%, #b7e4c7 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, boxShadow: '0 8px 32px rgba(45,106,79,0.15)',
                }}>
                </div>
                <h3 style={{ fontSize: 22, fontFamily: 'var(--font-heading)', color: 'var(--success)', marginBottom: 8 }}>Push Login Enabled!</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Proceeding...
                </p>
              </div>
            )}

            {pushPopupStatus === 'error' && (
              <div style={{ padding: '20px 0' }}>
                <h3 style={{ fontSize: 20, fontFamily: 'var(--font-heading)', marginBottom: 8 }}>Could not enable push login</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>{pushPopupError}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <button className="btn btn-secondary" onClick={() => { setPushPopupStatus('ask'); setPushPopupError(''); }} style={{ width: '100%', height: 42, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Try again</button>
                  <button onClick={proceedAfterPushPopup} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}>Skip for now</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </main>
  );
}


// ─── Google Panel ──────────────────────────────────────────
function GooglePanel({ onBeforeLogin, onSuccess, clientId }) {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(!!window.google);
  const btnRef = useRef(null);

  useEffect(() => {
    if (window.google) { setGoogleLoaded(true); return; }
    const intervalId = setInterval(() => { if (window.google) { setGoogleLoaded(true); clearInterval(intervalId); } }, 100);
    return () => clearInterval(intervalId);
  }, []);

  const handleCredentialResponse = useCallback(async (response) => {
    if (onBeforeLogin) onBeforeLogin();
    setLoading(true); setError('');
    try { 
      const loggedInUser = await loginWithGoogle(response.credential); 
      onSuccess(loggedInUser); 
    }
    catch (err) { setError(err.response?.data?.error || 'Google sign-in failed.'); }
    finally { setLoading(false); }
  }, [loginWithGoogle, onSuccess]);

  useEffect(() => {
    if (!clientId || !googleLoaded || !btnRef.current) return;
    
    let resizeTimer;
    const renderGoogleBtn = () => {
      if (!btnRef.current) return;
      // Cap at 320px to match Passkey/Single-Click buttons
      const btnWidth = Math.min(320, btnRef.current.parentElement?.offsetWidth || 320);
      
      // Clear previous button render
      btnRef.current.innerHTML = '';
      
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredentialResponse, auto_select: false, cancel_on_tap_outside: true });
      window.google.accounts.id.renderButton(btnRef.current, { type: 'standard', shape: 'rectangular', theme: 'outline', text: 'signin_with', size: 'large', logo_alignment: 'center', width: btnWidth });
    };

    // Render initially
    renderGoogleBtn();
    
    // Re-render on window resize to ensure correct width
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderGoogleBtn, 200);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clientId, handleCredentialResponse, googleLoaded]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {error && <div className="toast toast-error" style={{ width: '100%', maxWidth: '320px' }}>{error}</div>}
      {!clientId && <div className="toast toast-error">Google OAuth not configured</div>}
      
      <div style={{ width: '100%', maxWidth: '320px', display: clientId ? 'flex' : 'none', justifyContent: 'center', position: 'relative' }}>
        {/* The Google button container - kept mounted so iframe doesn't break */}
        <div 
          ref={btnRef} 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            minHeight: '40px', 
            width: '100%',
            maxWidth: '320px',
            overflow: 'hidden',
            borderRadius: '4px',
            opacity: loading ? 0.4 : 1,
            pointerEvents: loading ? 'none' : 'auto',
            transition: 'opacity 0.2s'
          }} 
        />
        
        {/* Loading overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ color: 'var(--text)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Passkey Panel ─────────────────────────────────────────
function PasskeyPanel({ onBeforeLogin, onSuccess, onRequiresGoogle }) {
  const { loginWithDiscoverablePasskey } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (onBeforeLogin) onBeforeLogin();
    setError(''); setLoading(true);
    try { await loginWithDiscoverablePasskey(); onSuccess(); }
    catch (err) { 
      // If the user cancelled the passkey prompt (e.g., NotAllowedError), just show a message
      if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('cancel') || err.message?.toLowerCase().includes('abort')) {
        setError('Cancelled. Need a passkey? Sign in with Google to create one.');
      } else {
        // Treat any other failure as a cue to sign in with Google first to set up passkeys.
        onRequiresGoogle(); 
      }
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {error && <div className="toast toast-error" style={{ width: '100%', maxWidth: '320px', fontSize: 13, lineHeight: 1.4 }}>{error}</div>}
      <button className="btn btn-secondary" onClick={handleLogin} disabled={loading} style={{ width: '100%', maxWidth: '320px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading ? <div className="spinner" /> : 'Sign in with Passkey'}
      </button>
    </div>
  );
}

// ─── Push Login Panel ──────────────────────────────────────
// Helper function for VAPID key conversion
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// ─── Push Login Panel ──────────────────────────────────────
function PushLoginPanel({ onBeforeLogin, onAfterLogin }) {
  const { initiatePushLogin, completePushLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = new URLSearchParams(location.search).get('returnUrl') || '/dashboard';
  const [step, setStep] = useState('idle'); // 'idle' | 'checking' | 'sending' | 'waiting' | 'approved' | 'denied' | 'expired' | 'error'
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [countdown, setCountdown] = useState(120);
  const pollRef = useRef(null); // Will now store socket instance
  const countdownRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) pollRef.current.disconnect();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startSocketListening = (reqId) => {
    setCountdown(120);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          if (pollRef.current) pollRef.current.disconnect();
          setStep('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let apiUrl = import.meta.env.VITE_API_URL || '';
    if (apiUrl.endsWith('/api')) apiUrl = apiUrl.replace(/\/api$/, '');
    
    const socket = apiUrl ? io(apiUrl, { withCredentials: true }) : io({ withCredentials: true });
    pollRef.current = socket;

    socket.emit('join-push-room', reqId);

    socket.on('push-login-response', (data) => {
      if (data.status === 'approved') {
        clearInterval(countdownRef.current);
        socket.disconnect();
        completePushLogin(data.token, data.user);
        
        // Navigate instantly without delay
        if (onAfterLogin) onAfterLogin();
        navigate(returnUrl);
      } else if (data.status === 'denied') {
        clearInterval(countdownRef.current);
        socket.disconnect();
        setStep('denied');
      }
    });
  };

  const handleSingleClickLogin = async () => {
    if (onBeforeLogin) onBeforeLogin();
    setError('');

    if (localStorage.getItem('pushEnabled') !== 'true') {
      setError('Please sign in with Google first to enable Single Click Login.');
      return;
    }

    setStep('checking');

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications are not supported in this browser');
      }

      // 1. Request notification permission on-the-fly
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied. Please allow notifications to use Single Click.');
      }

      // 2. Register Service Worker and wait for it to be ready
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // 3. Get existing subscription
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        // Clear local storage since it's out of sync
        localStorage.removeItem('pushEnabled');
        throw new Error('No push subscription found on this device. Please sign in with Google to re-enable it.');
      }

      // 4. Directly trigger the login flow using the subscription
      setStep('sending');
      const res = await initiatePushLogin({ subscription: subscription.toJSON() });
      setRequestId(res.requestId);
      setStep('waiting');
      startSocketListening(res.requestId);
    } catch (err) {
      console.error('Error during push login:', err);
      let errMsg = err?.response?.data?.error || err?.message || 'Failed to trigger push login.';
      if (err?.response?.status === 404) {
        localStorage.removeItem('pushEnabled');
        errMsg = 'Device not registered. Please sign in with Google to re-enable Single Click Login.';
      }
      setError(errMsg);
      setStep('idle');
    }
  };

  const handleReset = () => {
    if (pollRef.current) pollRef.current.disconnect();
    if (countdownRef.current) clearInterval(countdownRef.current);
    setStep('idle');
    setError('');
    setRequestId(null);
  };

    if (step === 'idle') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {error && <div className="toast toast-error" style={{ width: '100%', maxWidth: '320px', fontSize: 13, lineHeight: 1.4 }}>{error}</div>}
        <button className="btn btn-primary" onClick={handleSingleClickLogin} style={{ width: '100%', maxWidth: '320px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          Login with Single Click
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>
          Directly receive a notification to Allow or Deny login instantly
        </p>
      </div>
    );
  }

  if (step === 'checking') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
        <div className="spinner" style={{ color: 'var(--primary)' }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Initializing notification channel...</p>
      </div>
    );
  }

  if (step === 'sending') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
        <div className="spinner" style={{ color: 'var(--primary)' }} />
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sending push notification to your device...</p>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>waiting for user for the input</p>
        <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
          Expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
        </div>
        <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}>Cancel</button>
      </div>
    );
  }

  if (step === 'approved') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
        <div style={{ fontSize: 40 }}></div>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>Login Approved!</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Signing you in...</p>
      </div>
    );
  }

  if (step === 'denied') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
        <div style={{ fontSize: 40 }}></div>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--error)' }}>Login Denied</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>The request was rejected from your notification.</p>
        <button className="btn btn-secondary btn-sm" onClick={handleReset} style={{ marginTop: 8 }}>Try Again</button>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
        <div style={{ fontSize: 40 }}></div>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)' }}>Request Expired</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>The login request timed out. Please try again.</p>
        <button className="btn btn-secondary btn-sm" onClick={handleReset} style={{ marginTop: 8 }}>Try Again</button>
      </div>
    );
  }

  // error
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
      <div className="toast toast-error" style={{ width: '100%', maxWidth: '320px', fontSize: 13 }}>{error}</div>
      <button className="btn btn-secondary btn-sm" onClick={handleReset}>Try Again</button>
    </div>
  );
}

// ─── Image Carousel ────────────────────────────────────────
const CAROUSEL_IMAGES = [
  '/sliderimg1.jpg',
  '/sliderimg2.jpg',
  '/sliderimg3.jpg'
];

function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000); // Auto-slide every 4 seconds
    return () => clearInterval(timer);
  }, []);

  const goToNext = () => setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
  const goToPrev = () => setCurrentIndex((prev) => (prev - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 600, margin: '0 auto' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '65%', // Aspect ratio for images
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.15)', // Enhanced shadow
        border: '1px solid var(--border)',
        background: 'var(--bg-card)' // Background for the whitespace padding
      }}>
        {CAROUSEL_IMAGES.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`Slide ${idx + 1}`}
            style={{
              position: 'absolute',
              top: '16px', left: '16px',
              width: 'calc(100% - 32px)', height: 'calc(100% - 32px)',
              objectFit: 'cover',
              borderRadius: '12px',
              opacity: idx === currentIndex ? 1 : 0,
              transform: idx === currentIndex ? 'scale(1)' : 'scale(1.05)',
              transition: 'opacity 0.8s ease-in-out, transform 0.8s ease-in-out',
            }}
          />
        ))}
      </div>

      {/* Arrows */}
      <button
        className="hide-on-mobile"
        onClick={goToPrev}
        style={{
          position: 'absolute', top: '50%', left: '-20px', transform: 'translateY(-50%)',
          background: 'var(--bg)', border: '1px solid var(--border)',
          width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          color: 'var(--text)'
        }}
        aria-label="Previous image"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        className="hide-on-mobile"
        onClick={goToNext}
        style={{
          position: 'absolute', top: '50%', right: '-20px', transform: 'translateY(-50%)',
          background: 'var(--bg)', border: '1px solid var(--border)',
          width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          color: 'var(--text)'
        }}
        aria-label="Next image"
      >
        <ChevronRight size={24} />
      </button>

      {/* Indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
        {CAROUSEL_IMAGES.map((_, idx) => (
          <div
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            style={{
              width: idx === currentIndex ? 32 : 16,
              height: 5,
              borderRadius: 3,
              background: idx === currentIndex ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              opacity: idx === currentIndex ? 1 : 0.4
            }}
          />
        ))}
      </div>
    </div>
  );
}
