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

// { name: 'Today' | 'Tomorrow' | 'Thu', date: '17 Sep' }
export const describeDay = (day, today = nepalDay()) => {
  const date = new Date(`${day}T00:00:00Z`);
  const name = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : WEEKDAYS[date.getUTCDay()];
  return { name, date: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}` };
};

// "Today, 15 Sep", "Tomorrow, 16 Sep" or "Thu, 17 Sep".
export const dayLabel = (day, today) => {
  if (!day) return null;
  const { name, date } = describeDay(day, today);
  return `${name}, ${date}`;
};
