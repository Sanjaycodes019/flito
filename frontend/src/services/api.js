import axios from 'axios';
import storage from './storage';
import i18n from '../i18n';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Attach the stored JWT to every request, and the app's current language so
// anything the server sends on the user's behalf (the emailed verification
// and reset codes) is in the language they are using.
api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = i18n.language === 'ne' ? 'ne' : 'en';
  return config;
});

// Clear the token on 401 so the app falls back to the login screen. So is a
// token whose account an admin has suspended or banned: it can never work
// again, and the login screen explains why.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { status, data } = error.response || {};
    if (status === 401 || (status === 403 && data?.code === 'AUTH_ACCOUNT_STATUS')) {
      await storage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

export default api;
