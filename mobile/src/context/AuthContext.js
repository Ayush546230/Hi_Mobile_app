import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import * as Passkeys from 'react-native-passkeys';
import messaging from '@react-native-firebase/messaging';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const AuthContext = createContext(null);

const DEFAULT_API_URL = 'https://hi-mobile-app-n6sh.onrender.com/api';

// Helper: wrap a promise with a timeout so it doesn't hang forever
function withTimeout(promise, ms, label = 'Operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [socket, setSocket] = useState(null);
  const loggingOut = useRef(false);
  const hasSetupFirebase = useRef(false);

  // Load backend host and auth token on bootstrap
  useEffect(() => {
    async function bootstrap() {
      try {
        const savedApiUrl = await AsyncStorage.getItem('backend_api_url');
        const activeApiUrl = savedApiUrl || DEFAULT_API_URL;
        setApiUrl(activeApiUrl);

        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          const res = await axios.get(`${activeApiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data.user);
        }
      } catch (err) {
        console.log('Bootstrap auth error:', err.message);
        await AsyncStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  // Axios helper creator
  const API = useMemo(() => {
    const instance = axios.create({
      baseURL: apiUrl,
      timeout: 60000,
      headers: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });
    instance.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [apiUrl]);

  // FCM Device Registration helper
  const registerFcmToken = useCallback(async (fcmToken) => {
    try {
      const res = await API.post('/push-auth/register-token', { fcmToken });
      setUser(res.data.user);
      return res.data;
    } catch (err) {
      console.log('FCM token registration failed on server:', err.message);
    }
  }, [API]);

  // Firebase Push Notifications Setup
  useEffect(() => {
    if (!user || loggingOut.current || hasSetupFirebase.current) return;

    const setupFirebase = async () => {
      try {
        hasSetupFirebase.current = true;
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          const fcmToken = await messaging().getToken();
          if (fcmToken && !loggingOut.current) {
            await registerFcmToken(fcmToken);
          }
        }
      } catch (err) {
        hasSetupFirebase.current = false;
        console.log('Firebase messaging setup failed:', err.message);
      }
    };
    setupFirebase();
  }, [user, registerFcmToken]);

  // Set up socket when user logs in and apiUrl updates
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = apiUrl.replace(/\/api$/, '');
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    setSocket(newSocket);

    if (user.email) {
      newSocket.emit('join-dashboard', user.email);
    }

    return () => {
      newSocket.disconnect();
    };
  }, [user, apiUrl]);

  const updateBackendHost = useCallback(async (newUrl) => {
    setApiUrl(newUrl);
    await AsyncStorage.setItem('backend_api_url', newUrl);
  }, []);

  const saveSession = useCallback(async (token, userData) => {
    await AsyncStorage.setItem('auth_token', token);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    loggingOut.current = true;
    try {
      // Keep FCM token registered to allow push notifications when logged out
      // await API.delete('/push-auth/register-token');
    } catch (err) {
      console.log('FCM token unregistration failed:', err.message);
    }
    try {
      // Explicitly sign out from Google to prompt the account chooser next time
      GoogleSignin.configure({
        webClientId: '778684435806-paa3crjb147a24meuj19em8jir66b2tf.apps.googleusercontent.com',
        offlineAccess: true,
      });
      await GoogleSignin.signOut();
    } catch (err) {
      console.log('Google sign-out failed during app logout:', err.message);
    }
    await AsyncStorage.removeItem('auth_token');
    setUser(null);
    hasSetupFirebase.current = false;
    setTimeout(() => { loggingOut.current = false; }, 500);
  }, []);

  // devEmailLogin
  const devEmailLogin = useCallback(async (email, name) => {
    const res = await API.post('/auth/dev-login', { email, name });
    await saveSession(res.data.token, res.data.user);
    return res.data.user;
  }, [API, saveSession]);

  // Google Login
  const loginWithGoogle = useCallback(async (credential) => {
    const res = await API.post('/auth/google', { credential });
    await saveSession(res.data.token, res.data.user);
    return res.data.user;
  }, [API, saveSession]);

  // Native WebAuthn Passkey Registration
  const registerPasskey = useCallback(async (email, name) => {
    try {
      const optionsRes = await API.post('/passkeys/register/options', { email, name });
      const { options, challengeId } = optionsRes.data;

      const passkeyResponse = await withTimeout(
        Passkeys.create(options),
        60000,
        'Passkey registration'
      );

      if (!passkeyResponse) {
        throw new Error('Passkey creation was cancelled.');
      }

      const verifyRes = await API.post('/passkeys/register/verify', {
        response: passkeyResponse,
        passkeyName: 'Mobile Passkey',
        challengeId,
      });

      await saveSession(verifyRes.data.token, verifyRes.data.user);
      return verifyRes.data.user;
    } catch (err) {
      console.error('Passkey registration error:', err);
      throw new Error(err?.response?.data?.error || err.message || 'Passkey registration failed');
    }
  }, [API, saveSession]);

  // Native WebAuthn Passkey Login
  const loginWithPasskey = useCallback(async () => {
    try {
      const optionsRes = await API.post('/passkeys/auth/options', {});
      const { options, challengeId } = optionsRes.data;

      const passkeyResponse = await withTimeout(
        Passkeys.get(options),
        60000,
        'Passkey authentication'
      );

      if (!passkeyResponse) {
        throw new Error('Passkey sign-in was cancelled.');
      }

      const verifyRes = await API.post('/passkeys/auth/verify', {
        response: passkeyResponse,
        challengeId,
      });

      await saveSession(verifyRes.data.token, verifyRes.data.user);
      return verifyRes.data.user;
    } catch (err) {
      console.error('Passkey login error:', err);
      throw new Error(err?.response?.data?.error || err.message || 'Passkey login failed');
    }
  }, [API, saveSession]);

  // Push login APIs
  const initiatePushLogin = useCallback(async (payload) => {
    const res = await API.post('/push-auth/initiate', payload);
    return res.data;
  }, [API]);

  const checkPushLoginStatus = useCallback(async (requestId) => {
    const res = await API.get(`/push-auth/status/${requestId}`);
    if (res.data.status === 'approved' && res.data.token) {
      await saveSession(res.data.token, res.data.user);
    }
    return res.data;
  }, [API, saveSession]);

  const respondToPushLogin = useCallback(async (requestId, token, action) => {
    const res = await API.post('/push-auth/respond', { requestId, token, action });
    return res.data;
  }, [API]);

  // Toggle push authenticator status in settings
  const enablePushAuth = useCallback(async () => {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          const res = await registerFcmToken(fcmToken);
          return res;
        }
      }
      throw new Error('FCM token permissions denied');
    } catch (err) {
      throw new Error(err.message || 'Failed to enable push authentication');
    }
  }, [registerFcmToken]);

  const disablePushAuth = useCallback(async () => {
    try {
      const res = await API.delete('/push-auth/register-token');
      setUser(res.data.user);
      return res.data;
    } catch (err) {
      throw new Error(err.message || 'Failed to disable push authentication');
    }
  }, [API]);

  // Foreground Notification Handler (Notifee)
  useEffect(() => {
    async function setupChannels() {
      try {
        await notifee.createChannel({
          id: 'meeting_reminders',
          name: 'Meeting Reminders',
          importance: AndroidImportance.HIGH,
          sound: 'default',
        });
        await notifee.createChannel({
          id: 'meeting_reminders_silent',
          name: 'Meeting Reminders (Silent)',
          importance: AndroidImportance.DEFAULT,
          sound: undefined,
        });
      } catch (err) {
        console.log('Error creating default channels:', err.message);
      }
    }
    setupChannels();

    let unsubscribe;
    try {
      unsubscribe = messaging().onMessage(async remoteMessage => {
        try {
          await notifee.requestPermission();
          
          const hasSounds = user?.preferences?.soundEffects !== false;
          const channelId = await notifee.createChannel({
            id: hasSounds ? 'auth_requests' : 'auth_requests_silent',
            name: hasSounds ? 'Login Requests' : 'Login Requests (Silent)',
            importance: AndroidImportance.HIGH,
            sound: hasSounds ? 'default' : undefined,
          });

          if (remoteMessage.data?.type === 'push_login') {
            const { requestId, token } = remoteMessage.data;
            await notifee.displayNotification({
              title: remoteMessage.notification?.title || "Login Request",
              body: remoteMessage.notification?.body || "Approve this login attempt?",
              data: { requestId, token },
              android: {
                channelId,
                importance: AndroidImportance.HIGH,
                actions: [
                  { title: 'Deny', pressAction: { id: 'deny' } },
                  { title: 'Approve', pressAction: { id: 'approve' } },
                ],
              },
            });
          } else {
            await notifee.displayNotification({
              title: remoteMessage.notification?.title || "Notification",
              body: remoteMessage.notification?.body,
              android: { 
                channelId, 
                importance: hasSounds ? AndroidImportance.HIGH : AndroidImportance.DEFAULT 
              },
            });
          }
        } catch (e) {
          console.log('Notifee execution failed inside onMessage:', e.message);
        }
      });
    } catch (err) {
      console.log('Firebase onMessage subscription skipped:', err.message);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Foreground Action Handler
  useEffect(() => {
    let unsubscribe;
    try {
      if (notifee && typeof notifee.onForegroundEvent === 'function') {
        unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.ACTION_PRESS && detail.notification?.data) {
            const { requestId, token } = detail.notification.data;
            if (detail.pressAction.id === 'approve') {
              respondToPushLogin(requestId, token, 'approve');
            } else if (detail.pressAction.id === 'deny') {
              respondToPushLogin(requestId, token, 'deny');
            }
            if (detail.notification.id) {
              notifee.cancelNotification(detail.notification.id);
            }
          }
        });
      }
    } catch (err) {
      console.log('Notifee onForegroundEvent subscription skipped:', err.message);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [respondToPushLogin]);

  const value = useMemo(() => ({
    user,
    loading,
    apiUrl,
    socket,
    API,
    updateBackendHost,
    devEmailLogin,
    loginWithGoogle,
    registerPasskey,
    loginWithPasskey,
    initiatePushLogin,
    checkPushLoginStatus,
    respondToPushLogin,
    enablePushAuth,
    disablePushAuth,
    saveSession,
    setUser,
    logout
  }), [
    user,
    loading,
    apiUrl,
    socket,
    API,
    updateBackendHost,
    devEmailLogin,
    loginWithGoogle,
    registerPasskey,
    loginWithPasskey,
    initiatePushLogin,
    checkPushLoginStatus,
    respondToPushLogin,
    enablePushAuth,
    disablePushAuth,
    saveSession,
    setUser,
    logout
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
