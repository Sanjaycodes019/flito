import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FLITO_COLORS } from '../../utils/colors';

const VARIANTS = {
  primary: { backgroundColor: FLITO_COLORS.primary, color: '#FFF' },
  secondary: { backgroundColor: FLITO_COLORS.accent, color: '#FFF' },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: FLITO_COLORS.primary,
    color: FLITO_COLORS.primary,
  },
};

const Button = ({ title, onPress, variant = 'primary', disabled = false, loading = false, style }) => {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isDisabled ? '#CCC' : variantStyle.backgroundColor,
          borderWidth: variantStyle.borderWidth || 0,
          borderColor: variantStyle.borderColor,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.color} />
      ) : (
        <Text style={[styles.text, { color: variantStyle.color }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Button;
