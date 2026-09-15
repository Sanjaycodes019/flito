import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Card from './Card';
import Button from './Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

// The building blocks of an account page, in the pattern account settings use
// across Google, LinkedIn and Uber: a titled group (with an optional action
// such as "Edit") holding rows of label, value, status and a chevron when the
// row opens something.

const PILL_TONES = {
  success: { background: colors.successMuted, text: colors.successText },
  warning: { background: colors.warningMuted, text: colors.warningText },
  error: { background: colors.errorMuted, text: colors.errorText },
  info: { background: colors.infoMuted, text: colors.infoText },
  muted: { background: colors.surfaceMuted, text: colors.textMuted },
};

export const StatusPill = ({ label, tone = 'muted', icon }) => {
  const palette = PILL_TONES[tone] || PILL_TONES.muted;
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      {icon ? <Icon name={icon} size={12} color={palette.text} /> : null}
      <Text style={[styles.pillText, { color: palette.text }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

export const SettingsSection = ({ title, description, actionLabel, actionIcon = 'edit', onAction, children, style }) => {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
          {!!description && <Text style={styles.sectionDescription}>{description}</Text>}
        </View>
        {!!actionLabel && (
          <Button title={actionLabel} icon={actionIcon} variant="ghost" size="sm" onPress={onAction} style={styles.sectionAction} />
        )}
      </View>
      <Card style={styles.sectionCard}>
        {rows.map((row, index) => React.cloneElement(row, { first: index === 0 }))}
      </Card>
    </View>
  );
};

export const SettingsRow = ({
  icon,
  label,
  value,
  valueMuted = false,
  pill,
  onPress,
  destructive = false,
  first = false,
  accessibilityLabel,
}) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const interactive = Boolean(onPress);

  const content = (
    <>
      {!!icon && (
        <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
          <Icon name={icon} size={iconSize.md} color={destructive ? colors.errorText : colors.textSecondary} />
        </View>
      )}
      <View style={styles.rowText}>
        {value !== undefined ? (
          <>
            <Text style={styles.rowLabelSmall}>{label}</Text>
            <Text style={[styles.rowValue, valueMuted && styles.rowValueMuted]} numberOfLines={2}>{value}</Text>
          </>
        ) : (
          <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        )}
      </View>
      {pill ? <StatusPill {...pill} /> : null}
      {interactive && !destructive && (
        <Icon name="forward" size={iconSize.md} color={colors.textMuted} style={styles.chevron} />
      )}
    </>
  );

  if (!interactive) {
    return <View style={[styles.row, !first && styles.rowDivider]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (value ? `${label}, ${value}` : label)}
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowDivider,
        (hovered || pressed) && styles.rowActive,
        focused && styles.rowFocused,
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionHeading: { flex: 1, paddingRight: spacing.sm },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  sectionDescription: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  sectionAction: { marginVertical: 0 },
  sectionCard: { padding: 0, marginVertical: 0, overflow: 'hidden' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowActive: { backgroundColor: colors.surfaceMuted },
  rowFocused: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDestructive: { backgroundColor: colors.errorMuted },
  rowText: { flex: 1, minWidth: 0 },
  rowLabelSmall: { ...type.small, color: colors.textMuted },
  rowValue: { ...type.body, color: colors.textPrimary, marginTop: 1 },
  rowValueMuted: { color: colors.textMuted },
  rowLabel: { ...type.bodyMedium, color: colors.textPrimary },
  rowLabelDestructive: { color: colors.errorText },
  chevron: { marginLeft: -spacing.xs },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    maxWidth: 150,
  },
  pillText: { ...type.caption, fontSize: 11, textTransform: 'none', letterSpacing: 0 },
});
