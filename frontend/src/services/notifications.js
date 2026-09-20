import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from './api';
import socketService from './socket';

// The notification feed and its unread count, kept in one small store so the
// header bell, the feed screen and the number on the app icon always agree
// (same idea as admin/useAdminStats).
let state = { items: [], unreadCount: 0, loaded: false };
const listeners = new Set();
let socketWired = false;
let appStateSub = null;

const publish = (next) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
  // The launcher icon's badge. Android shows it as a dot or number, depending
  // on the phone's launcher; iOS as a number.
  if (Platform.OS !== 'web') Notifications.setBadgeCountAsync(state.unreadCount).catch(() => {});
};

export const refreshNotifications = async () => {
  try {
    const { data } = await api.get('/users/me/notifications');
    publish({ items: data.notifications, unreadCount: data.unreadCount, loaded: true });
  } catch {
    // The count is decoration; a failed refresh keeps the last known one.
  }
};

export const markNotificationsRead = async (ids) => {
  const idSet = ids ? new Set(ids) : null;
  publish({
    items: state.items.map((n) => (!idSet || idSet.has(n.id) ? { ...n, read: true } : n)),
    unreadCount: idSet ? Math.max(0, state.unreadCount - state.items.filter((n) => !n.read && idSet.has(n.id)).length) : 0,
  });
  try {
    const { data } = await api.post('/users/me/notifications/read', ids ? { ids } : {});
    publish({ unreadCount: data.unreadCount });
  } catch {
    refreshNotifications();
  }
};

// Called on sign-out so the next person on this phone doesn't inherit a count.
export const resetNotifications = () => {
  socketService.off('notification');
  socketWired = false; // the next sign-in opens a fresh socket
  publish({ items: [], unreadCount: 0, loaded: false });
};

// Live updates: the server tells an open app when something arrives, and the
// list is refreshed whenever the app comes back to the foreground.
const wireLive = (token) => {
  if (!socketWired && token) {
    socketService.connect(token);
    socketService.on('notification', () => refreshNotifications());
    socketWired = true;
  }
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') refreshNotifications();
    });
  }
};

const useNotifications = (token) => {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(state);
    if (token) {
      wireLive(token);
      if (!state.loaded) refreshNotifications();
    }
    return () => listeners.delete(setSnapshot);
  }, [token]);

  return snapshot;
};

export default useNotifications;
