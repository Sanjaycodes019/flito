import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import OptionList from '../../components/common/OptionList';
import { changeLanguage } from '../../i18n';
import { CALENDARS, setCalendar, useCalendar } from '../../services/calendarPreference';
import useScreenLayout from '../../hooks/useScreenLayout';
import { colors, themedStyles } from '../../theme/tokens';

const LanguageSettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const calendar = useCalendar();
  const layout = useScreenLayout('narrow');

  // Endonyms: a language's own name is never translated.
  const languages = [
    { value: 'en', label: t('common:language.english') },
    { value: 'ne', label: t('common:language.nepali') },
  ];
  const calendars = CALENDARS.map((value) => ({ value, label: t(`common:calendar.${value}Long`) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      <OptionList
        title={t('profile:settings.language.title')}
        hint={t('profile:settings.language.hint')}
        options={languages}
        value={i18n.language}
        onChange={changeLanguage}
      />
      <OptionList
        title={t('profile:settings.language.calendarTitle')}
        hint={t('profile:settings.language.calendarHint')}
        options={calendars}
        value={calendar}
        onChange={setCalendar}
      />
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
}));

export default LanguageSettingsScreen;
