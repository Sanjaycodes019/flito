import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import PhotoStrip from '../common/PhotoStrip';
import PhotoSourceButtons from '../common/PhotoSourceButtons';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';
import { MAX_LOAD_PHOTOS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
import { pickImages, takePhoto, uploadPhotos } from '../../services/uploads';

const LoadPhotosSection = ({ load, canEdit, onChanged }) => {
  const { t } = useTranslation();
  // Which source is working: 'camera', 'library', 'remove' or null.
  const [busy, setBusy] = useState(null);
  const photos = load.photos || [];

  if (!photos.length && !canEdit) return null;

  const remaining = MAX_LOAD_PHOTOS - photos.length;

  const handleAdd = async (source) => {
    setBusy(source);
    try {
      const assets = source === 'camera' ? await takePhoto() : await pickImages({ max: remaining });
      if (assets.length) {
        await uploadPhotos(`/loads/${load._id}/photos`, assets);
        await onChanged();
      }
    } catch (error) {
      notify(t('loads:photosSection.uploadFailedTitle'), getErrorMessage(error));
    }
    setBusy(null);
  };

  const handleRemove = (photo) => confirmAction({
    title: t('loads:photosSection.removeTitle'),
    message: t('loads:photosSection.removeMessage'),
    confirmLabel: t('loads:photosSection.removeConfirmLabel'),
    destructive: true,
    onConfirm: async () => {
      setBusy('remove');
      try {
        await api.delete(`/loads/${load._id}/photos/${photo._id}`);
        await onChanged();
      } catch (error) {
        notify(t('loads:photosSection.errorTitle'), getErrorMessage(error));
      }
      setBusy(null);
    },
  });

  return (
    <View style={styles.section}>
      <Text style={styles.title}>
        {photos.length ? t('loads:photosSection.titleWithCount', { count: photos.length }) : t('loads:photosSection.title')}
      </Text>

      {photos.length ? (
        <PhotoStrip photos={photos} onRemove={canEdit ? handleRemove : undefined} />
      ) : (
        <Text style={styles.hint}>{t('loads:photosSection.hint')}</Text>
      )}

      {canEdit && remaining > 0 && (
        <PhotoSourceButtons
          onTakePhoto={() => handleAdd('camera')}
          onChoose={() => handleAdd('library')}
          chooseLabel={t('loads:common.choosePhotos')}
          busy={busy}
        />
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  section: { marginTop: spacing.md },
  title: { ...type.bodyMedium, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
}));

export default LoadPhotosSection;
