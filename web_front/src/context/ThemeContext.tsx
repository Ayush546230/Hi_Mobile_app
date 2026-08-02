import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'grey';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  toggleGreyTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('airender-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'grey') return saved as Theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [prevTheme, setPrevTheme] = useState<Theme>('light');

  useEffect(() => {
    if (theme !== 'grey') {
      setPrevTheme(theme);
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('airender-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'grey' ? 'light' : 'dark'));
  const toggleGreyTheme = () => setTheme((prev) => (prev === 'grey' ? prevTheme : 'grey'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, toggleGreyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
