// Dates as Nepal sees them. Nepal is UTC+5:45 all year (no daylight saving),
// so each calendar day there is a fixed UTC window. A pickup date is kept as
// that day's key, like "2026-09-16".
const OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const keyOf = (utcMidnightMs) => new Date(utcMidnightMs).toISOString().slice(0, 10);

// Today's key in Nepal (or the key for any moment).
const nepalDay = (at = new Date()) => keyOf(new Date(at).getTime() + OFFSET_MS);

const startOfNepalDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - OFFSET_MS);
const endOfNepalDay = (day) => new Date(startOfNepalDay(day).getTime() + DAY_MS - 1);

const addDays = (day, days) => keyOf(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS);

// A real calendar day written as YYYY-MM-DD.
const isDayKey = (value) => {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && keyOf(ms) === value;
};

module.exports = { nepalDay, startOfNepalDay, endOfNepalDay, addDays, isDayKey };
