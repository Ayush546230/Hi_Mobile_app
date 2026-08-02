import React, { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Meeting, UserProfile } from '../types';
import { API, useAuth } from './AuthContext.jsx';

interface MeetingContextType {
  upcomingMeetings: Meeting[];
  userProfile: UserProfile;
  userPreferences: UserPreferences;
  loading: boolean;
  createInstantMeeting: () => Promise<Meeting>;
  scheduleMeeting: (data: ScheduleMeetingData) => Promise<Meeting>;
  addToHistory: (meeting: Meeting) => Promise<void>;
  cancelMeeting: (id: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  refreshMeetings: () => Promise<void>;
  sendInvites: (meetingId: string, emails?: string[]) => Promise<any>;
}

export interface UserPreferences {
  micDefault: boolean;
  speakerDefault: boolean;
  cameraDefault: boolean;
  notifications: boolean;
  soundEffects: boolean;
  timezone: string;
}

interface ScheduleMeetingData {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  participants?: { name: string; email: string }[];
  timezone?: string;
  notification?: { amount: number; unit: string; type: string };
  recurrence?: 'none' | 'daily' | 'weekly';
  recurrenceCount?: number;
  isPrivate?: boolean;
  isConsultation?: boolean;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'User',
  email: 'user@airender.com',
  avatar: '',
  initials: 'U',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  micDefault: false,
  speakerDefault: false,
  cameraDefault: false,
  notifications: true,
  soundEffects: true,
  timezone: 'Asia/Kolkata',
};

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // ─── Fetch meetings from backend on mount ───────────────
  const refreshMeetings = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUpcomingMeetings([]);
        return;
      }
      const res = await API.get('/meetings?type=upcoming&limit=20');
      const backendMeetings = (res.data.meetings || []).map((m: any) => ({
        id: m.id || m._id,
        userId: m.userId,
        title: m.title,
        roomName: m.roomName,
        link: m.link,
        startTime: m.startTime,
        endTime: m.endTime,
        description: m.description,
        participants: m.participants || [],
        status: m.status,
        hostJoined: m.hostJoined,
        isPrivate: m.isPrivate,
        isConsultation: m.isConsultation,
        createdAt: m.createdAt,
        duration: m.duration,
      }));
      setUpcomingMeetings(backendMeetings);
    } catch (err: any) {
      if (err.response?.status !== 401) {
        console.error('Failed to fetch meetings:', err.message);
      }
    }
  }, []);

  // ─── Fetch user profile + preferences on mount ──────────
  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUserProfile(DEFAULT_PROFILE);
        return;
      }
      const res = await API.get('/users/profile');
      const u = res.data.user;
      setUserProfile({
        id: u.id || u._id,
        displayName: u.preferences?.displayName || u.name || 'User',
        email: u.email,
        avatar: u.avatar || '',
        initials: (u.preferences?.displayName || u.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      });
      if (u.preferences) {
        setUserPreferences({
          micDefault: u.preferences.micDefault ?? false,
          speakerDefault: u.preferences.speakerDefault ?? false,
          cameraDefault: u.preferences.cameraDefault ?? false,
          notifications: u.preferences.notifications ?? true,
          soundEffects: u.preferences.soundEffects ?? true,
          timezone: u.preferences.timezone || 'Asia/Kolkata',
        });
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        console.error('Failed to fetch profile:', err.message);
      }
    }
  }, []);

  useEffect(() => {
    // Socket.io for real-time dashboard updates
    let socket: any = null;
    const setupSocket = (email: string) => {
      let apiUrl = (import.meta as any).env.VITE_API_URL || '';
      if (apiUrl.endsWith('/api')) apiUrl = apiUrl.replace(/\/api$/, '');
      
      socket = apiUrl ? io(apiUrl, { withCredentials: true }) : io({ withCredentials: true });
      socket.emit('join-dashboard', email);
      
      socket.on('dashboard-update', () => {
        refreshMeetings();
      });
    };

    const init = async () => {
      setLoading(true);
      await Promise.all([refreshMeetings(), fetchProfile()]);
      setLoading(false);
    };
    init();
    
    // We need to wait for fetchProfile to finish so we have the user's email to join the socket room
    // However, since user is from AuthContext, we can just use user.email directly if available
    const userEmail = (user as any)?.email;
    if (userEmail) {
      setupSocket(userEmail);
    }

    // Listen for auth changes (login/logout)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          init();
          const userEmail = (user as any)?.email;
          if (userEmail && !socket) setupSocket(userEmail);
        } else {
          setUpcomingMeetings([]);
          setUserProfile(DEFAULT_PROFILE);
          setUserPreferences(DEFAULT_PREFERENCES);
          if (socket) {
            socket.disconnect();
            socket = null;
          }
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      if (socket) socket.disconnect();
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshMeetings, fetchProfile, user]);

  // ─── Create Instant Meeting ─────────────────────────────
  const createInstantMeeting = useCallback(async (): Promise<Meeting> => {
    const res = await API.post('/meetings', { type: 'instant', title: 'Instant Meeting' });
    const m = res.data.meeting;
    const meeting: Meeting = {
      id: m.id || m._id,
      userId: m.userId,
      title: m.title,
      roomName: m.roomName,
      link: m.link,
      startTime: m.startTime,
      endTime: m.endTime,
      description: m.description,
      participants: m.participants || [],
      status: m.status,
      hostJoined: m.hostJoined,
      isPrivate: m.isPrivate,
      isConsultation: m.isConsultation,
      createdAt: m.createdAt,
      duration: m.duration,
    };
    setUpcomingMeetings(prev => [meeting, ...prev]);
    return meeting;
  }, []);

  // ─── Schedule Meeting ───────────────────────────────────
  const scheduleMeeting = useCallback(async (data: ScheduleMeetingData): Promise<Meeting> => {
    const res = await API.post('/meetings', {
      type: 'scheduled',
      title: data.title || 'Scheduled Meeting',
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      participants: data.participants,
      timezone: data.timezone,
      notification: data.notification,
      isPrivate: data.isPrivate,
      isConsultation: data.isConsultation,
    });
    const m = res.data.meeting;
    const meeting: Meeting = {
      id: m.id || m._id,
      userId: m.userId,
      title: m.title,
      roomName: m.roomName,
      link: m.link,
      startTime: m.startTime,
      endTime: m.endTime,
      description: m.description,
      participants: m.participants || [],
      status: m.status,
      hostJoined: m.hostJoined,
      isPrivate: m.isPrivate,
      isConsultation: m.isConsultation,
      createdAt: m.createdAt,
      duration: m.duration,
    };
    setUpcomingMeetings(prev => [meeting, ...prev]);
    return meeting;
  }, []);

  // ─── Mark as completed ──────────────────────────────────
  const addToHistory = useCallback(async (meeting: Meeting) => {
    try {
      await API.put(`/meetings/${meeting.id}`, { status: 'completed', duration: meeting.duration });
      setUpcomingMeetings(prev =>
        prev.map(m => (m.id === meeting.id ? { ...m, status: 'completed' as const, duration: meeting.duration } : m))
      );
    } catch (err) {
      console.error('Failed to update meeting:', err);
    }
  }, []);

  // ─── Cancel Meeting ─────────────────────────────────────
  const cancelMeeting = useCallback(async (id: string) => {
    try {
      await API.put(`/meetings/${id}`, { status: 'cancelled' });
      setUpcomingMeetings(prev => prev.map(m => (m.id === id ? { ...m, status: 'cancelled' as const } : m)));
    } catch (err) {
      console.error('Failed to cancel meeting:', err);
    }
  }, []);

  // ─── Delete Meeting ─────────────────────────────────────
  const deleteMeeting = useCallback(async (id: string) => {
    try {
      await API.delete(`/meetings/${id}`);
      setUpcomingMeetings(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  }, []);

  // ─── Clear History ──────────────────────────────────────
  const clearHistory = useCallback(async () => {
    try {
      await API.delete('/meetings/history/clear');
      setUpcomingMeetings([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
      throw err;
    }
  }, []);

  // ─── Update Profile ─────────────────────────────────────
  const updateProfile = useCallback(async (profile: Partial<UserProfile>) => {
    try {
      const res = await API.put('/users/profile', {
        displayName: profile.displayName,
        avatar: profile.avatar,
      });
      const u = res.data.user;
      setUserProfile({
        displayName: u.name || u.preferences?.displayName || 'User',
        email: u.email,
        avatar: u.avatar || '',
        initials: (u.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }, []);

  // ─── Update Preferences ─────────────────────────────────
  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    try {
      const res = await API.put('/users/preferences', prefs);
      setUserPreferences(prev => ({ ...prev, ...res.data.preferences }));
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  }, []);

  // ─── Send Invites ───────────────────────────────────────
  const sendInvites = useCallback(async (meetingId: string, emails?: string[]) => {
    const res = await API.post(`/meetings/${meetingId}/invite`, { emails });
    return res.data;
  }, []);

  const contextValue = React.useMemo(() => ({
    upcomingMeetings,
    userProfile,
    userPreferences,
    loading,
    createInstantMeeting,
    scheduleMeeting,
    addToHistory,
    cancelMeeting,
    deleteMeeting,
    clearHistory,
    updateProfile,
    updatePreferences,
    refreshMeetings,
    sendInvites,
  }), [
    upcomingMeetings,
    userProfile,
    userPreferences,
    loading,
    createInstantMeeting,
    scheduleMeeting,
    addToHistory,
    cancelMeeting,
    deleteMeeting,
    clearHistory,
    updateProfile,
    updatePreferences,
    refreshMeetings,
    sendInvites,
  ]);

  return (
    <MeetingContext.Provider value={contextValue}>
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeetings(): MeetingContextType {
  const context = useContext(MeetingContext);
  if (!context) throw new Error('useMeetings must be used within MeetingProvider');
  return context;
}
