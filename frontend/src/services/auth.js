import api from './api';
import storage from './storage';

export const authService = {
  sendOtp: async (phone) => {
    const response = await api.post('/auth/send-otp', { phone });
    return response.data;
  },

  signup: async ({ phone, otp, role, firstName, lastName }) => {
    const response = await api.post('/auth/signup', { phone, otp, role, firstName, lastName });
    if (response.data.token) {
      await storage.setItem('authToken', response.data.token);
    }
    return response.data;
  },

  login: async (phone, otp) => {
    const response = await api.post('/auth/login', { phone, otp });
    if (response.data.token) {
      await storage.setItem('authToken', response.data.token);
    }
    return response.data;
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    await storage.removeItem('authToken');
  },

  getToken: async () => storage.getItem('authToken'),
};

export default authService;
