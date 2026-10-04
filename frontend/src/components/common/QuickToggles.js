import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';
import { setThemePreference } from '../../services/themePreference';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// Endonyms: a language's own name is never translated into the other one.
const LABELS = { en: 'EN', ne: 'ने' };
const ACCESSIBILITY_LABELS = { en: 'English', ne: 'नेपाली' };

// The language and the light/dark switch as one pill, for the header where
// space is tight. Each half shows what is on now and flips it on a tap:
// EN <-> ने on the left, sun <-> moon on the right. "Match device" stays in
// Settings > Appearance; a tap here picks light or dark outright.
const QuickToggles = ({ style }) => {
  const { t, i18n } = useTranslation();
  const { scheme } = useTheme();
  const language = i18n.language === 'ne' ? 'ne' : 'en';
  const nextLanguage = language === 'ne' ? 'en' : 'ne';
  const nextScheme = scheme === 'dark' ? 'light' : 'dark';

  const half = ({ pressed, hovered }) => [styles.half, hovered && styles.halfHovered, pressed && styles.halfPressed];

  return (
    <View style={[styles.track, style]}>
      <Pressable
        onPress={() => changeLanguage(nextLanguage)}
        accessibilityRole="button"
        accessibilityLabel={ACCESSIBILITY_LABELS[nextLanguage]}
        hitSlop={{ top: 6, bottom: 6, left: 6 }}
        style={half}
      >
        <Text style={styles.label}>{LABELS[language]}</Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        onPress={() => setThemePreference(nextScheme)}
        accessibilityRole="button"
        accessibilityLabel={t(`common:theme.${nextScheme}Long`)}
        hitSlop={{ top: 6, bottom: 6, right: 6 }}
        style={half}
      >
        <Icon
          name={scheme === 'dark' ? 'themeDark' : 'themeLight'}
          size={iconSize.sm}
          color={scheme === 'dark' ? colors.textPrimary : colors.primaryText}
        />
      </Pressable>
    </View>
  );
};

const styles = themedStyles(() => ({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    padding: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  half: {
    height: '100%',
    minWidth: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfHovered: { backgroundColor: colors.surface },
  halfPressed: { backgroundColor: colors.surface, opacity: 0.8 },
  divider: { width: 1, height: 16, backgroundColor: colors.border },
  label: { ...type.smallMedium, color: colors.textPrimary },
}));

export default QuickToggles;
