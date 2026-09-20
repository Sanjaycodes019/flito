import React from 'react';
import { View, Text } from 'react-native';
import Card from '../../components/common/Card';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

const initialsOf = (name) => {
  const letters = (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join('') || '?';
};

// The leading mark of a card: initials in a circle for a person, an icon in a
// tinted square for a thing (load, truck, booking).
const Lead = ({ icon, person }) => (person ? (
  <View style={[styles.lead, styles.leadPerson]}>
    <Text style={styles.initials}>{initialsOf(person)}</Text>
  </View>
) : (
  <View style={[styles.lead, styles.leadThing]}>
    <Icon name={icon} size={iconSize.md} color={colors.primaryText} />
  </View>
));

// The record card every admin list uses. Top: a leading mark, the record's
// name and one line of context, and its status. Middle: facts and anything
// else, passed as children. Bottom: an optional footer for actions, set off by
// a rule. One anatomy for every list is what makes them read as one product.
const AdminCard = ({ icon, person, title, subtitle, right, children, footer }) => (
  <Card style={styles.card}>
    <View style={styles.header}>
      <Lead icon={icon} person={person} />
      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
    {children ? <View style={styles.body}>{children}</View> : null}
    {footer ? <View style={styles.footer}>{footer}</View> : null}
  </Card>
);

// One fact about a record: a small icon, an optional muted label, the value.
// Falsy values render nothing, so optional fields need no checks.
export const Fact = ({ icon, label, children }) => {
  if (!children) return null;
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={iconSize.xs} color={colors.textMuted} style={styles.factIcon} />
      <Text style={styles.factText}>
        {label ? <Text style={styles.factLabel}>{label}  </Text> : null}
        {children}
      </Text>
    </View>
  );
};

export const PillRow = ({ children }) => <View style={styles.pills}>{children}</View>;

export const ActionRow = ({ children }) => <View style={styles.actions}>{children}</View>;

export const DocumentGrid = ({ children }) => <View style={styles.documents}>{children}</View>;

const styles = themedStyles(() => ({
  card: { padding: spacing.lg, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  right: { flexShrink: 0 },
  lead: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  leadPerson: { borderRadius: 20, backgroundColor: colors.surfaceDark },
  leadThing: { borderRadius: radius.md, backgroundColor: colors.primaryMuted },
  initials: { fontSize: 14, fontWeight: '700', color: colors.textOnDark },
  title: { ...type.h3, color: colors.textPrimary },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  body: { marginTop: spacing.md, gap: spacing.xs + 2 },
  fact: { flexDirection: 'row', alignItems: 'flex-start' },
  factIcon: { marginTop: 3, marginRight: spacing.sm, width: iconSize.xs },
  factText: { ...type.small, color: colors.textSecondary, flex: 1 },
  factLabel: { color: colors.textMuted },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  footer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  documents: { marginTop: spacing.xs },
}));

export default AdminCard;
