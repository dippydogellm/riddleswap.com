import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'day' | 'night' | 'fuzzy' | 'doginals' | 'seal' | 'green';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('riddle-theme') as ThemeMode;
      const validThemes: ThemeMode[] = ['light', 'dark', 'day', 'night', 'fuzzy', 'doginals', 'seal', 'green'];
      if (stored && validThemes.includes(stored)) {
        return stored;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    setTheme(current => current === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('riddle-theme', theme);
      
      // Remove all theme classes
      document.documentElement.classList.remove('light', 'dark', 'theme-day', 'theme-night', 'theme-fuzzy', 'theme-doginals', 'theme-seal', 'theme-green');
      
      // For standard light/dark themes, use "dark" class that Tailwind expects
      if (theme === 'dark' || theme === 'night') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light' || theme === 'day') {
        document.documentElement.classList.add('light');
      } else {
        // For custom themes, add the specific theme class
        document.documentElement.classList.add(`theme-${theme}`);
      }
      
      // Set data attribute for CSS
      document.documentElement.setAttribute('data-theme', theme);
      
      console.log(`🎨 [THEME] Applied theme: ${theme}, dark class: ${document.documentElement.classList.contains('dark')}`);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
