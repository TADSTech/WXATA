import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'midnight' | 'nord' | 'cyberpunk' | 'rose' | 'ocean' | 'forest' | 'minimal' | 'sepia' | 'hacker' | 'sunset';

export const KNOWN_THEMES: Theme[] = [
  'midnight', 'nord', 'cyberpunk', 'rose', 'ocean',
  'forest', 'minimal', 'sepia', 'hacker', 'sunset'
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'midnight',
  setTheme: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('wxata-theme') as Theme | null;
      if (stored && (KNOWN_THEMES as string[]).includes(stored)) {
        return stored;
      }
      // Unknown or missing value — clear it and fall back to default
      localStorage.removeItem('wxata-theme');
      return 'midnight';
    } catch {
      // Private browsing or storage access denied
      return 'midnight';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wxata-theme', theme);
    } catch {
      // Private browsing or storage access denied — ignore
    }
    // Apply theme to html element for global CSS variable overrides
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      <div className="min-h-screen bg-bg-base transition-colors duration-300">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
