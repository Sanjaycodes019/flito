import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, themedStyles } from '../../theme/tokens';

// The Home screen's way in: one big, whole-tile button per thing you can do,
// a picture, a two-word name, and (optionally) a number that says how much is
// waiting. No paragraphs to read. `primary` is the main job of the role and
// spans the full row.
const ActionTile = ({ icon, title, badge, value, detail, primary = false, onPress, accessibilityLabel }) => {
  const [hovered, setHovered] = useState(false);
  const hasBadge = badge != null && badge !== 0 && badge !== '0';
  const ink = primary ? colors.textOnPrimary : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (hasBadge ? `${title}, ${badge}` : title)}
      style={({ pressed }) => [
        styles.tile,
        primary ? styles.tilePrimary : styles.tilePlain,
        (hovered || pressed) && (primary ? styles.primaryActive : styles.plainActive),
      ]}
    >
      <View style={[styles.iconWrap, primary && styles.iconWrapPrimary]}>
        <Icon name={icon} size={primary ? 30 : 26} color={primary ? colors.textOnPrimary : colors.primaryText} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: ink }]} numberOfLines={2}>{title}</Text>
        {value != null && <Text style={[styles.value, { color: ink }]}>{value}</Text>}
        {!!detail && <Text style={[styles.detail, { color: ink }]} numberOfLines={2}>{detail}</Text>}
      </View>
      {hasBadge && (
        <View style={[styles.badge, primary && styles.badgePrimary]}>
          <Text style={[styles.badgeText, primary && styles.badgeTextPrimary]}>{badge}</Text>
        </View>
      )}
      <Icon name="forward" size={20} color={primary ? colors.textOnPrimary : colors.textMuted} />
    </Pressable>
  );
};

const styles = themedStyles(() => ({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  tilePlain: { backgroundColor: colors.surface, ...shadow.level1 },
  tilePrimary: { backgroundColor: colors.primary, ...shadow.level2 },
  plainActive: { backgroundColor: colors.surfaceMuted },
  primaryActive: { backgroundColor: colors.primaryPressed },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrimary: { backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.h3 },
  value: { ...type.h2, marginTop: 2 },
  detail: { ...type.body, marginTop: 2 },

  badge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePrimary: { backgroundColor: colors.textOnPrimary },
  badgeText: { ...type.smallMedium, color: colors.textOnPrimary },
  badgeTextPrimary: { color: colors.primary },
}));

export default ActionTile;
