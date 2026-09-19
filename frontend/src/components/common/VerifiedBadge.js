import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/tokens';

// FLITO's verified mark: a rounded 12-point seal in the brand amber with a
// white tick, shown beside a person or a truck an admin has verified. Like the
// Google "G", it is a drawn mark rather than a glyph from the icon set, so its
// shape stays exactly as designed.

const POINTS = 12;
const OUTER_RADIUS = 10.2;
const INNER_RADIUS = 8.3;

// The seal's outline on a 24-unit square; the round stroke joins below soften
// each point.
const SEAL = `${Array.from({ length: POINTS * 2 }, (_, i) => {
  const angle = (Math.PI / POINTS) * i - Math.PI / 2;
  const radius = i % 2 === 0 ? OUTER_RADIUS : INNER_RADIUS;
  const x = (12 + radius * Math.cos(angle)).toFixed(2);
  const y = (12 + radius * Math.sin(angle)).toFixed(2);
  return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
}).join(' ')} Z`;

const TICK = 'M7.6 12.2 L10.5 15.1 L16.5 9';

const VerifiedBadge = ({ size = 18, label, style }) => {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? t('common:verifiedBadge.label')}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SEAL} fill={colors.primary} stroke={colors.primary} strokeWidth={2.2} strokeLinejoin="round" />
        <Path d={TICK} fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

export default VerifiedBadge;
