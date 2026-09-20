import { useSyncExternalStore } from 'react';
import { storage } from './storage';

// Which look the app uses: 'system' (follow the phone or browser, the
// default), or 'light' / 'dark' when someone picks one. Remembered on the
// device, like the calendar choice.

export const THEME_STORAGE_KEY = 'theme';
export const THEME_PREFERENCES = ['system', 'light', 'dark'];

let chosen = 'system';
const listeners = new Set();

export const getThemePreference = () => chosen;

// Reads the saved choice. Called once at start-up, before anything renders.
export const loadThemePreference = async () => {
  try {
    const stored = await storage.getItem(THEME_STORAGE_KEY);
    if (THEME_PREFERENCES.includes(stored)) chosen = stored;
  } catch (error) {
    // No saved choice is fine: it follows the system.
  }
};

export const setThemePreference = async (preference) => {
  if (!THEME_PREFERENCES.includes(preference) || preference === chosen) return;
  chosen = preference;
  listeners.forEach((listener) => listener());
  try {
    await storage.setItem(THEME_STORAGE_KEY, preference);
  } catch (error) {
    // The choice still applies for this session.
  }
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useThemePreference = () => useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
