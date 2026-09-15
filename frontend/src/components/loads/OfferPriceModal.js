import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { colors, spacing, type } from '../../theme/tokens';
import { formatCurrency, truckTypeLabel } from '../../utils/helpers';

const MIN_PRICE = 100;

// A shipper names their own price for a matched truck.
const OfferPriceModal = ({ visible, match, sending, onClose, onSend }) => {
  const [price, setPrice] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setPrice('');
      setError(null);
    }
  }, [visible, match]);

  if (!match) return null;

  const submit = () => {
    if (!/^\d+$/.test(price.trim()) || Number(price) < MIN_PRICE) {
      setError(`Enter a whole number of rupees, at least ${formatCurrency(MIN_PRICE)}`);
      return;
    }
    onSend(Number(price));
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Make an Offer"
      focusCloseOnOpen={false}
      footer={(
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Send Offer" icon="send" onPress={submit} loading={sending} />
        </>
      )}
    >
      <Text style={styles.truck}>{`${truckTypeLabel(match.truck.truckType)} from ${match.owner.name}`}</Text>
      <Text style={styles.context}>
        {match.askingPrice != null
          ? `The owner's rates come to ${formatCurrency(match.askingPrice)} for this trip.`
          : "This owner hasn't listed a rate, so name the price you want to pay."}
      </Text>
      <Input
        label="Your Price (Rs.)"
        value={price}
        onChangeText={(value) => { setPrice(value); setError(null); }}
        keyboardType="numeric"
        placeholder={match.askingPrice != null ? String(match.askingPrice) : 'e.g. 15000'}
        icon="price"
        error={error}
        helperText="The owner can accept, counter or decline. If they accept, your load is booked at this price."
        autoFocus
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  truck: { ...type.bodyMedium, color: colors.textPrimary },
  context: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs, marginBottom: spacing.lg },
});

export default OfferPriceModal;
