import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, themedStyles } from '../../theme/tokens';

// A big picture-and-word button for picking one thing, so a choice can be made
// by looking at the picture instead of reading. `columns` is how many sit in a
// row on a wide screen; a narrow one shows fewer so a word is never split
// across lines (each tile keeps at least MIN_TILE px).
export const ChoiceGrid = ({ children, style }) => (
  <View style={[styles.grid, style]} accessibilityRole="radiogroup">{children}</View>
);

const MIN_TILE = 100;
const PAGE_GUTTERS = 32;

export const fitColumns = (columns, windowWidth) => Math.max(2, Math.min(columns, Math.floor((windowWidth - PAGE_GUTTERS) / MIN_TILE)));

const ChoiceTile = ({ icon, label, selected, onPress, columns = 2 }) => {
  const { width } = useWindowDimensions();
  const across = fitColumns(columns, width);
  return (
  <View style={[styles.cell, { width: `${100 / across}%` }]}>
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
};

const styles = themedStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3, marginBottom: spacing.md },
  cell: { padding: 3 },
  tile: {
    minHeight: 68,
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
  label: { ...type.smallMedium, fontSize: 14, lineHeight: 19, color: colors.textPrimary, textAlign: 'center' },
  labelSelected: { color: colors.primaryText },
}));

export default ChoiceTile;
