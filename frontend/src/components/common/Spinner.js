import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { FLITO_COLORS } from '../../utils/colors';

const Spinner = ({ size = 'large', color = FLITO_COLORS.primary, style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Spinner;
