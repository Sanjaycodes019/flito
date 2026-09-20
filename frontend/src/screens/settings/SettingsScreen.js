import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import Avatar from '../../components/common/Avatar';
import Card from '../../components/common/Card';
import VerifiedBadge from '../../components/common/VerifiedBadge';
import { SettingsSection, SettingsRow } from '../../components/common/SettingsList';
import Icon from '../../theme/icons';
import useLogout from '../../hooks/useLogout';
import useScreenLayout from '../../hooks/useScreenLayout';
import { useCalendar } from '../../services/calendarPreference';
import { useThemePreference } from '../../services/themePreference';
import { ROLES } from '../../utils/constants';
import { colors, spacing, type, iconSize, themedStyles } from '../../theme/tokens';

const APP_VERSION = Constants?.expoConfig?.version;

// The settings home: an account card that leads back to the profile, then
// groups of rows that each open their own page (or, for the small ones, show
// their current value).
const SettingsScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const layout = useScreenLayout('narrow');
  const calendar = useCalendar();
  const themePreference = useThemePreference();
  const handleLogout = useLogout();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const verifies = user?.role !== ROLES.ADMIN;
  const languageName = t(i18n.language === 'ne' ? 'common:language.nepali' : 'common:language.english');
  const languageValue = `${languageName} · ${t(`common:calendar.${calendar}`)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      <Card
        onPress={() => navigation.navigate('ProfileHome')}
        accessibilityLabel={t('profile:settings.viewProfile')}
        style={styles.accountCard}
        containerStyle={styles.accountWrap}
      >
        <Avatar uri={user?.avatarUrl} role={user?.role} size={56} />
        <View style={styles.accountText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{fullName || t('profile:summary.nameFallback')}</Text>
            {user?.kycStatus === 'approved' && <VerifiedBadge size={18} label={t('profile:summary.verifiedByFlito')} />}
          </View>
          <Text style={styles.subtle} numberOfLines={1}>{t('profile:settings.viewProfile')}</Text>
        </View>
        <Icon name="forward" size={iconSize.md} color={colors.textMuted} />
      </Card>

      <SettingsSection title={t('profile:settings.sections.account')}>
        <SettingsRow icon="person" label={t('profile:settings.rows.personalInfo')} onPress={() => navigation.navigate('EditProfile')} />
        <SettingsRow icon="location" label={t('profile:settings.rows.address')} onPress={() => navigation.navigate('Address')} />
        {verifies ? <SettingsRow icon="idCard" label={t('profile:settings.rows.identity')} onPress={() => navigation.navigate('Kyc')} /> : null}
      </SettingsSection>

      <SettingsSection title={t('profile:settings.sections.preferences')}>
        <SettingsRow icon="language" label={t('profile:settings.rows.languageRegion')} value={languageValue} onPress={() => navigation.navigate('LanguageSettings')} />
        <SettingsRow icon="appearance" label={t('profile:settings.rows.appearance')} value={t(`profile:settings.appearance.${themePreference}`)} onPress={() => navigation.navigate('AppearanceSettings')} />
        <SettingsRow icon="bell" label={t('profile:settings.rows.notifications')} onPress={() => navigation.navigate('HomeTab', { screen: 'Notifications' })} />
      </SettingsSection>

      <SettingsSection title={t('profile:settings.sections.security')}>
        <SettingsRow icon="lock" label={t('profile:settings.rows.signIn')} onPress={() => navigation.navigate('SecuritySettings')} />
      </SettingsSection>

      {!!APP_VERSION && (
        <SettingsSection title={t('profile:settings.sections.about')}>
          <SettingsRow icon="info" label={t('profile:settings.rows.version')} value={APP_VERSION} />
        </SettingsSection>
      )}

      <SettingsSection title={t('profile:logout.title')}>
        <SettingsRow icon="logout" label={t('profile:rows.logOut')} destructive onPress={handleLogout} accessibilityLabel={t('profile:rows.logOutLabel')} />
      </SettingsSection>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  accountWrap: { marginBottom: spacing.lg },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accountText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...type.h3, color: colors.textPrimary, flexShrink: 1 },
  subtle: { ...type.small, color: colors.textMuted, marginTop: 2 },
}));

export default SettingsScreen;
