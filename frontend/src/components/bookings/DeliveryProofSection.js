import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import PhotoStrip from '../common/PhotoStrip';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize } from '../../theme/tokens';
import { MAX_DELIVERY_PHOTOS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import { takePhoto, uploadPhotos } from '../../services/uploads';

// Shown to every party once proof exists; only the assigned driver can add it.
//
// Camera only, on purpose: proof of delivery is a photo taken at the drop-off,
// so there is no "choose from gallery" here. An old or unrelated picture from
// the phone's library would prove nothing if the delivery were disputed.
const DeliveryProofSection = ({ booking, canUpload, onChanged }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const photos = booking.deliveryPhotos || [];

  if (!photos.length && !canUpload) return null;

  const remaining = MAX_DELIVERY_PHOTOS - photos.length;

  const handleAdd = async () => {
    setBusy(true);
    try {
      const assets = await takePhoto();
      if (assets.length) {
        await uploadPhotos(`/bookings/${booking._id}/delivery-proof`, assets);
        await onChanged();
      }
    } catch (error) {
      notify(t('bookings:deliveryProof.uploadFailedTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name="camera" size={iconSize.md} color={colors.primaryText} style={styles.titleIcon} />
        <Text style={styles.title}>
          {photos.length ? t('bookings:deliveryProof.titleWithCount', { count: photos.length }) : t('bookings:deliveryProof.title')}
        </Text>
      </View>

      {photos.length ? (
        <PhotoStrip photos={photos} />
      ) : (
        <Text style={styles.hint}>
          {t('bookings:deliveryProof.hint')}
        </Text>
      )}

      {canUpload && remaining > 0 && (
        <Button title={t('bookings:deliveryProof.takePhoto')} icon="camera" onPress={handleAdd} loading={busy} />
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
