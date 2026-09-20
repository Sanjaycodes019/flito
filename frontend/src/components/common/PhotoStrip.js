import React, { useEffect, useState } from 'react';
import { View, Image, ScrollView, Pressable, Text, Modal, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// Cloudinary serves resized variants of the same image by URL, so a strip asks
// for small square thumbnails instead of downloading full-size photos.
const thumbnail = (uri, px) =>
  uri && uri.includes('/image/upload/')
    ? uri.replace('/image/upload/', `/image/upload/c_fill,w_${px},h_${px},q_auto,f_auto/`)
    : uri;

// Accepts stored photos ({ url }) and freshly picked ones ({ uri }).
const PhotoStrip = ({ photos = [], onRemove, size = 88 }) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!preview || Platform.OS !== 'web') return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  if (!photos.length) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((photo, index) => {
          const uri = photo.url || photo.uri;
          return (
            <View key={photo._id || uri || index} style={{ width: size, height: size }}>
              <Pressable onPress={() => setPreview(uri)} accessibilityRole="button" accessibilityLabel={t('common:photo.viewPhoto')}>
                <Image
                  source={{ uri: thumbnail(uri, size * 2) }}
                  style={[styles.thumb, { width: size, height: size }]}
                />
              </Pressable>
              {onRemove && (
                <Pressable
                  style={styles.remove}
                  onPress={() => onRemove(photo, index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common:photo.removePhoto')}
                  hitSlop={8}
                >
                  <Icon name="close" size={14} color={colors.white} />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPreview(null)} accessibilityRole="none">
          {preview && <Image source={{ uri: preview }} style={styles.full} resizeMode="contain" />}
          <Pressable
            style={styles.closeButton}
            onPress={() => setPreview(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common:photo.closePreview')}
            hitSlop={8}
          >
            <Icon name="close" size={iconSize.lg} color={colors.white} />
          </Pressable>
          <Text style={styles.closeHint}>{t('common:photo.tapAnywhereToClose')}</Text>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = themedStyles(() => ({
  strip: { gap: spacing.sm, paddingVertical: spacing.sm },
  thumb: { borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 22, 26, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  full: { width: '100%', height: '80%' },
  closeButton: { position: 'absolute', top: spacing.xl, right: spacing.xl },
  closeHint: { color: colors.white, opacity: 0.7, marginTop: spacing.md, ...type.small },
}));

export default PhotoStrip;
