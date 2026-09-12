import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store isn't available on web; fall back to localStorage there
// so the same service works across Expo Web + Android with one API.
const isWeb = Platform.OS === 'web';

export const storage = {
  getItem: async (key) => {
    if (isWeb) return window.localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (isWeb) return window.localStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (isWeb) return window.localStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

export default storage;
