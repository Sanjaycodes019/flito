import i18n from '../i18n';
import { getCalendar } from '../services/calendarPreference';
import { adToBs, BS_MONTHS, localizeDigits } from './bsCalendar';

// Calendar days as Nepal sees them, matching the server. Nepal is UTC+5:45 all
// year, so "today" there can differ from the device's own date. A day is kept
// as its key, like "2026-09-16".
const OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);

export const nepalDay = (at = Date.now()) => keyOf(new Date(at).getTime() + OFFSET_MS);

export const addDays = (day, days) => keyOf(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS);

export const upcomingDays = (count, today = nepalDay()) => Array.from({ length: count }, (_, i) => addDays(today, i));

const monthNamesFor = () => (i18n.language === 'ne' ? BS_MONTHS.ne : BS_MONTHS.en);

// A day in the chosen calendar: "17 Sep 2026" in AD, "1 Ashwin 2083" in BS
// (Devanagari in Nepali). `withYear` is off for the short chip and list forms.
export const formatDayKey = (day, { calendar = getCalendar(), withYear = true } = {}) => {
  if (calendar === 'bs') {
    const bs = adToBs(day);
    if (bs) {
      const language = i18n.language;
      const parts = [localizeDigits(bs.day, language), monthNamesFor()[bs.month - 1]];
      if (withYear) parts.push(localizeDigits(bs.year, language));
      return parts.join(' ');
    }
    // Outside the BS table's range: show the AD date rather than nothing.
  }
  const date = new Date(`${day}T00:00:00Z`);
  const parts = [date.getUTCDate(), MONTHS[date.getUTCMonth()]];
  if (withYear) parts.push(date.getUTCFullYear());
  return parts.join(' ');
};

// { name: 'Today' | 'Tomorrow' | 'Thu', date: '17 Sep' or '1 Ashwin' }
export const describeDay = (day, today = nepalDay()) => {
  const date = new Date(`${day}T00:00:00Z`);
  const name = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : WEEKDAYS[date.getUTCDay()];
  return { name, date: formatDayKey(day, { withYear: false }) };
};

// "Today, 15 Sep", "Tomorrow, 16 Sep" or "Thu, 17 Sep".
export const dayLabel = (day, today) => {
  if (!day) return null;
  const { name, date } = describeDay(day, today);
  return `${name}, ${date}`;
};

// "Sep 2026" or "Ashwin 2083": a month and year, for "member since".
export const formatMonthYear = (date) => {
  if (!date) return null;
  const day = nepalDay(new Date(date));
  return formatDayKey(day).split(' ').filter((_, i) => i !== 0).join(' ');
};
