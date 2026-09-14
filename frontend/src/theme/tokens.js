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
  accent: FLITO_COLORS.accent,
  accentMuted: 'rgba(0, 210, 162, 0.14)',
  // FLITO_COLORS.accent (teal) as text/icon on a light surface, or white
  // text on a solid accent surface, both fail AA; this darkened tone passes.
  accentText: '#007E61',
  // Keyboard-focus ring color, used as a border on whatever surface is
  // focused. The raw brand accent teal measures ~2:1 against a white card,
  // under the 3:1 WCAG minimum for a focus indicator; this darkened tone
  // (the same one used for accent text) reaches ~5:1.
  focusRing: '#007E61',

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

// Layout breakpoints, by window width. Phone below `tablet`, tablet up to
// `desktop`, laptop/desktop at `desktop` and wider. Read through
// hooks/useBreakpoint rather than comparing widths ad hoc in a screen.
export const breakpoints = {
  tablet: 600,
  desktop: 1024,
};

export default { colors, spacing, radius, shadow, type, iconSize, motion, breakpoints };
