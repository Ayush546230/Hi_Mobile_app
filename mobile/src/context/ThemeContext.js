import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext(null);

const themes = {
  light: {
    primary: '#6C63FF',
    primaryHover: '#5a52e0',
    primaryLight: 'rgba(108,99,255,0.12)',
    accentGreen: '#00C853',
    accentRed: '#ea4335',
    accentCyan: '#06B6D4',
    bg: '#f8f9fa',
    bgCard: '#ffffff',
    bgSidebar: '#f1f3f4',
    bgHover: '#e8eaed',
    text: '#202124',
    textSecondary: '#5f6368',
    textMuted: '#9aa0a6',
    border: '#dadce0',
    cream: '#f5f0e8',
    gold: '#b8963e',
    goldPale: '#f0e6c8',
    white: '#fdfcf9',
    error: '#c0392b',
    success: '#2d6a4f',
  },
  dark: {
    primary: '#6C63FF',
    primaryHover: '#5a52e0',
    primaryLight: 'rgba(108,99,255,0.12)',
    accentGreen: '#00C853',
    accentRed: '#ea4335',
    accentCyan: '#06B6D4',
    bg: '#0f0f1a',
    bgCard: '#1a1a2e',
    bgSidebar: '#12121f',
    bgHover: '#252540',
    text: '#e8eaed',
    textSecondary: '#9aa0a6',
    textMuted: '#6b7280',
    border: '#2d2d4a',
    cream: '#1a1a2e',
    gold: '#b8963e',
    goldPale: '#252540',
    white: '#12121f',
    error: '#ea4335',
    success: '#00C853',
  },
  grey: {
    primary: '#38bdf8',
    primaryHover: '#0ea5e9',
    primaryLight: 'rgba(56, 189, 248, 0.15)',
    accentGreen: '#34d399',
    accentRed: '#fb7185',
    accentCyan: '#22d3ee',
    bg: '#18181b',
    bgCard: '#27272a',
    bgSidebar: '#1f1f22',
    bgHover: '#3f3f46',
    text: '#ffffff',
    textSecondary: '#e4e4e7',
    textMuted: '#a1a1aa',
    border: '#3f3f46',
    cream: '#27272a',
    gold: '#38bdf8',
    goldPale: 'rgba(56, 189, 248, 0.1)',
    white: '#1f1f22',
    error: '#fb7185',
    success: '#34d399',
  }
};

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('dark'); // Default to dark mirroring video-app feel

  useEffect(() => {
    AsyncStorage.getItem('theme')
      .then((val) => {
        if (val && themes[val]) {
          setThemeName(val);
        }
      })
      .catch((err) => console.log('Theme loading error:', err));
  }, []);

  const changeTheme = async (name) => {
    if (themes[name]) {
      setThemeName(name);
      await AsyncStorage.setItem('theme', name);
    }
  };

  const colors = themes[themeName];

  return (
    <ThemeContext.Provider value={{ theme: themeName, colors, changeTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export { themes };
