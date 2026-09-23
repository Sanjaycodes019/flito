import React, { useRef, useState } from 'react';
import { Pressable, Text, View, ActivityIndicator, Animated } from 'react-native';
import { colors, spacing, radius, type as textType, iconSize, motion, themedStyles, themed } from '../../theme/tokens';
import Icon from '../../theme/icons';

// Five variants covering every emphasis level the app needs:
// primary (main call to action), secondary (alternate solid action),
// tertiary (outlined, lower emphasis; "outline" is kept as an alias while
// screens are migrated), ghost (no border or fill, lowest emphasis),
// destructive (a dangerous or irreversible action: cancel, remove, reject).
const VARIANTS = themed(() => ({
  primary: {
    background: colors.primary,
    backgroundActive: colors.primaryPressed,
    text: colors.textOnPrimary,
    border: 'transparent',
  },
  secondary: {
    background: colors.secondary,
    backgroundActive: colors.secondaryPressed,
    text: colors.textOnDark,
    border: 'transparent',
  },
  tertiary: {
    background: 'transparent',
    backgroundActive: colors.primaryMuted,
    text: colors.primaryText,
    border: colors.primaryText,
  },
  ghost: {
    background: 'transparent',
    backgroundActive: colors.surfaceMuted,
    text: colors.textPrimary,
    border: 'transparent',
  },
  destructive: {
    background: colors.errorStrong,
    backgroundActive: colors.errorStrongPressed,
    text: colors.textOnDark,
    border: 'transparent',
  },
  outline: { // legacy alias of tertiary
    background: 'transparent',
    backgroundActive: colors.primaryMuted,
    text: colors.primaryText,
    border: colors.primaryText,
  },
}));

const SIZES = {
  // Large: for the main step buttons of a guided flow. 56px is easy to hit with a thumb.
  lg: { height: 56, paddingHorizontal: spacing.xxl, fontSize: 18, icon: 24, gap: spacing.sm },
  md: { height: 48, paddingHorizontal: spacing.xl, fontSize: textType.bodyMedium.fontSize, icon: iconSize.md, gap: spacing.sm },
  // 40px plus the 8px hitSlop below reaches the 44-48px minimum touch target
  // recommended on both iOS and Android, even though the drawn chip looks
  // more compact than an "md" button.
  sm: { height: 40, paddingHorizontal: spacing.lg, fontSize: textType.small.fontSize, icon: iconSize.sm, gap: spacing.xs },
};

const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  accessibilityLabel,
}) => {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue) => Animated.timing(scale, { toValue, duration: motion.fast, useNativeDriver: true }).start();

  const active = hovered && !isDisabled;
  const backgroundColor = isDisabled ? colors.disabledBg : active ? v.backgroundActive : v.background;
  const textColor = isDisabled ? colors.disabledText : v.text;
  const borderColor = isDisabled ? colors.disabledBg : v.border;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
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
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={accessibilityLabel || title}
        hitSlop={8}
        style={[
          styles.button,
          {
            // A minimum, not a fixed height: a long label in a narrow button
            // (two side by side on a phone, or a long Nepali phrase) wraps to
            // a second line and the button grows, instead of spilling out.
            minHeight: s.height,
            paddingHorizontal: s.paddingHorizontal,
            backgroundColor,
            borderColor,
            borderWidth: v.border === 'transparent' ? 0 : 1.5,
          },
          focused && styles.focusRing,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <View style={styles.content}>
            {icon && iconPosition === 'left' && (
              <Icon name={icon} size={s.icon} color={textColor} style={styles.iconLeft} />
            )}
            <Text style={[styles.text, { color: textColor, fontSize: s.fontSize }]} numberOfLines={2}>
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <Icon name={icon} size={s.icon} color={textColor} style={styles.iconRight} />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = themedStyles(() => ({
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    paddingVertical: spacing.xs,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1, maxWidth: '100%' },
  text: { fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  iconLeft: { marginRight: spacing.sm, flexShrink: 0 },
  iconRight: { marginLeft: spacing.sm, flexShrink: 0 },
  // Keyboard-focus indicator. React Native has no native outline, so a
  // visible ring is drawn with a second border in the brand accent color.
  focusRing: {
    borderWidth: 2,
    borderColor: colors.focusRing,
  },
}));

export default Button;
