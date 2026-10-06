import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, shadow, themedStyles } from '../../theme/tokens';

// The dark header card that opens the money pages (an owner's payment
// details, FLITO's fees): an icon, a small label, a title, a line of text and
// a row of short reassurances. `points` are { icon, label }.
const PaymentHero = ({ icon = 'shieldLock', eyebrow, title, body, points = [], children }) => (
  <View style={styles.hero}>
    <View style={styles.heroTop}>
      <View style={styles.heroIcon}><Icon name={icon} size={26} color={colors.textOnPrimary} /></View>
      <View style={styles.heroText}>
        {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.heroTitle} accessibilityRole="header">{title}</Text>
      </View>
    </View>
    {body ? <Text style={styles.heroBody}>{body}</Text> : null}
    {points.length ? (
      <View style={styles.trustRow}>
        {points.map((point) => (
          <View key={point.label} style={styles.trustItem}>
            <Icon name={point.icon} size={iconSize.sm} color={colors.primary} />
            <Text style={styles.trustText}>{point.label}</Text>
          </View>
        ))}
      </View>
    ) : null}
    {children}
  </View>
);

const styles = themedStyles(() => ({
  hero: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, ...shadow.level2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroEyebrow: { ...type.caption, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { ...type.h2, color: colors.textInverse },
  heroBody: { ...type.body, color: colors.textInverseMuted, marginTop: spacing.md },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    maxWidth: '100%',
  },
  trustText: { ...type.small, color: colors.textInverse, flexShrink: 1 },
}));

export default PaymentHero;
