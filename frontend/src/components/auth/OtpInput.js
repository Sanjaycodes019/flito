import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { webInputReset } from '../common/Input';
import { colors, spacing, radius, type } from '../../theme/tokens';

// A six-box OTP field. Controlled: `value` is the digit string typed so
// far, `onChange` receives the full updated string on every keystroke,
// including a pasted code landing across every box at once.
const OtpInput = ({ length = 6, value = '', onChange, error, editable = true, autoFocus = true }) => {
  const inputs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(null);

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
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
            keyboardType="number-pad"
            maxLength={length} // allows the whole pasted code to land in one box
            editable={editable}
            autoFocus={autoFocus && index === 0}
            // Same border width in every state (only the color changes), so a
            // box never resizes as focus moves along the row. The browser's
            // own outline is off; the colored border is the focus indicator.
            style={[
              styles.box,
              webInputReset,
              digit && styles.boxFilled,
              focusedIndex === index && styles.boxFocused,
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
  // Boxes share the row instead of a fixed 44px each: six fixed boxes plus
  // gaps (304px) overflowed the form on a 320px phone.
  box: {
    flex: 1,
    maxWidth: 52,
    minWidth: 0,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    ...type.h2,
    color: colors.textPrimary,
  },
  boxFilled: { borderColor: colors.accentText },
  // Listed after boxFilled so the box being typed in always shows the ring.
  boxFocused: { borderColor: colors.focusRing, backgroundColor: colors.surface },
  boxError: { borderColor: colors.error },
  boxDisabled: { backgroundColor: colors.surfaceMuted, color: colors.disabledText },
});

export default OtpInput;
