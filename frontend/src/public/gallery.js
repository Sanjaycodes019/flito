import { Platform } from 'react-native';
import { SITE_URL } from './seo';

// The screenshots on the gallery page and the landing page: real screens of
// the app, captured from a demo trip and saved in public/gallery/ at these
// sizes. Words (captions) live in site.json under gallery.shots, by key.
//
//   frame   'browser' a laptop screen, 'phone' a phone screen, 'doc' a page
export const SHOTS = {
  liveMap: { file: 'live-map', width: 1600, height: 1000, frame: 'browser' },
  mapFullscreen: { file: 'map-fullscreen-phone', width: 640, height: 1385, frame: 'phone' },
  mapNight: { file: 'map-night', width: 1600, height: 1000, frame: 'browser' },
  driverSharing: { file: 'driver-sharing', width: 640, height: 1385, frame: 'phone' },
  invoice: { file: 'invoice', width: 1100, height: 1556, frame: 'doc' },
  deliveredOwner: { file: 'delivered-owner', width: 1600, height: 1000, frame: 'browser' },
  payOwner: { file: 'pay-owner', width: 640, height: 1385, frame: 'phone' },
  postLoad: { file: 'post-load', width: 640, height: 1385, frame: 'phone' },
  matches: { file: 'matches', width: 1600, height: 1000, frame: 'browser' },
  driverJob: { file: 'driver-job', width: 640, height: 1385, frame: 'phone' },
  fees: { file: 'fees', width: 1600, height: 1000, frame: 'browser' },
  adminBooking: { file: 'admin-booking', width: 1600, height: 1000, frame: 'browser' },
  mapNepali: { file: 'map-phone-ne', width: 640, height: 1385, frame: 'phone' },
  homeNepali: { file: 'home-ne', width: 640, height: 1385, frame: 'phone' },
};

// The landing page shows a few, and links to the rest.
export const LANDING_SHOTS = ['liveMap', 'invoice', 'driverJob'];

// On the web the site serves the files itself; the Android app, which shows
// the same pages from Settings, loads them from the live site rather than
// carrying them in the app.
export const shotUri = (key) => {
  const path = `/gallery/${SHOTS[key].file}.webp`;
  return Platform.OS === 'web' ? path : `${SITE_URL}${path}`;
};

export const aspectOf = (key) => SHOTS[key].width / SHOTS[key].height;

// Splits shots into rows that each fill the width at one shared height, the
// way a photo gallery lines up pictures of different shapes. A row takes
// shots until their combined width-to-height ratios would pass `maxAspect`
// (low on a phone, so a laptop screen gets a row to itself and two phone
// screens share one). Returns [{ keys, height }] for a row `width` wide with
// `gap` between shots, no row taller than `maxHeight`.
export const justifyRows = (keys, { width, gap, maxAspect, maxHeight }) => {
  const rows = [];
  keys.forEach((key) => {
    const row = rows[rows.length - 1];
    const sum = row ? row.reduce((total, k) => total + aspectOf(k), 0) : 0;
    if (row && sum + aspectOf(key) <= maxAspect) row.push(key);
    else rows.push([key]);
  });
  return rows.map((row) => {
    const sum = row.reduce((total, k) => total + aspectOf(k), 0);
    const height = (width - gap * (row.length - 1)) / sum;
    return { keys: row, height: Math.min(height, maxHeight) };
  });
};
