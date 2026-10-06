import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';

const METHODS = [
  { key: 'email', icon: 'email', labelKey: 'auth:login.methodEmail' },
  { key: 'phone', icon: 'phone', labelKey: 'auth:login.methodPhone' },
];

const Segment = ({ method, active, onPress }) => {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const label = t(method.labelKey);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.segment, active && styles.segmentActive, hovered && !active && styles.segmentHovered]}
    >
      <Icon name={method.icon} size={iconSize.sm} color={active ? colors.primaryText : colors.textMuted} />
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
};

// How to log in: with an email and password, or with a phone number and PIN.
// The two ways are separate screens, so choosing the one you are not on opens
// it; the same control sits at the top of both so you can always switch back.
// `order` puts the way a page leads with first (sign up leads with the phone).
const AuthMethodTabs = ({ active, onSelect, order = ['email', 'phone'] }) => (
  <View style={styles.track} accessibilityRole="tablist">
    {order.map((key) => METHODS.find((method) => method.key === key)).map((method) => (
      <Segment key={method.key} method={method} active={method.key === active} onPress={() => method.key !== active && onSelect(method.key)} />
    ))}
  </View>
);

const styles = themedStyles(() => ({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
    marginBottom: spacing.xl,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: { backgroundColor: colors.surface, borderColor: colors.border, ...shadow.level1 },
  segmentHovered: { backgroundColor: colors.divider },
  label: { ...type.smallMedium, color: colors.textMuted },
  labelActive: { color: colors.primaryText },
}));

export default AuthMethodTabs;
