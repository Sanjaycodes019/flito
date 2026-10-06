// FLITO design tokens. This is the single shared design system: every
// screen and component should read spacing, color, type, radius, shadow
// and icon sizes from here instead of hardcoding numbers or hex values.
//
// The brand palette itself still lives in utils/colors.js (FLITO_COLORS) and
// is not duplicated here. This file maps that palette onto semantic roles
// (background, surface, text, border, states) and adds the scales the
// palette does not define on its own (spacing, type, radius, shadow, icon
// sizes, motion durations).
//
// Judgment call: border, divider, overlay and the secondary text tone are
// not defined in FLITO_COLORS, but every design system needs them. Rather
// than invent new hues, each is an alpha-tinted variant of an existing
// brand color (secondary "Deep Asphalt" or dark "Midnight Cabin"), so nothing
// outside the palette is introduced.

import { StyleSheet } from 'react-native';
import { FLITO_COLORS } from '../utils/colors';

const lightColors = {
  // Surfaces. A step dimmer than the brand's white and Industrial Chalk
  // (FLITO_COLORS.bgLight / .background), which glared on a full page: cards
  // and bars sit on near-white, the page on a light grey of the same hue.
  background: '#EBEEF1',
  surface: '#F5F6F8',
  surfaceMuted: '#EBEEF1',
  surfaceDark: FLITO_COLORS.bgDark,
  overlay: 'rgba(18, 22, 26, 0.6)', // tint of FLITO_COLORS.dark

  // Text
  textPrimary: FLITO_COLORS.textDark,
  textSecondary: 'rgba(30, 36, 43, 0.68)', // tint of FLITO_COLORS.secondary
  // A darkened shade of FLITO_COLORS.textMuted (#95A5A6). The brand shade
  // measures ~2.4:1 on both white and the app background, well under the
  // 4.5:1 WCAG AA minimum for the small metadata/caption text it is used
  // for everywhere. This keeps the same hue, just dark enough to read.
  textMuted: '#5D6E6F',
  // Text/icon color for on top of a solid FLITO_COLORS.primary (amber)
  // surface: a Button's primary variant, the role badge pill. White on
  // that amber measures ~2:1 (fails AA); this near-black brand tone
  // (FLITO_COLORS.secondary) measures ~7.6:1.
  textOnPrimary: FLITO_COLORS.secondary,
  // Text/icon color for a solid dark surface (FLITO_COLORS.secondary or
  // .dark): a Button's secondary variant, an avatar circle's icon.
  textOnDark: '#FFFFFF',
  textInverse: FLITO_COLORS.textLight,
  // Secondary text on a dark surface (e.g. the auth brand panel), a tint of
  // FLITO_COLORS.textLight that stays well above 4.5:1 on secondary.
  textInverseMuted: 'rgba(244, 246, 248, 0.72)',
  // FLITO_COLORS.info itself measures ~3.15:1 as link text on white, under
  // the 4.5:1 AA minimum; infoText (below) is the same hue, dark enough.
  textLink: '#1D6CA1',

  // Structure
  border: 'rgba(30, 36, 43, 0.14)', // tint of FLITO_COLORS.secondary
  borderStrong: 'rgba(30, 36, 43, 0.28)',
  divider: 'rgba(30, 36, 43, 0.08)',

  // Brand
  primary: FLITO_COLORS.primary,
  primaryPressed: '#E08F00', // darkened primary for pressed state
  primaryMuted: 'rgba(255, 159, 0, 0.14)',
  // FLITO_COLORS.primary itself measures ~2:1 as text on a light surface
  // (fails AA), so anywhere the brand amber is the TEXT color (prices,
  // section labels, the role chip, a tertiary button's label) uses this
  // darkened tone of the same hue instead, at ~5:1. The wordmark is exempt
  // (WCAG does not apply contrast minimums to logotype text) and keeps the
  // true brand amber.
  primaryText: '#995F00',
  secondary: FLITO_COLORS.secondary,
  secondaryPressed: '#141922',
  accent: FLITO_COLORS.accent,
  accentMuted: 'rgba(0, 210, 162, 0.14)',
  // FLITO_COLORS.accent (teal) as text/icon on a light surface, or white
  // text on a solid accent surface, both fail AA; this darkened tone passes
  // (~4.8:1 on the page background, ~5.1:1 on a card).
  accentText: '#00775B',
  // Keyboard-focus ring color, used as a border on whatever surface is
  // focused. The raw brand accent teal measures ~2:1 against a card, under
  // the 3:1 WCAG minimum for a focus indicator; this darkened tone (the same
  // one used for accent text) reaches ~5:1.
  focusRing: '#00775B',

  // Semantic state. The saturated brand hues below stay exactly as chosen
  // (large surfaces: solid map markers, focus rings) but none of them are
  // safe as small text or an icon on their own light "Muted" tint, or as
  // white text on their own solid fill: several measure under 3:1. Each has
  // a paired darkened "Strong"/"Text" tone, same hue, that actually passes.
  success: FLITO_COLORS.success,
  successMuted: 'rgba(39, 174, 96, 0.12)',
  successText: '#1B7A43',
  warning: FLITO_COLORS.warning,
  warningMuted: 'rgba(243, 156, 18, 0.12)',
  warningText: '#955E08',
  error: FLITO_COLORS.error,
  errorMuted: 'rgba(231, 76, 60, 0.12)',
  errorText: '#C22818',
  // A destructive Button's solid fill: FLITO_COLORS.error itself only
  // reaches ~3.8:1 with white text (fails AA at normal text sizes).
  errorStrong: '#C22818',
  errorStrongPressed: '#9B2013',
  info: FLITO_COLORS.info,
  infoMuted: 'rgba(52, 152, 219, 0.12)',
  infoText: '#1D6CA1',

  // Fixed
  white: '#FFFFFF',
  disabledBg: '#E1E4E8',
  disabledText: '#A6ACB2',
};

