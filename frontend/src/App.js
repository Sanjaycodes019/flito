import React, { useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { store } from './redux/store';
import { loginSuccess, setHydrated } from './redux/slices/authSlice';
import { authService } from './services/auth';
import { registerForPushNotifications, subscribeToNotificationTaps } from './services/pushNotifications';
import RootNavigator from './navigation/RootNavigator';
import AlertHost from './components/common/AlertHost';
import CameraCaptureHost from './components/common/CameraCaptureHost';
import { initI18n } from './i18n';
import Spinner from './components/common/Spinner';

// On cold start, check for a previously stored JWT and restore the session
// by fetching the current user, before rendering the real navigator.
const Bootstrap = ({ children }) => {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    (async () => {
      try {
        const token = await authService.getToken();
        if (token) {
          const { user } = await authService.me();
          dispatch(loginSuccess({ token, user }));
        }
      } catch (error) {
        await authService.logout(); // stored token was invalid/expired
      } finally {
        dispatch(setHydrated());
      }
    })();
  }, [dispatch]);

  // Registers this device for push whenever a session becomes active.
  // This covers both a restored session above and a fresh login/signup elsewhere.
  useEffect(() => {
    if (token) registerForPushNotifications();
  }, [token]);

  // Tap routing doesn't depend on auth state; wired once for the app's lifetime.
  useEffect(() => subscribeToNotificationTaps(), []);

  return children;
};

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return <Spinner />;
  }

  return (
    <Provider store={store}>
      <Bootstrap>
        <StatusBar style="dark" />
        <RootNavigator />
        <AlertHost />
        <CameraCaptureHost />
      </Bootstrap>
    </Provider>
  );
}
