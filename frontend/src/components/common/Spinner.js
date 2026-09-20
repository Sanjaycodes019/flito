import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors, themedStyles } from '../../theme/tokens';

const Spinner = ({ size = 'large', color = colors.primary, style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size={size} color={color} />
  </View>
);

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export default Spinner;
