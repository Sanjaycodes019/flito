import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { THEME_PREFERENCES, setThemePreference, useThemePreference } from '../../services/themePreference';
import { colors, spacing, radius, type, themedStyles } from '../../theme/tokens';

// A small System / Light / Dark segmented switch for the app's appearance.
// The choice is global and remembered on the device.
const ThemeToggle = ({ compact = false, style }) => {
  const { t } = useTranslation();
  const current = useThemePreference();

  return (
    <View style={[styles.track, style]} accessibilityRole="radiogroup" accessibilityLabel={t('common:theme.label')}>
      {THEME_PREFERENCES.map((preference) => {
        const active = current === preference;
        return (
          <Pressable
            key={preference}
            onPress={() => setThemePreference(preference)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`common:theme.${preference}Long`)}
            style={({ pressed }) => [styles.segment, compact && styles.segmentCompact, active && styles.segmentActive, pressed && !active && styles.segmentPressed]}
          >
            <Text style={[styles.text, compact && styles.textCompact, active && styles.textActive]}>{t(`common:theme.${preference}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = themedStyles(() => ({
  track: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 2, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, minWidth: 40, alignItems: 'center' },
  segmentCompact: { paddingHorizontal: spacing.sm, paddingVertical: 2, minWidth: 34 },
  segmentActive: { backgroundColor: colors.surface },
  segmentPressed: { opacity: 0.7 },
  text: { ...type.bodyMedium, color: colors.textMuted },
  textCompact: { ...type.small },
  textActive: { color: colors.textPrimary },
}));

export default ThemeToggle;
