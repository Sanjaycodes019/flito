import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, themedStyles } from '../../theme/tokens';

// A big picture-and-word button for picking one thing, so a choice can be made
// by looking at the picture instead of reading. `columns` sets how many sit in
// a row.
export const ChoiceGrid = ({ children, style }) => (
  <View style={[styles.grid, style]} accessibilityRole="radiogroup">{children}</View>
);

const ChoiceTile = ({ icon, label, selected, onPress, columns = 2 }) => (
  <View style={[styles.cell, { width: `${100 / columns}%` }]}>
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: Boolean(selected), selected: Boolean(selected) }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.tilePressed]}
    >
      {!!icon && <Icon name={icon} size={26} color={selected ? colors.primaryText : colors.textSecondary} />}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>{label}</Text>
    </Pressable>
  </View>
);

const styles = themedStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3, marginBottom: spacing.md },
  cell: { padding: 3 },
  tile: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  tilePressed: { opacity: 0.8 },
  label: { ...type.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.textPrimary, textAlign: 'center' },
  labelSelected: { color: colors.primaryText },
}));

export default ChoiceTile;
