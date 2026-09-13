import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, type } from '../../theme/tokens';
import Icon from '../../theme/icons';

// Each status maps to a tinted background plus a darkened "Text" tone for
// the border, icon and label together. The vivid brand/semantic hues
// (colors.success, .info, ...) are too light to use as small text or a thin
// border on their own tint and fail WCAG AA there; the paired *Text tokens
// are the same hue, just dark enough to read at 11px.
const STATUS_STYLE = {
  open: { tint: colors.infoMuted, text: colors.infoText, icon: 'info' },
  quoted: { tint: colors.warningMuted, text: colors.warningText, icon: 'quote' },
  negotiating: { tint: colors.warningMuted, text: colors.warningText, icon: 'counterOffer' },
  countered: { tint: colors.warningMuted, text: colors.warningText, icon: 'counterOffer' },
  booked: { tint: colors.accentMuted, text: colors.accentText, icon: 'success' },
  pending: { tint: colors.warningMuted, text: colors.warningText, icon: 'time' },
  confirmed: { tint: colors.infoMuted, text: colors.infoText, icon: 'success' },
  in_transit: { tint: colors.accentMuted, text: colors.accentText, icon: 'truckDelivery' },
  completed: { tint: colors.successMuted, text: colors.successText, icon: 'success' },
  cancelled: { tint: colors.errorMuted, text: colors.errorText, icon: 'error' },
  rejected: { tint: colors.errorMuted, text: colors.errorText, icon: 'error' },
  accepted: { tint: colors.successMuted, text: colors.successText, icon: 'success' },
  expired: { tint: colors.surfaceMuted, text: colors.textMuted, icon: 'time' },
};

// Label text stays generated from the raw status string (never guessed
// per-status copy), so a new backend status renders sensibly by default.
const label = (status) => (status || '').replace(/_/g, ' ');

const StatusBadge = ({ status, showIcon = true }) => {
  const config = STATUS_STYLE[status] || { tint: colors.surfaceMuted, text: colors.textMuted, icon: 'info' };
  return (
    <View style={[styles.badge, { backgroundColor: config.tint, borderColor: config.text }]}>
      {showIcon && <Icon name={config.icon} size={12} color={config.text} style={styles.icon} />}
      <Text style={[styles.text, { color: config.text }]}>{label(status)}</Text>
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
