import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import Icon from '../../theme/icons';

// The single text input used across every form in the app: label, optional
// leading icon, focus ring, inline error/helper text, and an optional
// trailing element (used for the password-style show/hide eye on the OTP
// field, or a unit suffix).
const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  icon,
  rightElement,
  required,
  editable = true,
  style,
  containerStyle,
  onBlur,
  onFocus,
  testID,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  const borderColor = hasError
    ? colors.error
    : focused
      ? colors.focusRing
      : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {!!label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.field,
          { borderColor, borderWidth: focused || hasError ? 2 : 1 },
          !editable && styles.fieldDisabled,
        ]}
      >
        {icon && <Icon name={icon} size={iconSize.md} color={hasError ? colors.error : colors.textMuted} style={styles.leadingIcon} />}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          style={[styles.input, !editable && styles.inputDisabled, style]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          accessibilityLabel={label}
          {...rest}
        />
        {rightElement}
      </View>

      {(hasError || helperText) && (
        <View style={styles.helperRow}>
          {hasError && <Icon name="error" size={iconSize.xs} color={colors.errorText} style={styles.helperIcon} />}
          <Text style={[styles.helperText, hasError && styles.errorText]}>
            {hasError ? error : helperText}
          </Text>
        </View>
      )}
    </View>
  );
};

// A small trailing icon button, used for password/OTP visibility toggles
// and other in-field actions.
export const InputAction = ({ icon, onPress, accessibilityLabel }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={8} style={styles.action}>
    <Icon name={icon} size={iconSize.md} color={colors.textMuted} />
  </Pressable>
);

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  required: { color: colors.errorText },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  fieldDisabled: { backgroundColor: colors.surfaceMuted },
  leadingIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    ...type.body,
    // 16px, not the 15px body size: iOS Safari zooms the whole page into any
    // focused field smaller than 16px, which breaks the layout on phones.
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  inputDisabled: { color: colors.disabledText },
  action: { paddingLeft: spacing.sm },
  helperRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  helperIcon: { marginRight: 4 },
  helperText: { ...type.small, color: colors.textMuted },
  errorText: { color: colors.errorText },
});

export default Input;
