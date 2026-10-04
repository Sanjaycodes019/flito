import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors } from '../../theme/tokens';

// Background art for page heroes: a hill ridge (the shape of the road north
// from the Terai) and two dashed routes ending in pickup and drop-off pins.
// Drawn in the brand amber and teal at low strength, behind the text, and
// hidden from screen readers. `variant="dark"` is for the Deep Asphalt band.
const RouteArt = ({ variant = 'light', style }) => {
  const ink = variant === 'dark' ? colors.textInverse : colors.textPrimary;
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMax slice">
        <Path
          d="M0 420 L0 330 L90 300 L150 318 L240 250 L300 282 L380 210 L450 250 L540 170 L610 222 L700 150 L770 196 L860 120 L930 172 L1010 104 L1090 160 L1200 112 L1200 420 Z"
          fill={ink}
          fillOpacity={variant === 'dark' ? 0.05 : 0.035}
        />
        <Path
          d="M0 420 L0 372 L120 344 L210 360 L320 312 L420 338 L520 290 L640 318 L760 268 L880 300 L1000 250 L1100 282 L1200 246 L1200 420 Z"
          fill={ink}
          fillOpacity={variant === 'dark' ? 0.06 : 0.04}
        />
        <G fill="none" strokeLinecap="round">
          <Path d="M620 400 C 720 360, 760 300, 860 300 S 1010 250, 1060 170" stroke={colors.primary} strokeOpacity={0.55} strokeWidth={4} strokeDasharray="2 14" />
          <Path d="M520 420 C 640 330, 700 380, 820 340 S 980 320, 1140 260" stroke={colors.accent} strokeOpacity={0.4} strokeWidth={3} strokeDasharray="10 12" />
        </G>
        <Circle cx={1060} cy={170} r={14} fill={colors.primary} fillOpacity={0.22} />
        <Circle cx={1060} cy={170} r={6} fill={colors.primary} />
        <Circle cx={1140} cy={260} r={12} fill={colors.accent} fillOpacity={0.22} />
        <Circle cx={1140} cy={260} r={5} fill={colors.accent} />
      </Svg>
    </View>
  );
};

export default RouteArt;
