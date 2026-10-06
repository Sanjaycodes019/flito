import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../services/storage';
import { LANG_PARAM } from '../public/seo';

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
import siteEn from './locales/en/site.json';
import legalEn from './locales/en/legal.json';
import paymentsEn from './locales/en/payments.json';

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
import siteNe from './locales/ne/site.json';
import legalNe from './locales/ne/legal.json';
import paymentsNe from './locales/ne/payments.json';

export const LANGUAGE_STORAGE_KEY = 'language';
export const SUPPORTED_LANGUAGES = ['en', 'ne'];
// Fills in any string missing from the chosen language.
export const DEFAULT_LANGUAGE = 'en';
// What the app shows before anyone has picked a language. Most FLITO users
// read Nepali more easily, and most phones in Nepal are set to English, so
// the device setting is no guide.
export const FIRST_RUN_LANGUAGE = 'ne';

const NAMESPACES = [
  'common', 'navigation', 'auth', 'home', 'loads',
  'bookings', 'trucks', 'kyc', 'profile', 'admin', 'notifications',
  'site', 'legal', 'payments',
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
    site: siteEn,
    legal: legalEn,
    payments: paymentsEn,
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
    site: siteNe,
    legal: legalNe,
    payments: paymentsNe,
  },
};

// False until someone picks a language on this device. The auth screens
// open on the language choice while it is false.
let languageChosen = false;
export const isLanguageChosen = () => languageChosen;

// On the web an address can ask for a language (/about?lang=en), so each
// language has its own address for search engines and shared links. It holds
// for this visit; it isn't saved as the person's choice.
const languageFromAddress = () => {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const lng = new URLSearchParams(window.location.search).get(LANG_PARAM);
  return SUPPORTED_LANGUAGES.includes(lng) ? lng : null;
};

// The web page's language follows the app's, so browsers, screen readers and
// search engines read it as Nepali or English.
const syncDocumentLanguage = (lng) => {
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lng;
};
i18n.on('languageChanged', syncDocumentLanguage);

const resolveInitialLanguage = async () => {
  const fromAddress = languageFromAddress();
  if (fromAddress) {
    languageChosen = true;
    return fromAddress;
  }
  const stored = await storage.getItem(LANGUAGE_STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(stored)) {
    languageChosen = true;
    return stored;
  }
  return FIRST_RUN_LANGUAGE;
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
        // An empty string is a real translation, not a missing one: sentences
        // built from a prefix and a suffix leave one side empty where English
        // and Nepali word order differ (Nepali puts the verb last). Treating ""
        // as missing showed the raw key, or the English text, in its place.
        returnEmptyString: true,
      })
    );
  }
  return readyPromise;
};

export const changeLanguage = async (lng) => {
  if (!SUPPORTED_LANGUAGES.includes(lng)) return;
  await i18n.changeLanguage(lng);
  await storage.setItem(LANGUAGE_STORAGE_KEY, lng);
  languageChosen = true;
  // A language picked here outranks one asked for by the address, so drop
  // ?lang= or a reload would switch back.
  if (languageFromAddress() && typeof window !== 'undefined' && window.history?.replaceState) {
    const url = new URL(window.location.href);
    url.searchParams.delete(LANG_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());
  }
};

export default i18n;
