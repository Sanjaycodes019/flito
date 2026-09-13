import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import PhotoStrip from '../common/PhotoStrip';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize } from '../../theme/tokens';
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
      <View style={styles.titleRow}>
        <Icon name="camera" size={iconSize.md} color={colors.primaryText} style={styles.titleIcon} />
        <Text style={styles.title}>Proof of Delivery{photos.length ? ` (${photos.length})` : ''}</Text>
      </View>

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
          icon="camera"
          onPress={handleAdd}
          loading={busy}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  titleIcon: { marginRight: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginVertical: spacing.sm },
});

export default DeliveryProofSection;
