import { useTranslation } from 'react-i18next';

// The public pages keep their copy as structured lists in site.json and
// legal.json (steps, cards, FAQ topics, legal sections), so a page renders
// whatever the language file holds. These read one, never failing the page:
// a missing key gives an empty list or object instead of the key's name.
export const useContent = () => {
  const { t, i18n } = useTranslation();
  const list = (key) => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? value : [];
  };
  const object = (key) => {
    const value = t(key, { returnObjects: true });
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };
  return { t, i18n, list, object };
};

// The day the Terms and Privacy Policy were last changed, as a Nepal day key.
// Shown in the reader's own calendar (BS or AD). Update it with every change.
export const LEGAL_UPDATED = '2026-10-05';
