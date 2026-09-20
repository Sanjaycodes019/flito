import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// A short menu of choices inside a dialog, one full-width row each (icon,
// label, optional detail line), in the style of the account menus in Google
// and Apple products. A `destructive` row is tinted red. `dense` gives
// compact single-line rows for small dialogs.
const ActionRow = ({ icon, label, description, onPress, destructive, first, dense }) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        dense && styles.rowDense,
        !first && styles.rowDivider,
        (hovered || pressed || focused) && styles.rowActive,
      ]}
    >
      <View style={[styles.iconWrap, dense && styles.iconWrapDense, destructive && styles.iconWrapDestructive]}>
        <Icon
          name={icon}
          size={dense ? iconSize.sm : iconSize.md}
          color={destructive ? colors.errorText : colors.textSecondary}
        />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, dense && styles.labelDense, destructive && styles.labelDestructive]}>{label}</Text>
        {!!description && !dense && <Text style={styles.description}>{description}</Text>}
      </View>
    </Pressable>
  );
};

const ActionList = ({ actions, dense = false, style }) => (
  <View style={[styles.list, style]}>
    {actions.filter(Boolean).map((action, index) => (
      <ActionRow key={action.label} {...action} dense={dense} first={index === 0} />
    ))}
  </View>
);

const styles = themedStyles(() => ({
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  rowDense: { minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowActive: { backgroundColor: colors.surfaceMuted },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDense: { width: 30, height: 30, borderRadius: 15 },
  iconWrapDestructive: { backgroundColor: colors.errorMuted },
  text: { flex: 1 },
  label: { ...type.bodyMedium, color: colors.textPrimary },
  labelDense: { ...type.body, fontWeight: '500' },
  labelDestructive: { color: colors.errorText },
  description: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
}));

export default ActionList;
