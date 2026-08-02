import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Attach JWT to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Bootstrap ───────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }

    API.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setLoading(false));
  }, []);

  // ─── Helpers ─────────────────────────────────────────────
  const saveSession = useCallback((token, userData) => {
    localStorage.setItem('auth_token', token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  // ─── Google OAuth ─────────────────────────────────────────
  const loginWithGoogle = useCallback(async (credential) => {
    const res = await API.post('/auth/google', { credential });
    saveSession(res.data.token, res.data.user);
    return res.data.user;
  }, [saveSession]);

  // ─── Passkey Registration ─────────────────────────────────
  const registerPasskey = useCallback(async (email, name, passkeyName) => {
    const { startRegistration } = await import('@simplewebauthn/browser');

    // Step 1: Get challenge from server
    const optRes = await API.post('/passkeys/register/options', { email, name });
    const options = optRes.data.options;

    if (!options) {
      throw new Error(optRes.data.error || 'Server failed to generate passkey options');
    }

    // Step 2: Ask browser/OS to create passkey (triggers biometric/PIN prompt)
    const response = await startRegistration(options);

    // Step 3: Verify with server
    const verifyRes = await API.post('/passkeys/register/verify', { response, passkeyName });
    saveSession(verifyRes.data.token, verifyRes.data.user);
    return verifyRes.data.user;
  }, [saveSession]);

  // ─── Passkey Authentication ───────────────────────────────
  const loginWithPasskey = useCallback(async (email) => {
    const { startAuthentication } = await import('@simplewebauthn/browser');

    // Step 1: Get challenge
    const optRes = await API.post('/passkeys/auth/options', { email });
    const options = optRes.data.options;

    // Step 2: Authenticate with device (biometric/PIN prompt)
    const response = await startAuthentication(options);

    // Step 3: Verify
    const verifyRes = await API.post('/passkeys/auth/verify', { response });
    saveSession(verifyRes.data.token, verifyRes.data.user);
    return verifyRes.data.user;
  }, [saveSession]);

  // ─── Discoverable passkey (no email needed) ───────────────
  const loginWithDiscoverablePasskey = useCallback(async () => {
    const { startAuthentication } = await import('@simplewebauthn/browser');

    const optRes = await API.post('/passkeys/auth/options', {});
    const response = await startAuthentication(optRes.data.options);
    const verifyRes = await API.post('/passkeys/auth/verify', { response });
    saveSession(verifyRes.data.token, verifyRes.data.user);
    return verifyRes.data.user;
  }, [saveSession]);

  const deletePasskey = useCallback(async (credentialID) => {
    await API.delete(`/passkeys/${encodeURIComponent(credentialID)}`);
    const refreshed = await API.get('/auth/me');
    setUser(refreshed.data.user);
  }, []);

  // ─── Push Notification Auth ───────────────────────────────

  /**
   * Convert a base64 URL-encoded string to a Uint8Array
   * (needed for applicationServerKey in push subscription)
   */
  const urlBase64ToUint8Array = useCallback((base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  /**
   * Enable push notifications for login
   * Registers service worker, gets push subscription, saves to backend
   */
  const enablePushAuth = useCallback(async () => {
    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported in this browser');
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied. Please allow notifications.');
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const keyRes = await API.get('/push-auth/vapid-public-key');
    const vapidPublicKey = keyRes.data.publicKey;

    // Create push subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to backend
    const res = await API.post('/push-auth/subscribe', {
      subscription: subscription.toJSON(),
    });

    setUser(res.data.user);
    return res.data;
  }, [urlBase64ToUint8Array]);

  /**
   * Disable push notifications for login
   */
  const disablePushAuth = useCallback(async () => {
    let endpoint = null;
    // Unsubscribe from push
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          endpoint = subscription.endpoint;
          await subscription.unsubscribe();
        }
      }
    }

    // Remove from backend
    const res = await API.delete('/push-auth/subscribe', { data: { endpoint } });
    setUser(res.data.user);
    return res.data;
  }, []);

  /**
   * Initiate push login (sends notification to registered device)
   */
  const initiatePushLogin = useCallback(async (payload) => {
    const res = await API.post('/push-auth/initiate', payload);
    return res.data; // { requestId, expiresAt }
  }, []);

  /**
   * Check push login request status (for polling)
   */
  const checkPushLoginStatus = useCallback(async (requestId) => {
    const res = await API.get(`/push-auth/status/${requestId}`);
    if (res.data.status === 'approved' && res.data.token) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  }, [saveSession]);

  /**
   * Respond to push login request (approve/deny)
   */
  const respondToPushLogin = useCallback(async (requestId, token, action) => {
    const res = await API.post('/push-auth/respond', { requestId, token, action });
    if (res.data.token && res.data.user) {
      saveSession(res.data.token, res.data.user);
    }
    return res.data;
  }, [saveSession]);

  /**
   * Complete push login via WebSocket directly
   */
  const completePushLogin = useCallback((token, userData) => {
    saveSession(token, userData);
  }, [saveSession]);

  const authValue = React.useMemo(() => ({
    user, loading,
    loginWithGoogle,
    registerPasskey,
    loginWithPasskey,
    loginWithDiscoverablePasskey,
    deletePasskey,
    enablePushAuth,
    disablePushAuth,
    initiatePushLogin,
    checkPushLoginStatus,
    respondToPushLogin,
    completePushLogin,
    logout,
  }), [
    user, loading,
    loginWithGoogle,
    registerPasskey,
    loginWithPasskey,
    loginWithDiscoverablePasskey,
    deletePasskey,
    enablePushAuth,
    disablePushAuth,
    initiatePushLogin,
    checkPushLoginStatus,
    respondToPushLogin,
    completePushLogin,
    logout,
  ]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export { API };
