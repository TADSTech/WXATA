import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'hacker' | 'dark' | 'light' | 'sunset';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'hacker',
  setTheme: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('wxata-theme') as Theme) || 'hacker';
  });

  useEffect(() => {
    localStorage.setItem('wxata-theme', theme);
    // Also keep body class for any external styles, but the wrapper div is primary
    document.body.className = `theme-${theme}`;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      <div className={`theme-${theme} min-h-screen bg-bg-base transition-colors duration-300`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
