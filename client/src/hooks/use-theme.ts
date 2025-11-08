import { useState, useEffect, createContext, useContext } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback for when used outside provider
    const [theme, setThemeState] = useState<Theme>(() => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme') as Theme;
        if (stored && (stored === 'light' || stored === 'dark')) {
          return stored;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    });

    const setTheme = (newTheme: Theme) => {
      setThemeState(newTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
        updateDocumentClass(newTheme);
      }
    };

    const toggleTheme = () => {
      setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return { theme, setTheme, toggleTheme };
  }
  return context;
}

function updateDocumentClass(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }
}

export { ThemeContext, updateDocumentClass };
export type { Theme, ThemeContextType };
