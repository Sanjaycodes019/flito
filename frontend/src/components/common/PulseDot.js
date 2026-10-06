import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';
import { colors, themedStyles } from '../../theme/tokens';

// A small dot that sends out a ring, for something happening right now (a
// truck's position arriving live, a driver's phone sharing). `pulsing` off,
// or the phone set to reduce motion, leaves just the dot.
const PulseDot = ({ color = colors.success, size = 8, pulsing = true }) => {
  const ring = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((on) => { if (alive) setReduceMotion(!!on); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!pulsing || reduceMotion) return undefined;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [pulsing, reduceMotion, ring]);

  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  return (
    <View style={[styles.wrap, { width: size * 2.5, height: size * 2.5 }]}>
      {pulsing && !reduceMotion && (
        <Animated.View
          style={[
            dot,
            styles.ring,
            {
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
            },
          ]}
        />
      )}
      <View style={dot} />
    </View>
  );
};

const styles = themedStyles(() => ({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
}));

export default PulseDot;
