import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import OptionList from '../../components/common/OptionList';
import { THEME_PREFERENCES, setThemePreference, useThemePreference } from '../../services/themePreference';
import useScreenLayout from '../../hooks/useScreenLayout';
import { colors, themedStyles } from '../../theme/tokens';

const AppearanceSettingsScreen = () => {
  const { t } = useTranslation();
  const preference = useThemePreference();
  const layout = useScreenLayout('narrow');

  const options = THEME_PREFERENCES.map((value) => ({
    value,
    label: t(`profile:settings.appearance.${value}`),
    description: t(`profile:settings.appearance.${value}Hint`),
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      <OptionList
        title={t('profile:settings.appearance.title')}
        hint={t('profile:settings.appearance.hint')}
        options={options}
        value={preference}
        onChange={setThemePreference}
      />
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
}));

export default AppearanceSettingsScreen;
