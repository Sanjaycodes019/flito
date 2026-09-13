import React, { useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, radius, type } from '../../theme/tokens';

// A six-box OTP field. Controlled: `value` is the digit string typed so
// far, `onChange` receives the full updated string on every keystroke,
// including a pasted code landing across every box at once.
const OtpInput = ({ length = 6, value = '', onChange, error, editable = true, autoFocus = true }) => {
  const inputs = useRef([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const setDigit = (index, text) => {
    // A paste (or autofill) can deliver more than one character at once;
    // spread it across this box and the following ones.
    const clean = text.replace(/[^0-9]/g, '');
    if (!clean) {
      onChange(value.slice(0, index));
      return;
    }
    const next = (value.slice(0, index) + clean).slice(0, length);
    onChange(next);
    const landingIndex = Math.min(next.length, length - 1);
    inputs.current[landingIndex]?.focus();
  };

  const handleKeyPress = (index, event) => {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      onChange(value.slice(0, index - 1));
    }
  };

  return (
    <View>
      <View style={styles.row}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(el) => { inputs.current[index] = el; }}
            value={digit}
            onChangeText={(text) => setDigit(index, text)}
            onKeyPress={(e) => handleKeyPress(index, e)}
            keyboardType="number-pad"
            maxLength={length} // allows the whole pasted code to land in one box
            editable={editable}
            autoFocus={autoFocus && index === 0}
            style={[
              styles.box,
              digit && styles.boxFilled,
              error && styles.boxError,
              !editable && styles.boxDisabled,
            ]}
            accessibilityLabel={`Digit ${index + 1} of ${length}`}
            textContentType="oneTimeCode"
            selectTextOnFocus
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: 44,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    ...type.h2,
    color: colors.textPrimary,
  },
  boxFilled: { borderColor: colors.accent },
  boxError: { borderColor: colors.error },
  boxDisabled: { backgroundColor: colors.surfaceMuted, color: colors.disabledText },
});

export default OtpInput;
