import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './api';
import { navigate } from '../navigation/navigationRef';
import { refreshNotifications } from './notifications';

// Web has no Expo push token to register. Browser push needs its own VAPID
// setup, out of scope here. The web build stays fully live via the existing
// Socket.io connection instead, so nothing is lost while the tab is open.
const supportsPush = () => Platform.OS !== 'web' && Device.isDevice;

// Shown while the app is in the foreground. Screens already update live via
// Socket.io, so this is a secondary confirmation, not the only signal, still
// worth a banner (e.g. a quote arriving while on an unrelated screen).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Registers this device for push and sends the token to the backend. Safe to
// call every time the app opens with a valid session. The backend simply
// overwrites whatever token was stored, so re-registering is a no-op in effect
// when the token hasn't changed.
export const registerForPushNotifications = async () => {
  if (!supportsPush()) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        showBadge: true,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9F00',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return; // user declined, nothing more to do

    // A real EAS build needs the project id for a reliable token; running in
    // Expo Go for local testing works without it. Run `eas init` before
    // shipping a standalone build if this is ever undefined there.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await api.patch('/users/me/push-token', { pushToken: token });
  } catch (error) {
    // Push is a nice-to-have, not on the critical path of using the app.
    // a failure here should never surface as an error to the user.
    console.log('[push] registration skipped:', error.message);
  }
};

// Called on logout so a device stops receiving push for an account that just
// signed out of it; best-effort, since by the time this runs the user may
// already be unauthenticated on the server.
export const unregisterPushNotifications = async () => {
  if (!supportsPush()) return;
  try {
    await api.delete('/users/me/push-token');
  } catch (error) {
    console.log('[push] unregister skipped:', error.message);
  }
};

// Where tapping a notification of each `data.type` should land. Mirrors the
// nested-navigator shape used elsewhere (see VerificationPrompt.js).
export const routeForNotification = (data) => {
  if (data?.type === 'load' && data.loadId) {
    return ['HomeTab', { screen: 'LoadDetail', params: { loadId: data.loadId } }];
  }
  if (data?.type === 'booking' && data.bookingId) {
    return ['HomeTab', { screen: 'BookingDetail', params: { bookingId: data.bookingId } }];
  }
  if (data?.type === 'kyc') {
    return ['Profile', { screen: 'Kyc' }];
  }
  return null;
};

// Subscribes to notification taps and routes to the relevant screen. Returns
// an unsubscribe function; call once near the app root (App.js).
export const subscribeToNotificationTaps = () => {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = routeForNotification(response.notification.request.content.data);
    if (route) navigate(...route);
    refreshNotifications();
  });
  // A push that lands while the app is open bumps the count right away.
  const received = Notifications.addNotificationReceivedListener(() => refreshNotifications());
  return () => { subscription.remove(); received.remove(); };
};
