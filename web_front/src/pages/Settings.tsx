import React, { useState, useEffect } from 'react';
import { useMeetings } from '../context/MeetingContext';
import { useTheme } from '../context/ThemeContext';
import { API } from '../context/AuthContext';

// Helper function to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Settings() {
  const { userProfile, userPreferences, updateProfile, updatePreferences } = useMeetings();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(userProfile.displayName);
  const [email, setEmail] = useState(userProfile.email);
  const [notifications, setNotifications] = useState(userPreferences.notifications);
  const [sounds, setSounds] = useState(userPreferences.soundEffects);
  const [mic, setMic] = useState(userPreferences.micDefault);
  const [speaker, setSpeaker] = useState(userPreferences.speakerDefault);
  const [camera, setCamera] = useState(userPreferences.cameraDefault);
  const [saved, setSaved] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [avatar, setAvatar] = useState(userProfile.avatar || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Sync when profile loads from backend
  useEffect(() => {
    setName(userProfile.displayName);
    setEmail(userProfile.email);
    setAvatar(userProfile.avatar || '');
  }, [userProfile]);

  useEffect(() => {
    setNotifications(userPreferences.notifications);
    setSounds(userPreferences.soundEffects);
    setMic(userPreferences.micDefault);
    setSpeaker(userPreferences.speakerDefault);
    setCamera(userPreferences.cameraDefault);
  }, [userPreferences]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    let avatarData = avatar;
    if (avatarFile) {
      avatarData = await fileToBase64(avatarFile);
    }
    await updateProfile({ displayName: name, email, avatar: avatarData });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSavePreferences = async () => {
    try {
      if (notifications) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Register service worker and subscribe to push
          const registration = await navigator.serviceWorker.register('/sw.js');
          const vapidRes = await API.get('/push-auth/vapid-public-key');
          const publicKey = vapidRes.data.publicKey;
          
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
          });
          
          await API.post('/push-auth/subscribe', { subscription });
        } else {
          alert('Please allow notifications in your browser settings to receive reminders.');
        }
      } else {
        // Unsubscribe from push
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
        await API.delete('/push-auth/subscribe');
      }
    } catch (err) {
      console.error('Failed to configure push notifications:', err);
    }

    await updatePreferences({
      micDefault: mic,
      speakerDefault: speaker,
      cameraDefault: camera,
      notifications,
      soundEffects: sounds,
    });
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  return (
    <div className="settings-page" id="settings-page">
      <h1 style={{ marginBottom: 8 }}>Settings & Preferences</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Manage your profile and preferences</p>

      <div className="settings-section">
        <h2>Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 600,
            overflow: 'hidden'
          }}>
            {avatar ? <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (name.charAt(0).toUpperCase() || 'U')}
          </div>
          <div>
            <label htmlFor="avatar-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
              Change Avatar
            </label>
            <input 
              type="file" 
              id="avatar-upload" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  if (file.size > 2 * 1024 * 1024) {
                    alert('File size must be under 2MB');
                    return;
                  }
                  setAvatarFile(file);
                  setAvatar(URL.createObjectURL(file));
                }
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              JPG, GIF or PNG. Max size 2MB.
            </div>
          </div>
        </div>
        <div className="form-group">
          <label>Display Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input className="form-input" type="email" value={email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Email is linked to your authentication and cannot be changed</small>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved Profile' : 'Save Profile'}
        </button>
      </div>

      <div className="settings-section">
        <h2>Appearance</h2>
        <div className="setting-row">
          <div className="setting-label">
            <h4>Dark Mode</h4>
            <p>Switch between light and dark themes</p>
          </div>
          <div className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme} />
        </div>
      </div>

      <div className="settings-section">
        <h2>Notifications</h2>
        <div className="setting-row">
          <div className="setting-label">
            <h4>Meeting Reminders</h4>
            <p>Get notified before scheduled meetings</p>
          </div>
          <div className={`toggle ${notifications ? 'active' : ''}`} onClick={() => setNotifications(!notifications)} />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <h4>Sound Effects</h4>
            <p>Play sounds for join/leave and notifications</p>
          </div>
          <div className={`toggle ${sounds ? 'active' : ''}`} onClick={() => setSounds(!sounds)} />
        </div>
      </div>

      <div className="settings-section">
        <h2>Audio & Video</h2>
        <div className="setting-row">
          <div className="setting-label">
            <h4>Microphone</h4>
            <p>Enable microphone by default when joining</p>
          </div>
          <div className={`toggle ${mic ? 'active' : ''}`} onClick={() => setMic(!mic)} />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <h4>Speaker</h4>
            <p>Enable speaker by default</p>
          </div>
          <div className={`toggle ${speaker ? 'active' : ''}`} onClick={() => setSpeaker(!speaker)} />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <h4>Camera</h4>
            <p>Enable camera by default when joining</p>
          </div>
          <div className={`toggle ${camera ? 'active' : ''}`} onClick={() => setCamera(!camera)} />
        </div>
        <button className="btn btn-primary" onClick={handleSavePreferences} style={{ marginTop: 16 }}>
          {prefsSaved ? '✓ Preferences Saved!' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
