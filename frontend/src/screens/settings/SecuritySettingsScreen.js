import React from 'react';
import { ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { SettingsSection, SettingsRow } from '../../components/common/SettingsList';
import useLogout from '../../hooks/useLogout';
import useScreenLayout from '../../hooks/useScreenLayout';
import { colors, themedStyles } from '../../theme/tokens';

const SecuritySettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const layout = useScreenLayout('narrow');
  const handleLogout = useLogout();

  const methods = [user?.hasPassword && t('profile:rows.signInEmailPassword'), user?.hasGoogle && t('profile:rows.signInGoogle')]
    .filter(Boolean)
    .join(t('profile:rows.signInJoiner')) || t('profile:rows.signInEmailOnly');

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      <SettingsSection title={t('profile:settings.security.methodsTitle')}>
        <SettingsRow icon="lock" label={t('profile:rows.signInMethod')} value={methods} />
      </SettingsSection>

      {user?.email ? (
        <SettingsSection title={t('profile:settings.security.emailTitle')} description={t('profile:settings.security.emailHint')}>
          <SettingsRow
            icon="email"
            label={t('profile:rows.email')}
            value={user.email}
            pill={user.emailVerified ? { label: t('profile:rows.verified'), tone: 'success' } : { label: t('profile:rows.notVerified'), tone: 'warning' }}
            onPress={user.emailVerified ? undefined : () => navigation.navigate('VerifyEmail')}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={t('profile:settings.security.sessionTitle')}>
        <SettingsRow icon="logout" label={t('profile:rows.logOut')} destructive onPress={handleLogout} accessibilityLabel={t('profile:rows.logOutLabel')} />
      </SettingsSection>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
}));

export default SecuritySettingsScreen;
