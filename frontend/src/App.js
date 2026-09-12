import React, { useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { store } from './redux/store';
import { loginSuccess, setHydrated } from './redux/slices/authSlice';
import { authService } from './services/auth';
import RootNavigator from './navigation/RootNavigator';

// On cold start, check for a previously stored JWT and restore the session
// by fetching the current user, before rendering the real navigator.
const Bootstrap = ({ children }) => {
  const dispatch = useDispatch();

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

  return children;
};

export default function App() {
  return (
    <Provider store={store}>
      <Bootstrap>
        <StatusBar style="dark" />
        <RootNavigator />
      </Bootstrap>
    </Provider>
  );
}
