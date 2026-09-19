import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { spacing } from '../../theme/tokens';
import { getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';

// Mirrors the server: a rejection must tell the user what to fix.
const MIN_REASON_LENGTH = 5;

// Approve, or reject with a reason, for one item in a review queue. Keeps its
// own reason text and busy state, so a list of these needs no bookkeeping.
// `onDecide(decision, reason)` should return a promise; a failure is shown
// here.
const ReviewActions = ({ audience, onDecide }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision) => {
    setBusy(true);
    try {
      await onDecide(decision, reason.trim());
      setReason('');
    } catch (error) {
      notify(t('admin:common.error'), getErrorMessage(error));
    }
    setBusy(false);
  };

  return (
    <>
      <Input
        value={reason}
        onChangeText={setReason}
        placeholder={t('admin:review.reasonPlaceholder', { audience: t(`admin:review.audience.${audience}`) })}
        multiline
        icon="document"
        containerStyle={styles.reason}
      />
      <View style={styles.row}>
        <Button title={t('admin:review.approve')} icon="checkmark" onPress={() => decide('approved')} loading={busy} style={styles.button} />
        <Button
          title={t('admin:review.reject')}
          icon="close"
          variant="destructive"
          onPress={() => decide('rejected')}
          loading={busy}
          disabled={reason.trim().length < MIN_REASON_LENGTH}
          style={styles.button}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  reason: { marginTop: spacing.sm, marginBottom: 0 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1 },
});

export default ReviewActions;
