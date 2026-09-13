import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FLITO_COLORS } from '../../utils/colors';

const STATUS_COLORS = {
  open: FLITO_COLORS.info,
  quoted: FLITO_COLORS.warning,
  negotiating: FLITO_COLORS.warning,
  booked: FLITO_COLORS.accent,
  pending: FLITO_COLORS.warning,
  confirmed: FLITO_COLORS.info,
  in_transit: FLITO_COLORS.accent,
  completed: FLITO_COLORS.success,
  cancelled: FLITO_COLORS.error,
  rejected: FLITO_COLORS.error,
  accepted: FLITO_COLORS.success,
  countered: FLITO_COLORS.warning,
  expired: FLITO_COLORS.textMuted,
};

const StatusBadge = ({ status }) => {
  const color = STATUS_COLORS[status] || FLITO_COLORS.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{(status || '').replace('_', ' ')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default StatusBadge;
