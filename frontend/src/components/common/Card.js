import React, { useRef, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { colors, spacing, radius, shadow, motion, themedStyles } from '../../theme/tokens';

// A plain Card is a static surface. Passing `onPress` turns it into an
// interactive card with hover/press/focus feedback, for list rows that
// navigate somewhere (a load, a booking, a truck). `containerStyle` sizes the
// interactive card's outer wrapper, e.g. { flex: 1 } to fill a grid cell.
const Card = ({ children, style, containerStyle, onPress, accessibilityLabel, elevation = 'level1' }) => {
  if (!onPress) {
    return <View style={[styles.card, shadow[elevation], style]}>{children}</View>;
  }
  return (
    <InteractiveCard
      style={style}
      containerStyle={containerStyle}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      elevation={elevation}
    >
      {children}
    </InteractiveCard>
  );
};

// Split out so its hooks run on every render of this component. Calling them
// after Card's early return would change the hook order when `onPress` toggles.
const InteractiveCard = ({ children, style, containerStyle, onPress, accessibilityLabel, elevation }) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (toValue) => Animated.timing(scale, { toValue, duration: motion.fast, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
          shadow[hovered ? 'level2' : elevation],
          hovered && styles.hovered,
          focused && styles.focusRing,
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const styles = themedStyles(() => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
  },
  hovered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  focusRing: {
    borderWidth: 2,
    borderColor: colors.focusRing,
  },
}));

export default Card;
