import { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { breakpoints, spacing } from '../theme/tokens';

// Page landmarks (main, banner, navigation, contentinfo) for browsers' screen
// readers. Native accessibility has no such roles, so they are web only.
export const landmark = (role) => (Platform.OS === 'web' ? { role } : {});

// The widest a public page's content runs, however wide the window.
export const SITE_WIDTH = 1200;
// Long reading (legal text, an article) is capped narrower for comfortable lines.
export const READING_WIDTH = 760;
// The narrowest window whose navbar fits every page link beside the logo and
// both ways in, in Nepali too (its labels and buttons run longest). Narrower,
// the links move into the menu.
export const NAV_LINKS_WIDTH = 1180;

// The width the page itself has, measured by PublicLayout. Inside the signed-in
// app a laptop's sidebar takes part of the window, so sizing from the window
// alone would lay a page out for room it doesn't have.
export const SiteWidthContext = createContext(null);

// Marketing headlines run bigger than anything inside the app, so they get
// their own small scale here instead of stretching theme/tokens' type scale,
// which stays the in-app standard. Line heights leave room for Devanagari's
// vowel marks, as the app's own scale does.
const HEADLINES = {
  hero: { phone: [34, 46], tablet: [44, 58], desktop: [56, 70] },
  title: { phone: [27, 38], tablet: [32, 44], desktop: [38, 50] },
  subtitle: { phone: [21, 30], tablet: [23, 32], desktop: [24, 34] },
  lead: { phone: [18, 28], tablet: [19, 30], desktop: [20, 32] },
};

const pick = (sizes, size) => {
  const [fontSize, lineHeight] = sizes[size];
  return { fontSize, lineHeight };
};

// Sizes, gutters and section spacing for the room the page has, in one hook so
// every public page steps up and down at the same breakpoints.
const useSiteStyle = () => {
  const { width: windowWidth } = useWindowDimensions();
  const width = useContext(SiteWidthContext) || windowWidth;
  const isPhone = width < breakpoints.tablet;
  const isDesktop = width >= breakpoints.desktop;
  const isTablet = !isPhone && !isDesktop;
  const size = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'phone';

  return {
    width,
    windowWidth,
    isPhone,
    isTablet,
    isDesktop,
    // The window, not the page: the navbar spans the whole window.
    isWideWindow: windowWidth >= NAV_LINKS_WIDTH,
    size,
    gutter: isDesktop ? spacing.huge : isTablet ? spacing.xxxl : spacing.lg,
    sectionSpace: isDesktop ? 96 : isTablet ? 72 : 44,
    hero: { ...pick(HEADLINES.hero, size), fontWeight: '800', letterSpacing: isPhone ? -0.3 : -0.8 },
    title: { ...pick(HEADLINES.title, size), fontWeight: '800', letterSpacing: isPhone ? -0.2 : -0.4 },
    subtitle: { ...pick(HEADLINES.subtitle, size), fontWeight: '700' },
    lead: { ...pick(HEADLINES.lead, size), fontWeight: '400' },
  };
};

export default useSiteStyle;
