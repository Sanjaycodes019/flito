import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

const STATUS_NOTE = {
  pending: 'Your documents are under review.',
  rejected: 'Your documents need changes before they can be approved.',
};

// Shown wherever an action needs a verified identity. Opens the verification
// screen in the Profile tab, keeping Profile underneath it for the back button.
const VerificationPrompt = ({ kycStatus, message }) => {
  const navigation = useNavigation();
  const underReview = kycStatus === 'pending';
  const note = STATUS_NOTE[kycStatus];

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Icon name={underReview ? 'pending' : 'unverified'} size={iconSize.md} color={colors.warningText} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>Identity verification required</Text>
          <Text style={styles.message}>{message}</Text>
          {!!note && <Text style={styles.note}>{note}</Text>}
        </View>
      </View>
      <Button
        title={underReview ? 'View Verification' : 'Verify Identity'}
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
