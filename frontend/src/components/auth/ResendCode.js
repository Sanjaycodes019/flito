import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, type } from '../../theme/tokens';
import Icon from '../../theme/icons';

const formatClock = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// The same wait the server enforces between codes (RESEND_COOLDOWN_MS in
// backend/src/services/verification.js).
export const RESEND_COOLDOWN_SECONDS = 45;

// The resend affordance under an OTP field: counts down from the moment a
// code was (re)sent, then turns into a tappable "Resend code" link. Keeps
// the cooldown visible so there is never a dead tap that silently does
// nothing while a code is still in flight.
const ResendCode = ({ sentAt, cooldownSeconds = RESEND_COOLDOWN_SECONDS, onResend, disabled }) => {
  const { t } = useTranslation();
  // Ticks once a second only to re-render. The time left is read fresh each
  // render, so a sentAt that just changed never counts from a stale clock.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = sentAt ? Math.max(0, cooldownSeconds - Math.floor((Date.now() - sentAt) / 1000)) : 0;
  const canResend = remaining <= 0 && !disabled;

  if (!canResend) {
    return (
      <View style={styles.row}>
        <Icon name="time" size={14} color={colors.textMuted} style={styles.icon} />
        <Text style={styles.muted}>{t('auth:resendCode.countdown', { clock: formatClock(remaining) })}</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onResend} accessibilityRole="button" accessibilityLabel={t('auth:resendCode.link')} style={styles.row} hitSlop={8}>
      <Icon name="refresh" size={14} color={colors.textLink} style={styles.icon} />
      <Text style={styles.link}>{t('auth:resendCode.link')}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  icon: { marginRight: 6 },
  muted: { ...type.small, color: colors.textMuted },
  link: { ...type.smallMedium, color: colors.textLink },
});

export default ResendCode;
