import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';
import { formatCurrency, truckTypeLabel } from '../../utils/helpers';

const MIN_PRICE = 100;

// A shipper names their own price for a matched truck.
const OfferPriceModal = ({ visible, match, sending, onClose, onSend }) => {
  const { t } = useTranslation();
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
      setError(t('loads:offerModal.invalidPrice', { min: formatCurrency(MIN_PRICE) }));
      return;
    }
    onSend(Number(price));
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t('loads:offerModal.title')}
      focusCloseOnOpen={false}
      footer={(
        <>
          <Button title={t('common:actions.cancel')} variant="ghost" onPress={onClose} />
          <Button title={t('loads:offerModal.sendOffer')} icon="send" onPress={submit} loading={sending} />
        </>
      )}
    >
      <Text style={styles.truck}>
        {t('loads:offerModal.truckFromOwner', { truckType: truckTypeLabel(match.truck.truckType, t), owner: match.owner.name })}
      </Text>
      <Text style={styles.context}>
        {match.askingPrice != null
          ? t('loads:offerModal.ownerRatesContext', { price: formatCurrency(match.askingPrice) })
          : t('loads:offerModal.noRateContext')}
      </Text>
      <Input
        label={t('loads:offerModal.priceLabel')}
        value={price}
        onChangeText={(value) => { setPrice(value); setError(null); }}
        keyboardType="numeric"
        placeholder={match.askingPrice != null ? String(match.askingPrice) : t('loads:offerModal.pricePlaceholder')}
        icon="price"
        error={error}
        helperText={t('loads:offerModal.priceHelperText')}
        autoFocus
      />
    </Modal>
  );
};

const styles = themedStyles(() => ({
  truck: { ...type.bodyMedium, color: colors.textPrimary },
  context: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs, marginBottom: spacing.lg },
}));

export default OfferPriceModal;
