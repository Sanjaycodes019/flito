import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors, getScheme } from '../../theme/tokens';

// Soft brand light behind a hero: Freight Amber from the top right, where the
// example card sits, and a little Velocity Teal from the bottom left. Purely
// decoration, so it is hidden from screen readers and never takes a tap.
const HeroGlow = ({ style }) => {
  const dark = getScheme() === 'dark';
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="flitoHeroAmber" cx="82" cy="30" r="58" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={dark ? 0.16 : 0.2} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="flitoHeroTeal" cx="6" cy="100" r="45" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#flitoHeroAmber)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#flitoHeroTeal)" />
      </Svg>
    </View>
  );
};

export default HeroGlow;