// Dark palette: the same roles on Midnight Cabin surfaces. Text tones that
// are darkened for contrast on light surfaces are lightened here, and every
// "Text" tone keeps at least 4.5:1 on the dark surface. `secondary` is only a
// fill in dark mode (buttons, avatars); text that used it reads textPrimary.
const darkColors = {
  background: '#12161A',
  surface: '#1E242B',
  surfaceMuted: '#2A323B',
  surfaceDark: '#0B0E11',
  overlay: 'rgba(0, 0, 0, 0.65)',

  textPrimary: '#F4F6F8',
  textSecondary: 'rgba(244, 246, 248, 0.72)',
  textMuted: '#9AA8AA',
  textOnPrimary: '#1E242B',
  textOnDark: '#FFFFFF',
  textInverse: '#F4F6F8',
  textInverseMuted: 'rgba(244, 246, 248, 0.72)',
  textLink: '#5DB6F0',

  border: 'rgba(244, 246, 248, 0.16)',
  borderStrong: 'rgba(244, 246, 248, 0.32)',
  divider: 'rgba(244, 246, 248, 0.09)',

  primary: FLITO_COLORS.primary,
  primaryPressed: '#E08F00',
  primaryMuted: 'rgba(255, 159, 0, 0.18)',
  primaryText: '#FFB733',
  secondary: '#3A4552',
  secondaryPressed: '#4A5666',
  accent: FLITO_COLORS.accent,
  accentMuted: 'rgba(0, 210, 162, 0.18)',
  accentText: '#2FE0B5',
  focusRing: '#2FE0B5',

  success: FLITO_COLORS.success,
  successMuted: 'rgba(39, 174, 96, 0.2)',
  successText: '#5AD98C',
  warning: FLITO_COLORS.warning,
  warningMuted: 'rgba(243, 156, 18, 0.2)',
  warningText: '#F5B83D',
  error: FLITO_COLORS.error,
  errorMuted: 'rgba(231, 76, 60, 0.2)',
  errorText: '#FF8A7D',
  errorStrong: '#C22818',
  errorStrongPressed: '#9B2013',
  info: FLITO_COLORS.info,
  infoMuted: 'rgba(52, 152, 219, 0.2)',
  infoText: '#5DB6F0',

  white: '#FFFFFF',
  disabledBg: '#2A323B',
  disabledText: '#6B767F',
};

export const palettes = { light: lightColors, dark: darkColors };

// `colors` is one shared object whose values are swapped in place when the
// scheme changes (see applyScheme), so every `import { colors }` keeps working.
// Screens re-read it on render; the app remounts on a scheme change (see
// theme/ThemeProvider) so nothing keeps a stale value.
export const colors = { ...lightColors };

let scheme = 'light';
let version = 0;

export const getScheme = () => scheme;

let density = 'regular';

export const getDensity = () => density;

// Swaps the shared spacing, type and icon scales to `regular` or `compact` in
// place and invalidates every themed style. Returns true when it changed.
export const applyDensity = (next) => {
  if (next === density || !SPACING[next]) return false;
  density = next;
  version += 1;
  Object.assign(spacing, SPACING[next]);
  Object.assign(iconSize, ICON_SIZE[next]);
  Object.keys(TYPE[next]).forEach((key) => Object.assign(type[key], TYPE[next][key]));
  return true;
};

// Returns true when the scheme actually changed.
export const applyScheme = (next) => {
  if (!palettes[next] || next === scheme) return false;
  scheme = next;
  version += 1;
  Object.assign(colors, palettes[next]);
  return true;
};

