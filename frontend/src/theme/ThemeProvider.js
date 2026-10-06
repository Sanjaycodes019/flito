import React, { Fragment, createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { colors, applyScheme, applyDensity, breakpoints } from './tokens';
import { setThemePreference, useThemePreference } from '../services/themePreference';

const ThemeContext = createContext({ scheme: 'light', preference: 'system', setPreference: setThemePreference });

export const useTheme = () => useContext(ThemeContext);

// Resolves the preference (or the system setting) to 'light' or 'dark', swaps
// the shared palette, picks the density, and remounts the tree below it when
// either changes. The
// palette is read at render time all over the app, so a remount is what makes
// every screen pick up the new colors at once. Redux state is untouched.
export const ThemeProvider = ({ children }) => {
  const preference = useThemePreference();
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // Phones get the compact density, everything wider the regular one. On the
  // web it follows the window width; on a device it follows the shorter side,
  // so turning a phone sideways does not flip the density (which remounts the
  // tree and would lose what someone was typing).
  const { width, height } = useWindowDimensions();
  const density = (Platform.OS === 'web' ? width : Math.min(width, height)) < breakpoints.tablet ? 'compact' : 'regular';

  // During render, so the first paint already uses the right palette and sizes.
  applyScheme(scheme);
  applyDensity(density);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = colors.background;
    document.body.style.backgroundColor = colors.background;
  }, [scheme]);

  // Android: a solid status bar and navigation bar in the app's own colours, so
  // the header and bottom bar sit below/above them instead of running underneath
  // (which is how titles ended up behind the clock and notification icons).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setBackgroundColorAsync(colors.surface).catch(() => {});
    NavigationBar.setButtonStyleAsync(scheme === 'dark' ? 'light' : 'dark').catch(() => {});
  }, [scheme]);

  const value = useMemo(() => ({ scheme, preference, setPreference: setThemePreference }), [scheme, preference]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} translucent={false} backgroundColor={colors.surface} />
      <Fragment key={`${scheme}-${density}`}>{children}</Fragment>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
