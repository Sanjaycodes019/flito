import React from 'react';
import { View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useBreakpoint from '../../hooks/useBreakpoint';
import QuickToggles from '../common/QuickToggles';
import QuickLinks from '../../public/components/QuickLinks';
import useOpenPage from '../../public/useOpenPage';

const LOGO = require('../../../assets/icon.png');

// When the form is taller than the window, desktop browsers (Windows in
// particular) draw a full-width gray scrollbar track down the page edge.
// It stays, since it is how a mouse user sees the page scrolls, but thin and
// in the app's own border tone instead of the heavy default. Passed as a
// plain object: these are CSS properties react-native-web forwards as-is.
const getWebScrollbar = () => (Platform.OS === 'web'
  ? { scrollbarWidth: 'thin', scrollbarColor: `${colors.borderStrong} transparent` }
  : null);

const getFeatures = (t) => [
  { icon: 'load', text: t('auth:layout.featureLoadQuotes') },
  { icon: 'verified', text: t('auth:layout.featureVerified') },
  { icon: 'gps', text: t('auth:layout.featureTracking') },
];

// The brand panel needs about this much height for its example trip; a shorter
// window drops the card rather than clipping it.
const SHOW_EXAMPLE_FROM_HEIGHT = 760;

// Shared shell for Log In, Sign Up, Forgot Password and Reset Password, so
// all four place their form the same way at every size:
// - phone:   logo and title stacked above a full-width form card
// - tablet:  the same, as a centered column with roomier spacing
// - desktop: a brand panel on the left, the form column centered on the right
// `maxWidth` caps the form column (wider for the longer Sign Up form).
//
// The FLITO logo mark and wordmark keep the true brand amber: WCAG contrast
// minimums do not apply to logotype (see theme/tokens.js primaryText).
// On the web the FLITO mark leads back to the public landing page; the
// Android app has none.
const HAS_LANDING = Platform.OS === 'web';

// A faint road across the panel: two rings, a winding dashed route and the
// stops along it. Pure decoration, so it is hidden from assistive tech.
const PanelArt = () => (
  <View style={styles.art} pointerEvents="none" accessible={false}>
    <Svg width="100%" height="100%" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
      <Circle cx={540} cy={90} r={230} fill={colors.primary} opacity={0.1} />
      <Circle cx={540} cy={90} r={150} fill="none" stroke={colors.primary} strokeWidth={1.5} opacity={0.35} />
      <Circle cx={-40} cy={840} r={190} fill={colors.primary} opacity={0.07} />
      <Path
        d="M -20 880 C 110 850 170 905 300 872 S 470 820 640 850"
        fill="none"
        stroke={colors.primary}
        strokeWidth={2.5}
        strokeDasharray="4 12"
        strokeLinecap="round"
        opacity={0.4}
      />
      <Circle cx={300} cy={872} r={6} fill={colors.primary} opacity={0.7} />
      <Circle cx={470} cy={826} r={4} fill={colors.primary} opacity={0.4} />
    </Svg>
  </View>
);

// The example trip: the same one the public landing page shows, labelled as an
// example, so nothing here is a claim about real numbers.
const ExampleTrip = () => {
  const { t } = useTranslation();
  const offers = t('site:landing.preview.offers', { returnObjects: true });
  const shown = Array.isArray(offers) ? offers.slice(0, 2) : [];
  const dots = [0, 1, 2, 3, 4, 5, 6];

  return (
    <View style={styles.trip} accessibilityLabel={t('site:landing.preview.label')}>
      <View style={styles.tripHead}>
        <View style={styles.tripTag}>
          <Text style={styles.tripTagText}>{t('site:landing.preview.label')}</Text>
        </View>
        <Text style={styles.tripGoods} numberOfLines={1}>{t('site:landing.preview.goods')}</Text>
      </View>

      <View style={styles.route}>
        <View style={styles.stop}>
          <View style={styles.stopDot} />
          <Text style={styles.stopText} numberOfLines={1}>{t('site:landing.preview.from')}</Text>
        </View>
        <View style={styles.road}>
          {dots.map((n) => <View key={n} style={styles.roadDot} />)}
          <View style={styles.truck}>
            <Icon name="truckDelivery" size={iconSize.sm} color={colors.textOnPrimary} />
          </View>
          {dots.map((n) => <View key={`b${n}`} style={styles.roadDot} />)}
        </View>
        <View style={[styles.stop, styles.stopEnd]}>
          <Text style={styles.stopText} numberOfLines={1}>{t('site:landing.preview.to')}</Text>
          <View style={[styles.stopDot, styles.stopDotEnd]} />
        </View>
      </View>

      <View style={styles.tripFacts}>
        <View style={styles.fact}>
          <Icon name="weight" size={iconSize.xs} color={colors.textInverseMuted} />
          <Text style={styles.factText}>{t('site:landing.preview.weight')}</Text>
        </View>
        <View style={styles.fact}>
          <Icon name="truck" size={iconSize.xs} color={colors.textInverseMuted} />
          <Text style={styles.factText} numberOfLines={1}>{t('site:landing.preview.truck')}</Text>
        </View>
      </View>

      {shown.map((offer) => (
        <View key={offer.who} style={styles.offer}>
          <View style={styles.offerWho}>
            <Text style={styles.offerName} numberOfLines={1}>{offer.who}</Text>
            <View style={styles.offerNote}>
              <Icon name="verified" size={iconSize.xs} color={colors.success} />
              <Text style={styles.offerNoteText}>{offer.note}</Text>
            </View>
          </View>
          <Text style={styles.offerPrice}>{offer.price}</Text>
        </View>
      ))}
    </View>
  );
};

const BrandPanel = () => {
  const { t } = useTranslation();
  const { openAuth } = useOpenPage();
  const { height } = useWindowDimensions();
  const features = getFeatures(t);

  return (
    <View style={styles.brand}>
      <PanelArt />
      <View style={styles.brandInner}>
        <Pressable
          onPress={HAS_LANDING ? () => openAuth('Landing') : undefined}
          disabled={!HAS_LANDING}
          accessibilityRole={HAS_LANDING ? 'link' : undefined}
          accessibilityLabel="FLITO"
          style={styles.brandRow}
        >
          <Image source={LOGO} style={styles.brandLogo} resizeMode="contain" accessible={false} />
          <Text style={styles.brandWordmark}>FLITO</Text>
        </Pressable>
        <Text style={styles.brandTagline}>{t('auth:layout.tagline')}</Text>

        <Text style={styles.brandHeadline} accessibilityRole="header">
          {t('auth:layout.headline')}
        </Text>

        {height >= SHOW_EXAMPLE_FROM_HEIGHT ? <ExampleTrip /> : null}

        <View style={styles.features}>
          {features.map((feature) => (
            <View key={feature.text} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={iconSize.sm} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// `showToggles` puts the language and light/dark switch above the form (the
// language choice page turns it off: it is the language switch). `footer` sits
// under the card, for the "no account yet?" prompt and other secondary links.
const AuthLayout = ({ title, subtitle, children, footer, maxWidth = 440, showToggles = true }) => {
  const { t } = useTranslation();
  const { isPhone, isDesktop } = useBreakpoint();
  const { openAuth } = useOpenPage();

  const formColumn = (
    <ScrollView
      style={[styles.scroll, getWebScrollbar()]}
      contentContainerStyle={[styles.scrollContent, isPhone ? styles.scrollPhone : styles.scrollWide]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.column, { maxWidth }]}>
        <View style={styles.topRow}>
          {HAS_LANDING && !isDesktop ? (
            <Pressable onPress={() => openAuth('Landing')} accessibilityRole="link" hitSlop={8} style={styles.homeLink}>
              <Icon name="back" size={iconSize.md} color={colors.textLink} />
              <Text style={styles.homeLinkText}>FLITO</Text>
            </Pressable>
          ) : <View />}
          {showToggles ? <QuickToggles /> : null}
        </View>
        <View style={[styles.header, !isPhone && styles.headerWide]}>
          {/* One heading, not two: the logo mark alone sits above the page
              title (a "FLITO" wordmark beside it competed with the title on
              small screens). On desktop the brand panel carries the logo and
              wordmark, so the form column shows only the title. */}
          {!isDesktop && (
            <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel={t('auth:layout.logoAccessibilityLabel')} />
          )}
          <Text style={[styles.title, !isPhone && styles.titleWide]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <Card style={[styles.card, !isPhone && styles.cardWide]}>{children}</Card>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
        <QuickLinks style={styles.quickLinks} />
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {isDesktop ? (
        <View style={styles.split}>
          <BrandPanel />
          <View style={styles.formPane}>{formColumn}</View>
        </View>
      ) : formColumn}
    </KeyboardAvoidingView>
  );
};

const GLASS = 'rgba(255, 255, 255, 0.06)';
const GLASS_EDGE = 'rgba(255, 255, 255, 0.12)';

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },

  // Desktop split
  split: { flex: 1, flexDirection: 'row' },
  formPane: { flex: 1 },
  brand: {
    flexBasis: '44%',
    maxWidth: 680,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    paddingHorizontal: spacing.huge + spacing.lg,
    paddingVertical: spacing.xxxl,
    overflow: 'hidden',
  },
  art: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  brandInner: { maxWidth: 480, width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  brandLogo: { width: 48, height: 48, borderRadius: radius.lg },
  brandWordmark: { ...type.h1, fontWeight: '800', color: colors.primary, letterSpacing: 1.2, marginLeft: spacing.md },
  brandTagline: { ...type.small, color: colors.textInverseMuted, marginTop: spacing.sm },
  brandHeadline: { ...type.h1, fontSize: 36, lineHeight: 44, fontWeight: '800', color: colors.textInverse, marginTop: spacing.xxxl + spacing.lg },

  // Example trip card
  trip: {
    marginTop: spacing.xxl,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_EDGE,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tripTag: { backgroundColor: colors.primaryMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tripTagText: { ...type.caption, fontSize: 10, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  tripGoods: { ...type.bodyMedium, color: colors.textInverse, flex: 1 },
  route: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flexShrink: 0 },
  stopEnd: { justifyContent: 'flex-end' },
  stopDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.primary },
  stopDotEnd: { backgroundColor: colors.success, borderColor: colors.success },
  stopText: { ...type.smallMedium, color: colors.textInverse },
  road: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  roadDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.35)' },
  truck: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tripFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  factText: { ...type.small, fontSize: 12, color: colors.textInverseMuted },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: GLASS_EDGE,
  },
  offerWho: { flex: 1, minWidth: 0 },
  offerName: { ...type.small, color: colors.textInverse },
  offerNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  offerNoteText: { ...type.small, fontSize: 11, color: colors.textInverseMuted },
  offerPrice: { ...type.bodyMedium, color: colors.primary },

  features: { marginTop: spacing.xxl, gap: spacing.md },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { ...type.body, color: colors.textInverse, flex: 1 },

  // Form column
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  scrollPhone: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  scrollWide: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.huge },
  column: { width: '100%' },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  headerWide: { marginBottom: spacing.xxl },
  logo: { width: 56, height: 56, borderRadius: radius.lg, marginBottom: spacing.md },
  title: { ...type.h1, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  titleWide: { fontSize: 30, lineHeight: 38 },
  subtitle: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  card: { marginVertical: 0, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg, minHeight: 34 },
  homeLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  homeLinkText: { ...type.smallMedium, color: colors.textLink },
  footer: { marginTop: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  quickLinks: { marginTop: spacing.xl },
  cardWide: { padding: spacing.xxl },
}));

export default AuthLayout;
