import api from './api';
import storage from './storage';
import { unregisterPushNotifications } from './pushNotifications';

const storeToken = async (data) => {
  if (data.token) await storage.setItem('authToken', data.token);
  return data;
};

export const authService = {
  signup: async ({ email, password, role, firstName, lastName, phone }) => {
    const response = await api.post('/auth/signup', { email, password, role, firstName, lastName, phone: phone || undefined });
    return storeToken(response.data);
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return storeToken(response.data);
  },

  adminLogin: async (email, password, accessKey) => {
    const response = await api.post('/auth/admin/login', { email, password, accessKey });
    return storeToken(response.data);
  },

  adminSignup: async ({ email, password, firstName, lastName, accessKey }) => {
    const response = await api.post('/auth/admin/signup', { email, password, firstName, lastName, accessKey });
    return storeToken(response.data);
  },

  // `role` is only used the first time this Google identity is seen; an
  // existing account logs in and ignores it. If the backend reports
  // ROLE_REQUIRED, the caller (the signup screen) already collected a role
  // before starting the Google flow, so that path should not normally occur
  // there, only from the login screen's Google button for a brand-new user.
  googleAuth: async (idToken, role) => {
    const response = await api.post('/auth/google', { idToken, role });
    return storeToken(response.data);
  },

  verifyEmail: async (email, code) => {
    const response = await api.post('/auth/verify-email', { email, code });
    return response.data;
  },

  resendVerification: async () => {
    const response = await api.post('/auth/resend-verification');
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email, code, newPassword) => {
    const response = await api.post('/auth/reset-password', { email, code, newPassword });
    return storeToken(response.data);
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    // Best-effort, and before clearing the token. The request needs it to
    // authenticate. Safe even when the token is already invalid (App.js's
    // cold-start cleanup path): the failure is caught inside and swallowed.
    await unregisterPushNotifications();
    await storage.removeItem('authToken');
  },

  getToken: async () => storage.getItem('authToken'),
};

export default authService;
