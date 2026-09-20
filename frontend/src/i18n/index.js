import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { storage } from '../services/storage';

import commonEn from './locales/en/common.json';
import navigationEn from './locales/en/navigation.json';
import authEn from './locales/en/auth.json';
import homeEn from './locales/en/home.json';
import loadsEn from './locales/en/loads.json';
import bookingsEn from './locales/en/bookings.json';
import trucksEn from './locales/en/trucks.json';
import kycEn from './locales/en/kyc.json';
import profileEn from './locales/en/profile.json';
import adminEn from './locales/en/admin.json';
import notificationsEn from './locales/en/notifications.json';

import commonNe from './locales/ne/common.json';
import navigationNe from './locales/ne/navigation.json';
import authNe from './locales/ne/auth.json';
import homeNe from './locales/ne/home.json';
import loadsNe from './locales/ne/loads.json';
import bookingsNe from './locales/ne/bookings.json';
import trucksNe from './locales/ne/trucks.json';
import kycNe from './locales/ne/kyc.json';
import profileNe from './locales/ne/profile.json';
import adminNe from './locales/ne/admin.json';
import notificationsNe from './locales/ne/notifications.json';

export const LANGUAGE_STORAGE_KEY = 'language';
export const SUPPORTED_LANGUAGES = ['en', 'ne'];
export const DEFAULT_LANGUAGE = 'en';

const NAMESPACES = [
  'common', 'navigation', 'auth', 'home', 'loads',
  'bookings', 'trucks', 'kyc', 'profile', 'admin', 'notifications',
];

const resources = {
  en: {
    common: commonEn,
    navigation: navigationEn,
    auth: authEn,
    home: homeEn,
    loads: loadsEn,
    bookings: bookingsEn,
    trucks: trucksEn,
    kyc: kycEn,
    profile: profileEn,
    admin: adminEn,
    notifications: notificationsEn,
  },
  ne: {
    common: commonNe,
    navigation: navigationNe,
    auth: authNe,
    home: homeNe,
    loads: loadsNe,
    bookings: bookingsNe,
    trucks: trucksNe,
    kyc: kycNe,
    profile: profileNe,
    admin: adminNe,
    notifications: notificationsNe,
  },
};

// Nobody has picked a language yet: guess Nepali only if the device itself
// is set to it, otherwise default to English.
const detectDeviceLanguage = () => {
  try {
    const locales = Localization.getLocales();
    return locales?.[0]?.languageCode === 'ne' ? 'ne' : DEFAULT_LANGUAGE;
  } catch (error) {
    return DEFAULT_LANGUAGE;
  }
};

const resolveInitialLanguage = async () => {
  const stored = await storage.getItem(LANGUAGE_STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(stored)) return stored;
  return detectDeviceLanguage();
};

let readyPromise = null;

// Resolves once i18next has a language and its resources loaded. App.js
// gates rendering the navigator on this the same way it gates on auth
// hydration, so nothing renders in the wrong language and then flashes.
export const initI18n = () => {
  if (!readyPromise) {
    readyPromise = resolveInitialLanguage().then((lng) =>
      i18n.use(initReactI18next).init({
        resources,
        lng,
        fallbackLng: DEFAULT_LANGUAGE,
        ns: NAMESPACES,
        defaultNS: 'common',
        interpolation: { escapeValue: false },
        returnEmptyString: false,
      })
    );
  }
  return readyPromise;
};

export const changeLanguage = async (lng) => {
  if (!SUPPORTED_LANGUAGES.includes(lng)) return;
  await i18n.changeLanguage(lng);
  await storage.setItem(LANGUAGE_STORAGE_KEY, lng);
};

export default i18n;
