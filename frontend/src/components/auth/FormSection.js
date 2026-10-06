import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';

// One numbered step of a longer form: a badge, a title, an optional one-line
// hint, then the fields. Sections are separated by a rule so a long form reads
// as a few short steps instead of one wall of inputs. `last` drops the rule.
const FormSection = ({ step, title, hint, children, last = false }) => (
  <View style={[styles.section, !last && styles.rule]}>
    <View style={styles.head}>
      <View style={styles.badge} accessible={false}>
        <Text style={styles.badgeText}>{step}</Text>
      </View>
      <View style={styles.headText}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
    {children}
  </View>
);

const styles = themedStyles(() => ({
  section: { paddingBottom: spacing.xl, marginBottom: spacing.xl },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.smallMedium, color: colors.primaryText },
  headText: { flex: 1 },
  title: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginTop: 2 },
}));

export default FormSection;
