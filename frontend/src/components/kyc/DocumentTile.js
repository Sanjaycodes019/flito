import React from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

// A private document behind a short-lived link: images preview inline, PDFs
// show a badge. Tapping opens the full file.
const DocumentTile = ({ doc, label, size = 72 }) => {
  const isPdf = doc.format === 'pdf';
  const open = () => doc.url && Linking.openURL(doc.url);

  return (
    <Pressable style={styles.tile} onPress={open} disabled={!doc.url} accessibilityRole="link" accessibilityLabel={`Open ${label}`}>
      {isPdf || !doc.url ? (
        <View style={[styles.badge, { width: size, height: size }]}>
          <Icon name="document" size={iconSize.lg} color={colors.textOnDark} />
          {isPdf && <Text style={styles.badgeText}>PDF</Text>}
        </View>
      ) : (
        <Image source={{ uri: doc.url }} style={[styles.thumb, { width: size, height: size }]} />
      )}
      <View style={styles.labelRow}>
        <Text style={styles.label} numberOfLines={2}>{label}</Text>
        <Icon name="forward" size={iconSize.sm} color={colors.textLink} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  thumb: { borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  badge: {
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.textOnDark, fontWeight: '700', fontSize: 11, marginTop: 2 },
  labelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1, ...type.small, color: colors.textLink },
});

export default DocumentTile;
