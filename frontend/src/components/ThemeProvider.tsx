import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'midnight' | 'nord' | 'cyberpunk' | 'rose' | 'ocean' | 'forest' | 'minimal' | 'sepia' | 'hacker' | 'sunset';

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
    return (localStorage.getItem('wxata-theme') as Theme) || 'midnight';
  });

  useEffect(() => {
    localStorage.setItem('wxata-theme', theme);
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
