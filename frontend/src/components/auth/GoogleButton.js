import React, { useRef, useState } from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import GoogleIcon from './GoogleIcon';
import { colors, spacing, radius, type, motion } from '../../theme/tokens';

// Google's own button guidelines call for a neutral white/light surface
// with a thin border and dark neutral text, not one of the app's brand
// variants (amber/navy/teal would clash with the mark), the visual half of
// the same exemption GoogleIcon documents.
const GoogleButton = ({ title, onPress, loading = false, disabled = false }) => {
  const { t } = useTranslation();
  const label = title || t('auth:google.continueWithGoogle');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const animateTo = (toValue) => Animated.timing(scale, { toValue, duration: motion.fast, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        onPressIn={() => !isDisabled && animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        hitSlop={8}
        style={[
          styles.button,
          hovered && !isDisabled && styles.hovered,
          isDisabled && styles.disabled,
          focused && styles.focusRing,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.textSecondary} size="small" />
        ) : (
          <View style={styles.content}>
            <GoogleIcon size={18} />
            <Text style={styles.text} numberOfLines={1}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  hovered: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
  focusRing: { borderWidth: 2, borderColor: colors.focusRing },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: { ...type.bodyMedium, color: colors.textPrimary },
});

export default GoogleButton;
