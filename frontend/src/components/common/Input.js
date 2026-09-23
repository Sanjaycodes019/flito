import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import Icon from '../../theme/icons';

// On web the native <input> draws the browser's own focus outline inside the
// field, a second box on top of the field's teal focus ring. The ring is the
// one focus indicator, so the inner outline is switched off. `outlineStyle`
// isn't a style React Native validates, hence a plain object outside
// StyleSheet.create, which react-native-web passes straight to CSS.
export const webInputReset = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

const BORDER = 1;
const RING = 2;

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
  const ringed = focused || hasError;

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
          {
            borderColor,
            borderWidth: ringed ? RING : BORDER,
            // The thicker ring would push the icon and text inward by the
            // extra border width; taking it back out of the padding keeps
            // everything inside the field exactly where it was while typing.
            paddingHorizontal: spacing.md - (ringed ? RING - BORDER : 0),
          },
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
          style={[styles.input, webInputReset, !editable && styles.inputDisabled, style]}
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

const styles = themedStyles(() => ({
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
    // The body size (17px) also keeps iOS Safari from zooming the page into
    // the field, which it does for anything under 16px.
    ...type.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  inputDisabled: { color: colors.disabledText },
  action: { paddingLeft: spacing.sm },
  helperRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  helperIcon: { marginRight: 4 },
  helperText: { ...type.small, color: colors.textMuted },
  errorText: { color: colors.errorText },
}));

export default Input;
