import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../../theme/tokens';

// A quiet text link for the auth pages: optional leading icon, underlines on
// hover. `tone="muted"` is for the secondary links (admin access).
const AuthLink = ({ label, icon, onPress, tone = 'link', style, accessibilityLabel }) => {
  const [hovered, setHovered] = useState(false);
  const color = tone === 'muted' ? colors.textMuted : colors.textLink;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel || label}
      hitSlop={8}
      style={style}
    >
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={iconSize.sm} color={color} /> : null}
        <Text style={[styles.text, { color }, hovered && styles.hovered]}>{label}</Text>
      </View>
    </Pressable>
  );
};

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  text: { ...type.smallMedium },
  hovered: { textDecorationLine: 'underline' },
}));

export default AuthLink;
