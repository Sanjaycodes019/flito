import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react-native';
import authReducer from '../src/redux/slices/authSlice';
import userReducer from '../src/redux/slices/userSlice';
import loadsReducer from '../src/redux/slices/loadsSlice';
import bookingReducer from '../src/redux/slices/bookingSlice';

// A fresh store per test (never the app's shared singleton), preloaded with
// whatever auth state the test needs — most screens read the signed-in user
// via `useSelector((state) => state.auth.user)`.
export const makeStore = (preloadedState = {}) => configureStore({
  reducer: { auth: authReducer, user: userReducer, loads: loadsReducer, bookings: bookingReducer },
  preloadedState,
});

const asUser = (user) => ({ auth: { user, token: 'test-token', isLoading: false, error: null, hydrated: true } });

// Renders `ui` inside a real Redux Provider. Pass `user` for the common case
// of "render this screen as if signed in as ...".
export const renderWithProviders = (ui, { user, preloadedState, store = makeStore(preloadedState || asUser(user)) } = {}) => ({
  store,
  ...render(<Provider store={store}>{ui}</Provider>),
});

// A minimal but complete fake user per role, so tests only override what a
// given case actually cares about.
export const fakeUser = (role, overrides = {}) => ({
  _id: `${role}-id`,
  role,
  firstName: role[0].toUpperCase() + role.slice(1),
  lastName: 'Test',
  kycStatus: 'approved',
  ...overrides,
});

// A no-op navigation prop for screens that take one but aren't the subject
// of a given test's navigation assertions.
export const fakeNavigation = (overrides = {}) => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  ...overrides,
});
