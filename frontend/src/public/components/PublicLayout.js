import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';
import { changeLanguage, isLanguageChosen } from '../../i18n';
import { PUBLIC_PAGES } from '../pages';
import useOpenPage from '../useOpenPage';
import useSiteStyle, { SiteWidthContext, SITE_WIDTH, landmark } from '../siteStyle';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

export const NAVBAR_CLEARANCE = 92;
const SHOW_TOP_AFTER = 800;
const FOOTER_ROOM = 120;

// Lets a page jump to one of its own parts (a table of contents, a FAQ topic),
// find where a part sits, and follow the scroll position.
const PageScrollContext = createContext({
  scrollToNode: () => {},
  scrollToTop: () => {},
  measure: () => {},
  subscribe: () => () => {},
  clearance: 0,
});
export const usePageScroll = () => useContext(PageScrollContext);

// Desktop browsers draw a heavy gray scrollbar down a long page; this keeps it
// thin and in the app's own border tone, as the auth pages do.
const webScrollbar = () => (Platform.OS === 'web'
  ? { scrollbarWidth: 'thin', scrollbarColor: `${colors.borderStrong} transparent` }
  : null);

// Shown above the navbar on a visitor's first look at the site, in both
// languages at once, until they pick one. The site starts in Nepali.
const LanguageBanner = ({ onDone }) => {
  const choose = async (lng) => {
    await changeLanguage(lng);
    onDone();
  };
  return (
    <View style={styles.banner}>
      <Icon name="language" size={iconSize.sm} color={colors.primary} />
      <Text style={styles.bannerText}>
        <Text lang="ne">भाषा छान्नुहोस्</Text>
        {'  ·  '}
        <Text lang="en">Choose your language</Text>
      </Text>
      <View style={styles.bannerActions}>
        {[{ lng: 'ne', label: 'नेपाली' }, { lng: 'en', label: 'English' }].map(({ lng, label }) => (
          <Pressable
            key={lng}
            onPress={() => choose(lng)}
            accessibilityRole="button"
            style={({ pressed, hovered }) => [styles.bannerButton, (pressed || hovered) && styles.bannerButtonActive]}
          >
            <Text style={styles.bannerButtonText} lang={lng}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

// Inside the signed-in app the pages have no footer, so each ends with the
// other pages instead, one tap away.
const RelatedPages = ({ pageKey }) => {
  const { t } = useTranslation();
  const site = useSiteStyle();
  const { openPage } = useOpenPage();
  return (
    <View style={[styles.related, { paddingHorizontal: site.gutter, maxWidth: SITE_WIDTH + site.gutter * 2 }]}>
      <Text style={styles.relatedTitle}>{t('site:related.title')}</Text>
      <View style={styles.relatedChips}>
        {PUBLIC_PAGES.filter((page) => page.key !== pageKey).map((page) => (
          <Pressable
            key={page.key}
            onPress={() => openPage(page.key)}
            accessibilityRole="link"
            style={({ pressed, hovered }) => [styles.chip, (pressed || hovered) && styles.chipActive]}
          >
            <Icon name={page.icon} size={iconSize.sm} color={colors.primaryText} />
            <Text style={styles.chipText}>{t(`site:pages.${page.key}.label`)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.relatedCopy}>{t('site:footer.copyright', { year: new Date().getFullYear() })}</Text>
    </View>
  );
};

// The frame of every information page. Who is looking decides the chrome:
//   web, signed out   the public site: sticky navbar, footer, first-visit
//                     language banner
//   signed in, or the Android app   just the page, under the app's own header
//                     and navigation, ending with links to the other pages
const PublicLayout = ({ pageKey, children }) => {
  const { t } = useTranslation();
  const signedIn = Boolean(useSelector((state) => state.auth.token));
  const publicSite = Platform.OS === 'web' && !signedIn;
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(null);
  const [showBanner, setShowBanner] = useState(() => publicSite && !isLanguageChosen());
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);

  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);

  const clearance = publicSite ? NAVBAR_CLEARANCE : spacing.lg;
  const listeners = useRef(new Set());

  // Where `node` sits from the top of the scrolled content.
  const measure = useCallback((node, onMeasured) => {
    const inner = scrollRef.current?.getInnerViewNode?.();
    if (!node || !inner || !node.measureLayout) return;
    node.measureLayout(inner, (x, y) => onMeasured(y), () => {});
  }, []);

  const scrollToNode = useCallback((node) => {
    measure(node, (y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - clearance), animated: true }));
  }, [measure, clearance]);

  const subscribe = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const scrollApi = useMemo(
    () => ({ scrollToNode, scrollToTop, measure, subscribe, clearance }),
    [scrollToNode, scrollToTop, measure, subscribe, clearance]
  );

  // Only crossing a threshold sets state, so scrolling doesn't re-render the page.
  const onScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = contentOffset.y;
    listeners.current.forEach((listener) => listener(y));
    if ((y > 8) !== scrolled) setScrolled(y > 8);
    // Hidden again at the very bottom, where the footer has its own link back up.
    const atEnd = y + layoutMeasurement.height > contentSize.height - FOOTER_ROOM;
    const wantTop = y > SHOW_TOP_AFTER && !(publicSite && atEnd);
    if (wantTop !== showTop) setShowTop(wantTop);
  };

  const onLayout = (event) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  return (
    <SiteWidthContext.Provider value={width}>
      <PageScrollContext.Provider value={scrollApi}>
        <View style={styles.root} onLayout={onLayout}>
          <ScrollView
            ref={scrollRef}
            style={[styles.scroll, webScrollbar()]}
            // The banner's slot counts as child 0 even when it renders nothing,
            // so the navbar is always child 1.
            stickyHeaderIndices={publicSite ? [1] : undefined}
            onScroll={onScroll}
            scrollEventThrottle={64}
            keyboardShouldPersistTaps="handled"
          >
            {publicSite && showBanner ? <LanguageBanner onDone={() => setShowBanner(false)} /> : null}
            {publicSite ? <PublicNavbar pageKey={pageKey} elevated={scrolled} /> : null}
            <View {...landmark('main')} style={styles.main}>{children}</View>
            {publicSite ? <PublicFooter onBackToTop={scrollToTop} /> : <RelatedPages pageKey={pageKey} />}
          </ScrollView>

          {showTop ? (
            <Pressable
              onPress={scrollToTop}
              accessibilityRole="button"
              accessibilityLabel={t('site:footer.backToTop')}
              style={({ pressed, hovered }) => [styles.topButton, (pressed || hovered) && styles.topButtonActive]}
            >
              <Icon name="arrowUp" size={iconSize.lg} color={colors.textOnPrimary} />
            </Pressable>
          ) : null}
        </View>
      </PageScrollContext.Provider>
    </SiteWidthContext.Provider>
  );
};

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  main: { minHeight: 200 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceDark,
  },
  bannerText: { ...type.smallMedium, color: colors.textInverse },
  bannerActions: { flexDirection: 'row', gap: spacing.sm },
  bannerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 0, 0.6)',
  },
  bannerButtonActive: { backgroundColor: 'rgba(255, 159, 0, 0.16)' },
  bannerButtonText: { ...type.smallMedium, color: colors.primary },

  related: { width: '100%', alignSelf: 'center', paddingTop: spacing.xxxl, paddingBottom: spacing.huge, gap: spacing.md },
  relatedTitle: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  relatedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  chipText: { ...type.smallMedium, color: colors.textPrimary },
  relatedCopy: { ...type.small, color: colors.textMuted, marginTop: spacing.md },

  topButton: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.level3,
  },
  topButtonActive: { backgroundColor: colors.primaryPressed },
}));

export default PublicLayout;
