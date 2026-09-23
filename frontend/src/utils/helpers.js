import i18n from '../i18n';
import { translateServerMessage } from '../i18n/serverMessages';
import { formatDayKey, nepalDay } from './nepalDate';
import {
  PHONE_REGEX, EMAIL_REGEX, TRUCK_TYPE_LABELS, BODY_TYPE_LABELS,
  TRUCK_FEATURES, SERVICE_AREAS, INSURANCE_TYPES, KYC_DOCUMENT_LABELS, KYC_ID_TYPE_LABELS,
} from './constants';

export const isValidPhone = (phone) => PHONE_REGEX.test(phone);

// Why a PIN someone picked can't be used, as a key under auth:pinRules, or
// null when it is fine. Mirrors the server: 4 digits, not all one digit and
// not a run like 1234 or 9876.
export const pinProblemKey = (pin) => {
  if (!/^\d{4}$/.test(pin || '')) return 'fourDigits';
  if (/^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'tooEasy';
  return null;
};

// What people actually type for a Nepal mobile number (98XXXXXXXX, with or
// without spaces, dashes or the 977 country code) as the +977 form the
// server stores. Anything else comes back as typed, to fail isValidPhone.
export const toNepalPhone = (text) => {
  const digits = String(text || '').replace(/\D/g, '');
  if (digits.length === 10) return `+977${digits}`;
  if (digits.length === 13 && digits.startsWith('977')) return `+${digits}`;
  return String(text || '').trim();
};
export const isValidEmail = (email) => typeof email === 'string' && EMAIL_REGEX.test(email);

export const formatCurrency = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString('en-NP')}`;

// A moment as a date in the calendar the user chose (AD or BS), read as the
// day it is in Nepal.
export const formatDate = (date) => {
  if (!date) return '';
  return formatDayKey(nepalDay(new Date(date)));
};

export const getErrorMessage = (error) => {
  const data = error?.response?.data;
  if (data?.code && i18n.language === 'ne') {
    const translated = translateServerMessage(data.code, data.extra);
    if (translated) return translated;
  }
  return data?.message || error?.message || 'Something went wrong';
};

// Enum values are snake_case on the wire ('picked_up', 'in_transit');
// render them as readable words. `t` is optional, same graceful-fallback
// pattern as truckTypeLabel/bodyTypeLabel above.
export const formatStatus = (status, t) => {
  const fallback = (status || '').replace(/_/g, ' ');
  return t ? t(`common:status.${status}`, fallback) : fallback;
};

// Nepal address data (provinces, districts, local levels) carries an English
// `name` always and a Devanagari `nameNe`/`categoryNe` where a match was
// found. Falls back to English so an unmatched place never renders blank.
export const localizedName = (entry) =>
  (i18n.language === 'ne' && entry?.nameNe) ? entry.nameNe : entry?.name;

export const localizedCategory = (entry) =>
  (i18n.language === 'ne' && entry?.categoryNe) ? entry.categoryNe : entry?.category;

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export const formatKg = (kg) => `${Number(kg || 0).toLocaleString('en-NP')} kg`;

// "10-Ton Truck" for '10-ton'; an unknown type still reads sensibly. `t` is
// optional (screens migrated later pass their `useTranslation()` result);
// without one these fall back to the plain English dictionaries below, so
// nothing breaks while a screen is mid-migration.
export const truckTypeLabel = (truckType, t) => {
  const fallback = TRUCK_TYPE_LABELS[truckType] || (truckType ? `${truckType} truck` : 'Truck');
  return t ? t(`trucks:types.${truckType}.label`, fallback) : fallback;
};

export const bodyTypeLabel = (bodyType, t) => {
  const fallback = BODY_TYPE_LABELS[bodyType] || null;
  return t ? t(`trucks:bodyTypes.${bodyType}.label`, fallback ?? '') || null : fallback;
};

export const truckFeatureLabel = (key, t, field = 'label') => {
  const fallback = TRUCK_FEATURES.find((f) => f.key === key)?.[field] || key;
  return t ? t(`trucks:features.${key}.${field}`, fallback) : fallback;
};

export const serviceAreaLabel = (value, t, field = 'label') => {
  const fallback = SERVICE_AREAS.find((s) => s.value === value)?.[field] || value;
  return t ? t(`trucks:serviceAreas.${value}.${field}`, fallback) : fallback;
};

export const insuranceTypeLabel = (value, t, field = 'label') => {
  const fallback = INSURANCE_TYPES.find((s) => s.value === value)?.[field] || value;
  return t ? t(`trucks:insuranceTypes.${value}.${field}`, fallback) : fallback;
};

export const kycDocumentLabel = (docType, t) => {
  const fallback = KYC_DOCUMENT_LABELS[docType] || docType;
  return t ? t(`kyc:documents.${docType}`, fallback) : fallback;
};

export const kycIdTypeLabel = (idType, t) => {
  const fallback = KYC_ID_TYPE_LABELS[idType] || idType;
  return t ? t(`kyc:idTypes.${idType}`, fallback) : fallback;
};

// "200 km by road · about 2 days": the trip a load makes. "About" marks a
// straight-line estimate, used when real route distances weren't available.
export const formatTrip = (t, load) => {
  if (!load?.distanceKm) return null;
  const key = load.distanceSource === 'route' ? 'loads:truckMatches.kmByRoad' : 'loads:truckMatches.aboutKmByRoad';
  const parts = [t(key, { km: load.distanceKm })];
  if (load.tripDays > 1) parts.push(t('loads:truckMatches.tripDays', { count: load.tripDays }));
  return parts.join(' · ');
};
