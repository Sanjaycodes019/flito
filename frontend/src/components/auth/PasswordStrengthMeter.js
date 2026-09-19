import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, type } from '../../theme/tokens';

// Mirrors the server's actual floor (8+ characters, a letter and a digit,
// see backend/src/middleware/validators.js's isValidPassword) so a password
// this meter calls "Good" is never one the server then rejects. Length and
// character variety beyond that floor move it from "Good" to "Strong".
export const passwordScore = (password) => {
  if (!password) return 0;
  const meetsFloor = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  if (!meetsFloor) return 1; // "weak": entered something, but the server would reject it

  let score = 2; // "good": clears the server's actual minimum
  if (password.length >= 12) score += 1;
  const varietyCount = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (varietyCount >= 3) score += 1;
  return Math.min(score, 4);
};

const getLevels = (t) => ({
  0: { label: '', color: colors.border },
  1: { label: t('auth:passwordStrength.tooWeak'), color: colors.errorText },
  2: { label: t('auth:passwordStrength.good'), color: colors.warningText },
  3: { label: t('auth:passwordStrength.strong'), color: colors.successText },
  4: { label: t('auth:passwordStrength.veryStrong'), color: colors.successText },
});

const PasswordStrengthMeter = ({ password }) => {
  const { t } = useTranslation();
  const score = passwordScore(password);
  if (!password) return null;
  const level = getLevels(t)[score];

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.segment, { backgroundColor: step <= score ? level.color : colors.border }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: level.color }]}>{level.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: -spacing.sm, marginBottom: spacing.md },
  track: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  segment: { flex: 1, height: 4, borderRadius: radius.sm },
  label: { ...type.caption, textTransform: 'none', letterSpacing: 0 },
});

export default PasswordStrengthMeter;
