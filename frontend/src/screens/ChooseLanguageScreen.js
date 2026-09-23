import React, { useState } from 'react';
import { Text, Pressable, View } from 'react-native';
import AuthLayout from '../components/auth/AuthLayout';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../theme/tokens';
import { changeLanguage } from '../i18n';

// Each language is written in itself and never translated, so the page
// reads the same whichever language the app happens to be showing.
const CHOICES = [
  { lng: 'ne', label: 'नेपाली', hint: 'नेपालीमा चलाउनुहोस्' },
  { lng: 'en', label: 'English', hint: 'Use the app in English' },
];

// The first screen on a new device: one tap picks the language, then Log In.
// It can be changed later in Settings.
const ChooseLanguageScreen = ({ navigation }) => {
  const [busy, setBusy] = useState(null);

  const choose = async (lng) => {
    setBusy(lng);
    await changeLanguage(lng);
    navigation.replace('Login');
  };

  return (
    <AuthLayout title="भाषा छान्नुहोस्" subtitle="Choose your language">
      {CHOICES.map(({ lng, label, hint }) => (
        <Pressable
          key={lng}
          onPress={() => choose(lng)}
          disabled={Boolean(busy)}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
        >
          <View style={styles.choiceText}>
            <Text style={styles.label} lang={lng}>{label}</Text>
            <Text style={styles.hint} lang={lng}>{hint}</Text>
          </View>
          <Icon name="forward" size={iconSize.lg} color={colors.primaryText} />
        </Pressable>
      ))}
    </AuthLayout>
  );
};

const styles = themedStyles(() => ({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primaryText,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  choicePressed: { backgroundColor: colors.primaryMuted },
  choiceText: { flex: 1 },
  label: { ...type.h1, color: colors.textPrimary },
  hint: { ...type.body, color: colors.textSecondary, marginTop: spacing.xxs },
}));

export default ChooseLanguageScreen;
