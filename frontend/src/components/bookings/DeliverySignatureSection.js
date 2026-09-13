import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import SignaturePad from '../signature/SignaturePad';
import { FLITO_COLORS } from '../../utils/colors';
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
      <Text style={styles.title}>Delivery Signature</Text>

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
          variant={signature?.url ? 'outline' : 'primary'}
          onPress={() => setPadVisible(true)}
        />
      )}

      <SignaturePad visible={padVisible} onClose={() => setPadVisible(false)} onSave={handleSave} saving={saving} />
    </Card>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginBottom: 4 },
  hint: { fontSize: 13, color: FLITO_COLORS.textMuted, marginVertical: 6 },
  preview: { alignItems: 'center', marginVertical: 8 },
  signatureImage: { width: '100%', height: 120, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  meta: { fontSize: 11, color: FLITO_COLORS.textMuted, marginTop: 6 },
});

export default DeliverySignatureSection;
