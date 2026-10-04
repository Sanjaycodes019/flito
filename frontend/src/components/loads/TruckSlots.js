import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, themedStyles } from '../../theme/tokens';
import { trucksBookedOf, trucksNeededOf } from '../../utils/loadSlots';

// How many trucks a load needs and how many are booked, as a row of trucks:
// a ticked truck for each one booked, an outline for each still open. Shown
// wherever the load is, so shippers and owners alike can see how far along
// it is. `compact` is the small inline version for list cards.
const TruckSlots = ({ load, compact = false, style }) => {
  const { t } = useTranslation();
  const needed = trucksNeededOf(load);
  const booked = Math.min(trucksBookedOf(load), needed);
  const full = booked >= needed;

  const label = full
    ? t('loads:truckSlots.allBooked', { count: needed })
    : booked > 0
      ? t('loads:truckSlots.booked', { booked, needed })
      : t('loads:truckSlots.needs', { count: needed });
  const size = compact ? 16 : 22;

  return (
    <View style={[styles.box, compact && styles.boxCompact, full && !compact && styles.boxFull, style]} accessible accessibilityLabel={label}>
      <View style={styles.trucks}>
        {Array.from({ length: needed }, (_, index) => (
          <Icon
            key={index}
            name={index < booked ? 'truckBooked' : 'truck'}
            size={size}
            color={index < booked ? colors.accentText : colors.textMuted}
          />
        ))}
      </View>
      <Text style={[styles.label, compact && styles.labelCompact, booked > 0 && styles.labelBooked]}>{label}</Text>
    </View>
  );
};

const styles = themedStyles(() => ({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  boxCompact: {
    columnGap: spacing.sm,
    marginTop: spacing.sm,
    padding: 0,
    backgroundColor: 'transparent',
  },
  boxFull: { backgroundColor: colors.accentMuted },
  trucks: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  label: { ...type.bodyMedium, color: colors.textSecondary },
  labelCompact: { ...type.smallMedium },
  labelBooked: { color: colors.accentText },
}));

export default TruckSlots;
