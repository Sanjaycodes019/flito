import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, type, iconSize } from '../../theme/tokens';
import Icon from '../../theme/icons';
import Button from './Button';

// The shared empty/error state for every list and detail screen: an icon,
// a short title, an explanatory line, and an optional single action. Used
// for "no loads yet", "no bookings", and network/error states alike so
// they read as the same app instead of ad hoc per-screen text.
const EmptyState = ({ icon = 'empty', title, message, actionLabel, onAction, tone = 'muted' }) => (
  <View style={styles.container}>
    <View style={[styles.iconWrap, tone === 'error' && styles.iconWrapError]}>
      <Icon name={icon} size={iconSize.xl} color={tone === 'error' ? colors.error : colors.textMuted} />
    </View>
    {!!title && <Text style={styles.title}>{title}</Text>}
    {!!message && <Text style={styles.message}>{message}</Text>}
    {!!actionLabel && (
      <Button title={actionLabel} onPress={onAction} variant={tone === 'error' ? 'secondary' : 'primary'} style={styles.action} />
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconWrapError: { backgroundColor: colors.errorMuted },
  title: { ...type.h3, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  message: { ...type.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  action: { minWidth: 180 },
});

export default EmptyState;
