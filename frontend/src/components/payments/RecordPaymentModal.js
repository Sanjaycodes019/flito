import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import BankLogo from './BankLogo';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { methodTitle } from '../../utils/banks';
import { formatCurrency, getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import { pickImages } from '../../services/uploads';

const CASH = 'cash';

// One choice of where the money went: one of the accounts, or cash.
const DestinationRow = ({ method, label, hint, selected, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={label}
    style={({ pressed }) => [styles.destination, selected && styles.destinationSelected, pressed && styles.pressed]}
  >
    {method
      ? <BankLogo kind={method.kind} bankCode={method.bankCode} size={30} />
      : <View style={styles.cashGlyph}><Icon name="cash" size={20} color={colors.successText} /></View>}
    <View style={styles.destinationText}>
      <Text style={styles.destinationLabel}>{label}</Text>
      {hint ? <Text style={styles.destinationHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
    <Icon name={selected ? 'radioOn' : 'radioOff'} size={iconSize.md} color={selected ? colors.primaryText : colors.textMuted} />
  </Pressable>
);

// Recording a payment: how much, where it went (one of the accounts in
// `payTo`, or cash), its transaction ID and, with `withProof`, a screenshot.
// Used for a shipper paying an owner, an owner recording money received, and
// an owner paying FLITO's fees. `onSubmit(fields, proof)` should handle its
// own errors.
const RecordPaymentModal = ({
  visible, title, destinationLabel, payTo, due, withProof = false, onClose, onSubmit,
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState(CASH);
  const [transactionId, setTransactionId] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmount(due ? String(due) : '');
    setDestination(payTo[0]?._id || CASH);
    setTransactionId('');
    setNote('');
    setProof(null);
  }, [visible, due, payTo]);

  const chooseProof = async () => {
    try {
      const [asset] = await pickImages({ max: 1 });
      if (asset) setProof(asset);
    } catch (error) {
      notify(t('payments:form.photoFailed'), getErrorMessage(error));
    }
  };

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) {
      notify(t('payments:form.missingTitle'), t('payments:report.badAmount'));
      return;
    }
    const account = payTo.find((method) => method._id === destination);
    setSaving(true);
    await onSubmit({
      amount: value,
      method: account ? account.kind : CASH,
      payoutMethodId: account?._id,
      transactionId: account ? transactionId.trim() || undefined : undefined,
      note: note.trim() || undefined,
    }, proof);
    setSaving(false);
  };

  const isCash = destination === CASH;
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnBackdrop={false}
      title={title}
      footer={<Button title={t('payments:report.submit')} icon="checkmark" onPress={submit} loading={saving} style={styles.fill} />}
    >
      <Input
        label={t('payments:report.amount')}
        value={amount}
        onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        icon="price"
        helperText={t('payments:report.amountHint', { amount: formatCurrency(due) })}
        required
      />

      <Text style={styles.label}>{destinationLabel}</Text>
      <View style={styles.destinations} accessibilityRole="radiogroup">
        {payTo.map((method) => (
          <DestinationRow
            key={method._id}
            method={method}
            label={methodTitle(method)}
            hint={method.kind === 'bank' ? method.accountNumber || method.accountName : method.walletId}
            selected={destination === method._id}
            onPress={() => setDestination(method._id)}
          />
        ))}
        <DestinationRow
          label={t('payments:kinds.cash')}
          hint={t('payments:report.cashHint')}
          selected={isCash}
          onPress={() => setDestination(CASH)}
        />
      </View>

      {!isCash ? (
        <Input
          label={t('payments:report.reference')}
          helperText={t('payments:report.referenceHint')}
          value={transactionId}
          onChangeText={setTransactionId}
          icon="receipt"
          autoCapitalize="characters"
          autoCorrect={false}
        />
      ) : null}
      <Input label={t('payments:report.note')} value={note} onChangeText={setNote} icon="document" />

      {withProof && !isCash ? (
        <View>
          <Text style={styles.label}>{t('payments:report.screenshot')}</Text>
          <View style={styles.proofRow}>
            {proof ? <Image source={{ uri: proof.uri }} style={styles.proofThumb} accessibilityIgnoresInvertColors /> : null}
            <Button
              title={proof ? t('payments:report.changeScreenshot') : t('payments:report.addScreenshot')}
              icon="image"
              size="sm"
              variant="tertiary"
              onPress={chooseProof}
            />
          </View>
        </View>
      ) : null}
    </Modal>
  );
};

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  pressed: { opacity: 0.8 },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  destinations: { gap: spacing.xs, marginBottom: spacing.lg },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  destinationSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  cashGlyph: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.successMuted, alignItems: 'center', justifyContent: 'center',
  },
  destinationText: { flex: 1, minWidth: 0 },
  destinationLabel: { ...type.bodyMedium, color: colors.textPrimary },
  destinationHint: { ...type.small, color: colors.textMuted },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  proofThumb: { width: 56, height: 56, borderRadius: radius.sm },
}));

export default RecordPaymentModal;
