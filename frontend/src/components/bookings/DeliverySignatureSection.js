import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import SignaturePad from '../signature/SignaturePad';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import { assetFromDataUrl, uploadFiles } from '../../services/uploads';

// Shown alongside DeliveryProofSection for the same eligibility window; only
// the assigned driver captures it, and capturing again replaces the prior one.
const DeliverySignatureSection = ({ booking, canUpload, onChanged }) => {
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
      notify('Could not save signature', getErrorMessage(error));
    }
    setSaving(false);
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name="signature" size={iconSize.md} color={colors.primary} style={styles.titleIcon} />
        <Text style={styles.title}>Delivery Signature</Text>
      </View>

      {signature?.url ? (
        <View style={styles.preview}>
          <Image source={{ uri: signature.url }} style={styles.signatureImage} resizeMode="contain" />
          {signature.capturedAt && <Text style={styles.meta}>Signed {formatDate(signature.capturedAt)}</Text>}
        </View>
      ) : (
        <Text style={styles.hint}>Have the recipient sign to confirm they received the delivery.</Text>
      )}

      {canUpload && (
        <Button
          title={signature?.url ? 'Recapture Signature' : 'Capture Signature'}
          icon="signature"
          variant={signature?.url ? 'tertiary' : 'primary'}
          onPress={() => setPadVisible(true)}
        />
      )}

      <SignaturePad visible={padVisible} onClose={() => setPadVisible(false)} onSave={handleSave} saving={saving} />
    </Card>
  );
};

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  titleIcon: { marginRight: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginVertical: spacing.sm },
  preview: { alignItems: 'center', marginVertical: spacing.sm },
  signatureImage: { width: '100%', height: 120, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.divider },
  meta: { ...type.small, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});

export default DeliverySignatureSection;
