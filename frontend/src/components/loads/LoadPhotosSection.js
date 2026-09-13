import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '../common/Button';
import PhotoStrip from '../common/PhotoStrip';
import { colors, spacing, type } from '../../theme/tokens';
import { MAX_LOAD_PHOTOS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
import { pickImages, uploadPhotos } from '../../services/uploads';

const LoadPhotosSection = ({ load, canEdit, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const photos = load.photos || [];

  if (!photos.length && !canEdit) return null;

  const remaining = MAX_LOAD_PHOTOS - photos.length;

  const handleAdd = async () => {
    setBusy(true);
    try {
      const assets = await pickImages({ max: remaining });
      if (assets.length) {
        await uploadPhotos(`/loads/${load._id}/photos`, assets);
        await onChanged();
      }
    } catch (error) {
      notify('Upload failed', getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleRemove = (photo) => confirmAction({
    title: 'Remove photo',
    message: 'Remove this photo from the load?',
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: async () => {
      setBusy(true);
      try {
        await api.delete(`/loads/${load._id}/photos/${photo._id}`);
        await onChanged();
      } catch (error) {
        notify('Error', getErrorMessage(error));
      }
      setBusy(false);
    },
  });

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Photos{photos.length ? ` (${photos.length})` : ''}</Text>

      {photos.length ? (
        <PhotoStrip photos={photos} onRemove={canEdit ? handleRemove : undefined} />
      ) : (
        <Text style={styles.hint}>Photos help owners judge the cargo and quote accurately.</Text>
      )}

      {canEdit && remaining > 0 && (
        <Button title="Add Photos" icon="camera" variant="tertiary" onPress={handleAdd} loading={busy} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: spacing.md },
  title: { ...type.bodyMedium, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
});

export default LoadPhotosSection;
