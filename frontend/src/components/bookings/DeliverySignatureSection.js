import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import SignaturePad from '../signature/SignaturePad';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import { assetFromDataUrl, uploadFiles } from '../../services/uploads';

// Shown alongside DeliveryProofSection for the same eligibility window; only
// the assigned driver captures it, and capturing again replaces the prior one.
const DeliverySignatureSection = ({ booking, canUpload, onChanged }) => {
  const { t } = useTranslation();
  const [padVisible, setPadVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const signature = booking.deliverySignature;

  if (!signature?.url && !canUpload) return null;

  const handleSave = async (dataUrl) => {
    setSaving(true);
    try {
      const asset = await assetFromDataUrl(dataUrl);
      await uploadFiles(`/bookings/${booking._id}/signature`, [asset], { field: 'signature' });
      setPadVisible(false);
      await onChanged();
    } catch (error) {
      notify(t('bookings:deliverySignature.saveFailedTitle'), getErrorMessage(error));
    }
    setSaving(false);
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name="signature" size={iconSize.md} color={colors.primaryText} style={styles.titleIcon} />
        <Text style={styles.title}>{t('bookings:deliverySignature.title')}</Text>
      </View>

      {signature?.url ? (
        <View style={styles.preview}>
          <Image source={{ uri: signature.url }} style={styles.signatureImage} resizeMode="contain" />
          {signature.capturedAt && <Text style={styles.meta}>{t('bookings:deliverySignature.signedMeta', { date: formatDate(signature.capturedAt) })}</Text>}
        </View>
      ) : (
        <Text style={styles.hint}>{t('bookings:deliverySignature.hint')}</Text>
      )}

      {canUpload && (
        <Button
          title={signature?.url ? t('bookings:deliverySignature.recapture') : t('bookings:deliverySignature.capture')}
          icon="signature"
          variant={signature?.url ? 'tertiary' : 'primary'}
          onPress={() => setPadVisible(true)}
        />
      )}

      <SignaturePad visible={padVisible} onClose={() => setPadVisible(false)} onSave={handleSave} saving={saving} />
    </Card>
  );
};

const styles = themedStyles(() => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  titleIcon: { marginRight: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginVertical: spacing.sm },
  preview: { alignItems: 'center', marginVertical: spacing.sm },
  signatureImage: { width: '100%', height: 120, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.divider },
  meta: { ...type.small, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
}));

export default DeliverySignatureSection;
