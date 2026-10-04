import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, themedStyles, themed } from '../../theme/tokens';

// The app's Button is drawn for light surfaces. The public pages also put
// actions on the amber and Deep Asphalt bands, where an amber button vanishes
// and amber-outlined text fails contrast, so these variants are added for the
// bands, with the same sizes, radius and focus ring as Button.
const VARIANTS = themed(() => ({
  primary: { background: colors.primary, active: colors.primaryPressed, text: colors.textOnPrimary, border: 'transparent' },
  // Deep Asphalt, for the amber band. Fixed hexes: it must stay dark in dark mode too.
  dark: { background: '#1E242B', active: '#12161A', text: '#FFFFFF', border: 'transparent' },
  outlineDark: { background: 'transparent', active: 'rgba(30, 36, 43, 0.08)', text: '#1E242B', border: '#1E242B' },
  // White outline, for the Deep Asphalt band.
  outlineLight: { background: 'transparent', active: 'rgba(244, 246, 248, 0.08)', text: colors.textInverse, border: 'rgba(244, 246, 248, 0.5)' },
  outline: { background: 'transparent', active: colors.primaryMuted, text: colors.primaryText, border: colors.primaryText },
}));

const SiteButton = ({ title, onPress, variant = 'primary', icon, iconRight, size = 'lg', style, accessibilityLabel }) => {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const large = size === 'lg';
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: large ? 56 : 48,
          paddingHorizontal: large ? spacing.xxl : spacing.xl,
          backgroundColor: hovered || pressed ? v.active : v.background,
          borderColor: v.border,
          borderWidth: v.border === 'transparent' ? 0 : 1.5,
        },
        focused && styles.focus,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={large ? 22 : 20} color={v.text} /> : null}
        <Text style={[styles.text, { color: v.text, fontSize: large ? 18 : 17 }]} numberOfLines={2}>{title}</Text>
        {iconRight ? <Icon name={iconRight} size={large ? 22 : 20} color={v.text} style={hovered ? styles.nudge : null} /> : null}
      </View>
    </Pressable>
  );
};

const styles = themedStyles(() => ({
  button: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, flexShrink: 1 },
  text: { fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  focus: { borderWidth: 2, borderColor: colors.focusRing },
  nudge: { transform: [{ translateX: 3 }] },
}));

export default SiteButton;
