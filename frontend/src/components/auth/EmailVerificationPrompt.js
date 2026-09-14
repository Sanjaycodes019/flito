import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

// Shown on Home for any signed-in user whose email is not yet verified.
// Unlike KYC (which only owners/drivers need, to make or accept offers),
// this applies to every role, since email is how everyone logs back in and
// how a password reset actually reaches them.
const EmailVerificationPrompt = ({ email }) => {
  const navigation = useNavigation();

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Icon name="unverified" size={iconSize.md} color={colors.warningText} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.message}>Confirm {email} so you can always get back into your account.</Text>
        </View>
      </View>
      <Button
        title="Verify Now"
        icon="checkmark"
        variant="tertiary"
        onPress={() => navigation.navigate('Profile', { screen: 'VerifyEmail', initial: false })}
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
});

export default EmailVerificationPrompt;
