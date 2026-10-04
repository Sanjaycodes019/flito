import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import { colors, spacing, type, themedStyles } from '../../../theme/tokens';
import { getErrorMessage } from '../../../utils/helpers';

// Mirrors the server: a reason someone will read has to say something.
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

// Asks for a reason before an action that affects someone (revoking a
// verification, cancelling a booking, suspending an account), then runs it.
// With `required` off the reason is an optional note for the record. A
// failure is shown in the dialog, which stays open so nothing typed is lost.
//
//   <ReasonModal visible={open} title="Remove verification?" message="..."
//     confirmLabel="Remove" destructive required
//     onConfirm={(reason) => api.post(...)} onClose={() => setOpen(false)} />
const ReasonModal = ({
  visible, title, message, confirmLabel, placeholder, destructive = false, required = true, onConfirm, onClose,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
    }
  }, [visible]);

  const trimmed = reason.trim();
  const tooShort = required && trimmed.length < MIN_REASON_LENGTH;

  const submit = async () => {
    if (tooShort) {
      setError(t('admin:reasonModal.tooShort', { min: MIN_REASON_LENGTH }));
      return;
    }
    setBusy(true);
    try {
      await onConfirm(trimmed);
      setBusy(false);
      onClose();
    } catch (err) {
      setBusy(false);
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={busy ? undefined : onClose}
      title={title}
      focusCloseOnOpen={false}
      footer={(
        <>
          <Button title={t('common:actions.cancel')} variant="ghost" onPress={onClose} disabled={busy} />
          <Button title={confirmLabel} variant={destructive ? 'destructive' : 'primary'} onPress={submit} loading={busy} disabled={required && !trimmed} />
        </>
      )}
    >
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Input
        label={required ? t('admin:reasonModal.reasonLabel') : t('admin:reasonModal.noteLabel')}
        value={reason}
        onChangeText={(value) => { setReason(value); setError(null); }}
        placeholder={placeholder || t('admin:reasonModal.placeholder')}
        multiline
        maxLength={MAX_REASON_LENGTH}
        error={error}
        helperText={required ? t('admin:reasonModal.helper') : t('admin:reasonModal.noteHelper')}
        autoFocus
        style={styles.input}
      />
    </Modal>
  );
};

const styles = themedStyles(() => ({
  message: { ...type.body, color: colors.textSecondary, marginBottom: spacing.lg },
  input: { minHeight: 96, textAlignVertical: 'top' },
}));

export default ReasonModal;