// Drop-in for StyleSheet.create for styles that use `colors`. The factory
// runs on first use after each scheme change, so the styles always match the
// active palette. Read styles at render time (styles.card), never cache them.
const lazyByScheme = (build) => (factory) => {
  let cached = null;
  let cachedVersion = -1;
  const current = () => {
    if (cachedVersion !== version || !cached) {
      cached = build(factory());
      cachedVersion = version;
    }
    return cached;
  };
  return new Proxy({}, {
    get: (_, key) => current()[key],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => (key in current()
      ? { enumerable: true, configurable: true, value: current()[key] }
      : undefined),
  });
};

// Density: how much room things take. `regular` is tablets and laptops;
// `compact` is phones, where the same screens sit a little tighter so more fits
// without scrolling. The scales below are shared objects whose values are swapped
// in place when the density changes (see applyDensity), exactly like `colors`
// for light/dark, so every `import { spacing, type, iconSize }` keeps working and
// every style built with `themedStyles` is rebuilt.
const SPACING = {
  regular: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 },
  compact: { xxs: 2, xs: 3, sm: 6, md: 10, lg: 12, xl: 16, xxl: 20, xxxl: 24, huge: 32 },
};

// 4px base spacing scale (3px steps when compact). Every padding/margin/gap in
// the app should be one of these values, never an arbitrary one-off number.
export const spacing = { ...SPACING.regular };

// Border radius scale, shared by buttons, cards, inputs, modals, badges.
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

// Elevation scale. `shadow` values apply on iOS/web, `elevation` on Android.
export const shadow = {
  none: {},
  level1: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  level3: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
};

// Typography scale. Every screen heading/body/label should map to one of
// these instead of a one-off fontSize.
//
// Sized for people who may not read easily, often on a small phone in
// sunlight: body text is 17px, nothing a user must read is under 13px, and
// line heights leave room for Devanagari's vowel marks above and below. The
// compact (phone) set trims about 2px off each step but keeps body text at 15px
// and everything a user must read at 13px or more.
const TYPE = {
  regular: {
    display: { fontSize: 30, lineHeight: 39, fontWeight: '700' },
    h1: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
    h2: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
    h3: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
    bodyLarge: { fontSize: 18, lineHeight: 26, fontWeight: '400' },
    body: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
    bodyMedium: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
    small: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
    smallMedium: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
    caption: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  },
  compact: {
    display: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
    h1: { fontSize: 23, lineHeight: 30, fontWeight: '700' },
    h2: { fontSize: 20, lineHeight: 27, fontWeight: '700' },
    h3: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
    bodyLarge: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
    bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
    small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
    smallMedium: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  },
};

export const type = Object.fromEntries(Object.entries(TYPE.regular).map(([key, value]) => [key, { ...value }]));

// Icon sizes, tied to the text size they typically sit next to.
const ICON_SIZE = {
  regular: { xs: 14, sm: 16, md: 20, lg: 24, xl: 32, xxl: 48 },
  compact: { xs: 13, sm: 15, md: 18, lg: 22, xl: 28, xxl: 40 },
};
// xs inline with caption/small text, sm inline with body text, md the default UI
// icon (buttons, inputs, list rows), lg section headers and nav bars, xl empty
// states and feature callouts, xxl large empty-state illustrations.
export const iconSize = { ...ICON_SIZE.regular };

// What each density changes, for the components whose sizes are not spacing:
// a button's height, an input's, a list row's. Read it at render time through
// `getDensity()` or use `themed`.
export const sizes = {
  regular: { buttonLg: 56, buttonMd: 48, buttonSm: 40, input: 48, row: 64, tabBar: 62, heroAvatar: 112, heroCover: 132 },
  compact: { buttonLg: 50, buttonMd: 44, buttonSm: 36, input: 44, row: 56, tabBar: 58, heroAvatar: 88, heroCover: 84 },
};

// Motion durations. Every hover/focus/state transition should use one of
// these, not a one-off number. Motion communicates a state change, it is
// never decorative.
export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
};

// Layout breakpoints, by window width. Phone below `tablet`, tablet up to
// `desktop`, laptop/desktop at `desktop` and wider. Read through
// hooks/useBreakpoint rather than comparing widths ad hoc in a screen.
export const breakpoints = {
  tablet: 600,
  desktop: 1024,
};

// The size table for the active density: `sizeOf().buttonMd`.
export const sizeOf = () => sizes[density];

export const themedStyles = lazyByScheme((styles) => StyleSheet.create(styles));

// Same laziness for plain lookup tables built from `colors` (status tones,
// button variants). Index it at render time, like `themedStyles`.
export const themed = lazyByScheme((table) => table);

export default { colors, palettes, spacing, radius, shadow, type, iconSize, sizes, motion, breakpoints };
