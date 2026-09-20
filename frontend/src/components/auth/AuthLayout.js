import React from 'react';
import { View, Text, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useBreakpoint from '../../hooks/useBreakpoint';

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

// Shared shell for Log In, Sign Up, Forgot Password and Reset Password, so
// all four place their form the same way at every size:
// - phone:   logo and title stacked above a full-width form card
// - tablet:  the same, as a centered column with roomier spacing
// - desktop: a brand panel on the left, the form column centered on the right
// `maxWidth` caps the form column (wider for the longer Sign Up form).
//
// The FLITO logo mark and wordmark keep the true brand amber: WCAG contrast
// minimums do not apply to logotype (see theme/tokens.js primaryText).
const BrandPanel = () => {
  const { t } = useTranslation();
  const features = getFeatures(t);

  return (
    <View style={styles.brand}>
      <View style={styles.brandInner}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.brandLogo} resizeMode="contain" accessible={false} />
          <Text style={styles.brandWordmark}>FLITO</Text>
        </View>
        <Text style={styles.brandTagline}>{t('auth:layout.tagline')}</Text>
        <Text style={styles.brandHeadline} accessibilityRole="header">
          {t('auth:layout.headline')}
        </Text>
        <View style={styles.features}>
          {features.map((feature) => (
            <View key={feature.text} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={iconSize.md} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const AuthLayout = ({ title, subtitle, children, maxWidth = 440 }) => {
  const { t } = useTranslation();
  const { isPhone, isDesktop } = useBreakpoint();

  const formColumn = (
    <ScrollView
      style={[styles.scroll, getWebScrollbar()]}
      contentContainerStyle={[styles.scrollContent, isPhone ? styles.scrollPhone : styles.scrollWide]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.column, { maxWidth }]}>
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

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },

  // Desktop split
  split: { flex: 1, flexDirection: 'row' },
  formPane: { flex: 1 },
  brand: {
    flexBasis: '42%',
    maxWidth: 620,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    paddingHorizontal: spacing.huge,
    paddingVertical: spacing.xxxl,
  },
  brandInner: { maxWidth: 440 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 56, height: 56, borderRadius: radius.lg },
  brandWordmark: { ...type.display, color: colors.primary, letterSpacing: 1, marginLeft: spacing.md },
  brandTagline: { ...type.small, color: colors.textInverseMuted, marginTop: spacing.sm, textAlign: 'center' },
  brandHeadline: { ...type.h1, fontSize: 30, lineHeight: 38, color: colors.textInverse, marginTop: spacing.huge },
  features: { marginTop: spacing.xxl, gap: spacing.lg },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { ...type.bodyLarge, color: colors.textInverse, flex: 1 },

  // Form column
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  scrollPhone: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  scrollWide: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.huge },
  column: { width: '100%' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  headerWide: { marginBottom: spacing.xl },
  logo: { width: 56, height: 56, borderRadius: radius.lg, marginBottom: spacing.md },
  title: { ...type.h1, color: colors.textPrimary, textAlign: 'center' },
  titleWide: { fontSize: 28, lineHeight: 36 },
  subtitle: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  card: { marginVertical: 0 },
  cardWide: { padding: spacing.xxl },
}));

export default AuthLayout;
