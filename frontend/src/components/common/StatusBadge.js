import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, type } from '../../theme/tokens';
import Icon from '../../theme/icons';

const STATUS_STYLE = {
  open: { color: colors.info, icon: 'info' },
  quoted: { color: colors.warning, icon: 'quote' },
  negotiating: { color: colors.warning, icon: 'counterOffer' },
  countered: { color: colors.warning, icon: 'counterOffer' },
  booked: { color: colors.accent, icon: 'success' },
  pending: { color: colors.warning, icon: 'time' },
  confirmed: { color: colors.info, icon: 'success' },
  in_transit: { color: colors.accent, icon: 'truckDelivery' },
  completed: { color: colors.success, icon: 'success' },
  cancelled: { color: colors.error, icon: 'error' },
  rejected: { color: colors.error, icon: 'error' },
  accepted: { color: colors.success, icon: 'success' },
  expired: { color: colors.textMuted, icon: 'time' },
};

// Label text stays generated from the raw status string (never guessed
// per-status copy), so a new backend status renders sensibly by default.
const label = (status) => (status || '').replace(/_/g, ' ');

const StatusBadge = ({ status, showIcon = true }) => {
  const config = STATUS_STYLE[status] || { color: colors.textMuted, icon: 'info' };
  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}1F`, borderColor: config.color }]}>
      {showIcon && <Icon name={config.icon} size={12} color={config.color} style={styles.icon} />}
      <Text style={[styles.text, { color: config.color }]}>{label(status)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  icon: { marginRight: 4 },
  text: {
    fontSize: type.caption.fontSize,
    fontWeight: type.caption.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

export default StatusBadge;
