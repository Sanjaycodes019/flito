import { useSyncExternalStore } from 'react';
import i18n from '../i18n';
import { storage } from './storage';

// Which calendar the app shows dates in: 'bs' (Bikram Sambat, Nepal's official
// calendar) or 'ad' (Gregorian). Dates are always stored and sent as AD days;
// this only changes how they are shown and picked. BS is the default in both
// languages; AD applies only once someone chooses it.

export const CALENDAR_STORAGE_KEY = 'calendar';
export const CALENDARS = ['bs', 'ad'];

let chosen = null;
const listeners = new Set();

export const getCalendar = () => chosen || 'bs';

// Reads the saved choice. Called once at start-up, before anything renders.
export const loadCalendarPreference = async () => {
  try {
    const stored = await storage.getItem(CALENDAR_STORAGE_KEY);
    if (CALENDARS.includes(stored)) chosen = stored;
  } catch (error) {
    // No saved choice is fine: the default applies.
  }
};

export const setCalendar = async (calendar) => {
  if (!CALENDARS.includes(calendar) || calendar === getCalendar()) return;
  chosen = calendar;
  listeners.forEach((listener) => listener());
  // Plain formatting helpers (formatDate, dayLabel) aren't hooks, so screens
  // that call them re-render the way they do for a language change.
  i18n.emit('languageChanged', i18n.language);
  try {
    await storage.setItem(CALENDAR_STORAGE_KEY, calendar);
  } catch (error) {
    // The choice still applies for this session.
  }
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// The current calendar, re-rendering the component when it changes.
export const useCalendar = () => useSyncExternalStore(subscribe, getCalendar, getCalendar);
