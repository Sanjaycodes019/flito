import React, { useState } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import PhotoStrip from '../common/PhotoStrip';
import { FLITO_COLORS } from '../../utils/colors';
import { MAX_DELIVERY_PHOTOS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import { pickImages, uploadPhotos } from '../../services/uploads';

// Shown to every party once proof exists; only the assigned driver can add it.
const DeliveryProofSection = ({ booking, canUpload, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const photos = booking.deliveryPhotos || [];

  if (!photos.length && !canUpload) return null;

  const remaining = MAX_DELIVERY_PHOTOS - photos.length;

  const handleAdd = async () => {
    setBusy(true);
    try {
      const assets = await pickImages({ max: remaining, camera: true });
      if (assets.length) {
        await uploadPhotos(`/bookings/${booking._id}/delivery-proof`, assets);
        await onChanged();
      }
    } catch (error) {
      notify('Upload failed', getErrorMessage(error));
    }
    setBusy(false);
  };

  return (
    <Card>
      <Text style={styles.title}>Proof of Delivery{photos.length ? ` (${photos.length})` : ''}</Text>

      {photos.length ? (
        <PhotoStrip photos={photos} />
      ) : (
        <Text style={styles.hint}>
          Photograph the cargo at drop-off. It protects you if the delivery is ever disputed.
        </Text>
      )}

      {canUpload && remaining > 0 && (
        <Button
          title={Platform.OS === 'web' ? 'Add Photo' : 'Take Photo'}
          onPress={handleAdd}
          loading={busy}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginBottom: 4 },
  hint: { fontSize: 13, color: FLITO_COLORS.textMuted, marginVertical: 6 },
});

export default DeliveryProofSection;
