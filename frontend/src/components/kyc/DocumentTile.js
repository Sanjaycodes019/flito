import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { FLITO_COLORS } from '../../utils/colors';

// A private document behind a short-lived link: images preview inline, PDFs
// show a badge. Tapping opens the full file.
const DocumentTile = ({ doc, label, size = 72 }) => {
  const isPdf = doc.format === 'pdf';
  const open = () => doc.url && Linking.openURL(doc.url);

  return (
    <TouchableOpacity style={styles.tile} onPress={open} disabled={!doc.url} accessibilityLabel={`Open ${label}`}>
      {isPdf || !doc.url ? (
        <View style={[styles.badge, { width: size, height: size }]}>
          <Text style={styles.badgeText}>{isPdf ? 'PDF' : 'FILE'}</Text>
        </View>
      ) : (
        <Image source={{ uri: doc.url }} style={[styles.thumb, { width: size, height: size }]} />
      )}
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  thumb: { borderRadius: 8, backgroundColor: '#EEE' },
  badge: {
    borderRadius: 8,
    backgroundColor: FLITO_COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  label: { flex: 1, fontSize: 13, color: FLITO_COLORS.info, textDecorationLine: 'underline' },
});

export default DocumentTile;
