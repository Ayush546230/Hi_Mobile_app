export interface Meeting {
  id: string;
  userId?: string;
  title: string;
  roomName: string;
  link: string;
  startTime: string;
  endTime?: string;
  description?: string;
  participants: Participant[];
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
  duration?: number;
  hostJoined?: boolean;
  isPrivate?: boolean;
  isConsultation?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface UserProfile {
  id?: string;
  displayName: string;
  email: string;
  avatar: string;
  initials: string;
}

export interface DevicePreferences {
  audioInput: string;
  audioOutput: string;
  videoInput: string;
  audioMuted: boolean;
  videoMuted: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  soundEffects: boolean;
}

export type ModalType = 'schedule' | 'invite' | 'settings' | null;
