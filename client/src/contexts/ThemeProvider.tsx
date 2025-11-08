import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import getTheme from '@/theme/muiTheme';

type ThemeContextValue = {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  setMode: (m: 'light' | 'dark') => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggleMode: () => {},
  setMode: () => {}
});

const STORAGE_KEY = 'riddle_theme_mode';

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) {}
    // Use prefers-color-scheme as default
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    try { 
      localStorage.setItem(STORAGE_KEY, mode);
      // Apply theme to document root for Tailwind dark mode
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(mode);
    } catch (e) {}
  }, [mode]);

  const setMode = (m: 'light' | 'dark') => setModeState(m);
  const toggleMode = () => setModeState((s) => (s === 'light' ? 'dark' : 'light'));

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, setMode }}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
