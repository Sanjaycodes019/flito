import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../../i18n';
import { colors, spacing, radius, type, themedStyles } from '../../theme/tokens';

// Endonyms: a language's own name is never translated into the other one.
const LABELS = { en: 'EN', ne: 'ने' };
const ACCESSIBILITY_LABELS = { en: 'English', ne: 'नेपाली' };

// A small EN / ने segmented switch. `compact` shrinks it for tight spots like
// the auth screens' header; the full size is used in Profile settings.
const LanguageToggle = ({ compact = false, style }) => {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <View style={[styles.track, compact && styles.trackCompact, style]} accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <Pressable
            key={lng}
            onPress={() => changeLanguage(lng)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={ACCESSIBILITY_LABELS[lng]}
            style={({ pressed }) => [
              styles.segment,
              compact && styles.segmentCompact,
              active && styles.segmentActive,
              pressed && !active && styles.segmentPressed,
            ]}
          >
            <Text style={[styles.segmentText, compact && styles.segmentTextCompact, active && styles.segmentTextActive]}>
              {LABELS[lng]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = themedStyles(() => ({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 3,
    alignSelf: 'flex-start',
  },
  trackCompact: { padding: 2 },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minWidth: 40,
    alignItems: 'center',
  },
  segmentCompact: { paddingHorizontal: spacing.sm, paddingVertical: 4, minWidth: 32 },
  segmentActive: { backgroundColor: colors.surface },
  segmentPressed: { opacity: 0.7 },
  segmentText: { ...type.bodyMedium, color: colors.textMuted },
  segmentTextCompact: { ...type.small },
  segmentTextActive: { color: colors.textPrimary },
}));

export default LanguageToggle;
