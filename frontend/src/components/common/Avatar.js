import React from 'react';
import { View, Image } from 'react-native';
import Icon from '../../theme/icons';
import { colors, themedStyles } from '../../theme/tokens';

const ROLE_ICON = {
  shipper: 'shipper',
  owner: 'owner',
  driver: 'driver',
  admin: 'admin',
};

// A user's profile photo in a circle, or their role icon on the brand's dark
// tone when they haven't added one, so every account has a recognizable mark.
const Avatar = ({ uri, role, size = 48, style, accessibilityLabel }) => {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityLabel }
    : { accessible: false };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, frame, style]} resizeMode="cover" {...a11y} />;
  }

  return (
    <View style={[styles.fallback, frame, style]} {...a11y}>
      <Icon name={ROLE_ICON[role] || 'person'} size={Math.round(size * 0.46)} color={colors.textOnDark} />
    </View>
  );
};

const styles = themedStyles(() => ({
  image: { backgroundColor: colors.surfaceMuted },
  fallback: { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
}));

export default Avatar;
