import React, { useState } from 'react';
import { View, Image, ScrollView, TouchableOpacity, Text, Modal, Pressable, StyleSheet } from 'react-native';

// Cloudinary serves resized variants of the same image by URL, so a strip asks
// for small square thumbnails instead of downloading full-size photos.
const thumbnail = (uri, px) =>
  uri && uri.includes('/image/upload/')
    ? uri.replace('/image/upload/', `/image/upload/c_fill,w_${px},h_${px},q_auto,f_auto/`)
    : uri;

// Accepts stored photos ({ url }) and freshly picked ones ({ uri }).
const PhotoStrip = ({ photos = [], onRemove, size = 88 }) => {
  const [preview, setPreview] = useState(null);

  if (!photos.length) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((photo, index) => {
          const uri = photo.url || photo.uri;
          return (
            <View key={photo._id || uri || index} style={{ width: size, height: size }}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setPreview(uri)} accessibilityLabel="View photo">
                <Image
                  source={{ uri: thumbnail(uri, size * 2) }}
                  style={[styles.thumb, { width: size, height: size }]}
                />
              </TouchableOpacity>
              {onRemove && (
                <TouchableOpacity
                  style={styles.remove}
                  onPress={() => onRemove(photo, index)}
                  accessibilityLabel="Remove photo"
                  hitSlop={8}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPreview(null)}>
          {preview && <Image source={{ uri: preview }} style={styles.full} resizeMode="contain" />}
          <Text style={styles.closeHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  strip: { gap: 8, paddingVertical: 8 },
  thumb: { borderRadius: 8, backgroundColor: '#EEE' },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#FFF', fontSize: 16, fontWeight: '700', lineHeight: 20 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  full: { width: '100%', height: '80%' },
  closeHint: { color: '#FFF', opacity: 0.7, marginTop: 12, fontSize: 13 },
});

export default PhotoStrip;
