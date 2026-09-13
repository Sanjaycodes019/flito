import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../common/Card';
import Button from '../common/Button';
import { FLITO_COLORS } from '../../utils/colors';

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
      <Text style={styles.title}>Identity verification required</Text>
      <Text style={styles.message}>{message}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Button
        title={underReview ? 'View Verification' : 'Verify Identity'}
        variant={underReview ? 'outline' : 'primary'}
        onPress={() => navigation.navigate('Profile', { screen: 'Kyc', initial: false })}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4, borderLeftColor: FLITO_COLORS.warning },
  title: { fontSize: 15, fontWeight: '700', color: FLITO_COLORS.secondary },
  message: { fontSize: 13, color: FLITO_COLORS.secondary, marginTop: 4 },
  note: { fontSize: 12, color: FLITO_COLORS.textMuted, marginTop: 6 },
});

export default VerificationPrompt;
