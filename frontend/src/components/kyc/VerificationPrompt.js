import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

const STATUS_NOTE_KEY = {
  pending: 'kyc:verificationPrompt.notePending',
  rejected: 'kyc:verificationPrompt.noteRejected',
};

// Shown wherever an action needs a verified identity. Opens the verification
// screen in the Profile tab, keeping Profile underneath it for the back button.
const VerificationPrompt = ({ kycStatus, message }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const underReview = kycStatus === 'pending';
  const noteKey = STATUS_NOTE_KEY[kycStatus];

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Icon name={underReview ? 'pending' : 'unverified'} size={iconSize.md} color={colors.warningText} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{t('kyc:verificationPrompt.title')}</Text>
          <Text style={styles.message}>{message}</Text>
          {!!noteKey && <Text style={styles.note}>{t(noteKey)}</Text>}
        </View>
      </View>
      <Button
        title={underReview ? t('kyc:verificationPrompt.viewVerification') : t('kyc:verificationPrompt.verifyIdentity')}
        variant={underReview ? 'tertiary' : 'primary'}
        icon={underReview ? 'time' : 'verified'}
        onPress={() => navigation.navigate('Profile', { screen: 'Kyc', initial: false })}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4, borderLeftColor: colors.warning },
  row: { flexDirection: 'row', marginBottom: spacing.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.warningMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  textCol: { flex: 1 },
  title: { ...type.bodyMedium, color: colors.textPrimary },
  message: { ...type.small, color: colors.textSecondary, marginTop: spacing.xxs },
  note: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
});

export default VerificationPrompt;
