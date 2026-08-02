import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const MeetingContext = createContext(null);

const DEFAULT_PROFILE = {
  displayName: 'User',
  email: 'user@airender.com',
  avatar: '',
  initials: 'U',
};

const DEFAULT_PREFERENCES = {
  micDefault: false,
  speakerDefault: false,
  cameraDefault: false,
  notifications: true,
  soundEffects: true,
  timezone: 'Asia/Kolkata',
};

export function MeetingProvider({ children }) {
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);
  const [userPreferences, setUserPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  
  const { user, API, socket } = useAuth();

  // Fetch upcoming meetings
  const refreshUpcomingMeetings = useCallback(async () => {
    try {
      const res = await API.get('/meetings?type=upcoming&limit=50');
      const formatted = (res.data.meetings || []).map((m) => ({
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
      setUpcomingMeetings(formatted);
    } catch (err) {
      console.log('Error fetching upcoming meetings:', err.message);
    }
  }, [API]);

  // Fetch meeting history
  const refreshMeetingHistory = useCallback(async () => {
    try {
      const res = await API.get('/meetings?type=history&limit=50');
      const formatted = (res.data.meetings || []).map((m) => ({
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
      setMeetingHistory(formatted);
    } catch (err) {
      console.log('Error fetching history meetings:', err.message);
    }
  }, [API]);

  // Fetch user profile and preferences
  const fetchProfile = useCallback(async () => {
    try {
      const res = await API.get('/users/profile');
      const u = res.data.user;
      setUserProfile({
        id: u.id || u._id,
        displayName: u.preferences?.displayName || u.name || 'User',
        email: u.email,
        avatar: u.avatar || '',
        initials: (u.preferences?.displayName || u.name || 'U')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
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
    } catch (err) {
      console.log('Error fetching profile:', err.message);
    }
  }, [API]);

  // General bootstrap
  const init = useCallback(async () => {
    if (!user) {
      setUpcomingMeetings([]);
      setMeetingHistory([]);
      setUserProfile(DEFAULT_PROFILE);
      setUserPreferences(DEFAULT_PREFERENCES);
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([
      refreshUpcomingMeetings(),
      refreshMeetingHistory(),
      fetchProfile()
    ]);
    setLoading(false);
  }, [user, refreshUpcomingMeetings, refreshMeetingHistory, fetchProfile]);

  useEffect(() => {
    init();
  }, [user, init]);

  // Socket updates for dashboard
  useEffect(() => {
    if (!socket) return;
    
    const handleDashboardUpdate = () => {
      refreshUpcomingMeetings();
      refreshMeetingHistory();
    };

    socket.on('dashboard-update', handleDashboardUpdate);
    return () => {
      socket.off('dashboard-update', handleDashboardUpdate);
    };
  }, [socket, refreshUpcomingMeetings, refreshMeetingHistory]);

  // Create instant meeting
  const createInstantMeeting = useCallback(async () => {
    const res = await API.post('/meetings', { type: 'instant', title: 'Instant Meeting' });
    const m = res.data.meeting;
    const meeting = {
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
    setUpcomingMeetings((prev) => [meeting, ...prev]);
    return meeting;
  }, [API]);

  // Schedule new meeting
  const scheduleMeeting = useCallback(async (data) => {
    const res = await API.post('/meetings', {
      type: 'scheduled',
      title: data.title || 'Scheduled Meeting',
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      participants: data.participants,
      timezone: data.timezone,
      isPrivate: data.isPrivate,
      isConsultation: data.isConsultation,
    });
    const m = res.data.meeting;
    const meeting = {
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
    setUpcomingMeetings((prev) => [meeting, ...prev]);
    return meeting;
  }, [API]);

  // Mark meeting as completed
  const addToHistory = useCallback(async (meeting) => {
    try {
      await API.put(`/meetings/${meeting.id}`, { status: 'completed', duration: meeting.duration });
      setUpcomingMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
      setMeetingHistory((prev) => [
        { ...meeting, status: 'completed', duration: meeting.duration },
        ...prev
      ]);
    } catch (err) {
      console.error('Error adding meeting to history:', err);
    }
  }, [API]);

  // Cancel scheduled meeting
  const cancelMeeting = useCallback(async (id) => {
    try {
      await API.put(`/meetings/${id}`, { status: 'cancelled' });
      refreshUpcomingMeetings();
      refreshMeetingHistory();
    } catch (err) {
      console.error('Error cancelling meeting:', err);
    }
  }, [API, refreshUpcomingMeetings, refreshMeetingHistory]);

  // Delete/remove meeting from view
  const deleteMeeting = useCallback(async (id) => {
    try {
      await API.delete(`/meetings/${id}`);
      setUpcomingMeetings((prev) => prev.filter((m) => m.id !== id));
      setMeetingHistory((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Error deleting meeting:', err);
    }
  }, [API]);

  // Clear all past history
  const clearHistory = useCallback(async () => {
    try {
      await API.delete('/meetings/history/clear');
      setMeetingHistory([]);
    } catch (err) {
      console.error('Error clearing history:', err);
      throw err;
    }
  }, [API]);

  // Update profile
  const updateProfile = useCallback(async (profile) => {
    try {
      const res = await API.put('/users/profile', {
        displayName: profile.displayName,
      });
      setUserProfile((prev) => ({
        ...prev,
        displayName: res.data.user.preferences?.displayName || res.data.user.name,
      }));
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  }, [API]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs) => {
    try {
      const res = await API.put('/users/preferences', prefs);
      const updatedPrefs = res.data.user.preferences;
      setUserPreferences({
        micDefault: updatedPrefs.micDefault,
        speakerDefault: updatedPrefs.speakerDefault,
        cameraDefault: updatedPrefs.cameraDefault,
        notifications: updatedPrefs.notifications,
        soundEffects: updatedPrefs.soundEffects,
        timezone: updatedPrefs.timezone,
      });
    } catch (err) {
      console.error('Error updating preferences:', err);
    }
  }, [API]);

  // Send email invitations
  const sendInvites = useCallback(async (meetingId, emails) => {
    const res = await API.post(`/meetings/${meetingId}/invite`, { emails });
    return res.data;
  }, [API]);

  const value = {
    upcomingMeetings,
    meetingHistory,
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
    sendInvites,
    refreshMeetings: init,
  };

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  );
}

export const useMeetings = () => useContext(MeetingContext);
