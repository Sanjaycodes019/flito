import React, { Fragment, createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, applyScheme } from './tokens';
import { setThemePreference, useThemePreference } from '../services/themePreference';

const ThemeContext = createContext({ scheme: 'light', preference: 'system', setPreference: setThemePreference });

export const useTheme = () => useContext(ThemeContext);

// Resolves the preference (or the system setting) to 'light' or 'dark', swaps
// the shared palette, and remounts the tree below it when that changes. The
// palette is read at render time all over the app, so a remount is what makes
// every screen pick up the new colors at once. Redux state is untouched.
export const ThemeProvider = ({ children }) => {
  const preference = useThemePreference();
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // During render, so the first paint already uses the right palette.
  applyScheme(scheme);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = colors.background;
    document.body.style.backgroundColor = colors.background;
  }, [scheme]);

  const value = useMemo(() => ({ scheme, preference, setPreference: setThemePreference }), [scheme, preference]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Fragment key={scheme}>{children}</Fragment>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
