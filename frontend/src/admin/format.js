import { formatDate } from '../utils/helpers';

// Small display helpers shared by the admin cards and record pages.
export const displayName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ');

// A company name when there is one, otherwise the person's own name.
export const partyName = (person) => person?.companyName || displayName(person) || person?.name || '';

// A moment with its time: "2026-10-04 · 14:05", for the history of a record.
export const formatWhen = (date) => {
  if (!date) return '';
  const time = new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(date)} · ${time}`;
};

// A Nepal phone number as people read it: +977 98XXXXXXXX.
export const formatPhone = (phone) => (phone && phone.startsWith('+977') ? `+977 ${phone.slice(4)}` : phone || '');
