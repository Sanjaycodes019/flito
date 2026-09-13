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

import { FLITO_COLORS } from '../utils/colors';

export const colors = {
  // Surfaces
  background: FLITO_COLORS.background,
  surface: FLITO_COLORS.bgLight,
  surfaceMuted: FLITO_COLORS.bgGray,
  surfaceDark: FLITO_COLORS.bgDark,
  overlay: 'rgba(18, 22, 26, 0.6)', // tint of FLITO_COLORS.dark

  // Text
  textPrimary: FLITO_COLORS.textDark,
  textSecondary: 'rgba(30, 36, 43, 0.68)', // tint of FLITO_COLORS.secondary
  textMuted: FLITO_COLORS.textMuted,
  textOnPrimary: '#FFFFFF',
  textInverse: FLITO_COLORS.textLight,
  textLink: FLITO_COLORS.info,

  // Structure
  border: 'rgba(30, 36, 43, 0.14)', // tint of FLITO_COLORS.secondary
  borderStrong: 'rgba(30, 36, 43, 0.28)',
  divider: 'rgba(30, 36, 43, 0.08)',

  // Brand
  primary: FLITO_COLORS.primary,
  primaryPressed: '#E08F00', // darkened primary for pressed state
  primaryMuted: 'rgba(255, 159, 0, 0.14)',
  secondary: FLITO_COLORS.secondary,
  accent: FLITO_COLORS.accent,
  accentMuted: 'rgba(0, 210, 162, 0.14)',

  // Semantic state (kept as-is; already harmonize with the brand palette)
  success: FLITO_COLORS.success,
  successMuted: 'rgba(39, 174, 96, 0.12)',
  warning: FLITO_COLORS.warning,
  warningMuted: 'rgba(243, 156, 18, 0.12)',
  error: FLITO_COLORS.error,
  errorMuted: 'rgba(231, 76, 60, 0.12)',
  info: FLITO_COLORS.info,
  infoMuted: 'rgba(52, 152, 219, 0.12)',

  // Fixed
  white: '#FFFFFF',
  disabledBg: '#E1E4E8',
  disabledText: '#A6ACB2',
};

// 4px base spacing scale. Every padding/margin/gap in the app should be one
// of these values, never an arbitrary one-off number.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

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
export const type = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  h1: { fontSize: 24, lineHeight: 31, fontWeight: '700' },
  h2: { fontSize: 20, lineHeight: 27, fontWeight: '700' },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  bodyLarge: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyMedium: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  smallMedium: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
};

// Icon sizes, tied to the text size they typically sit next to.
export const iconSize = {
  xs: 14, // inline with caption/small text
  sm: 16, // inline with body text
  md: 20, // default UI icon: buttons, inputs, list rows
  lg: 24, // section headers, nav bars, tab bar
  xl: 32, // empty states, feature callouts
  xxl: 48, // large empty-state illustrations
};

// Motion durations. Every hover/focus/state transition should use one of
// these, not a one-off number. Motion communicates a state change, it is
// never decorative.
export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
};

export default { colors, spacing, radius, shadow, type, iconSize, motion };
