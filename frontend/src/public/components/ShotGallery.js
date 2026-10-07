import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Modal, Platform, useWindowDimensions } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';
import { useContent } from '../content';
import useSiteStyle from '../siteStyle';
import { SHOTS, shotUri, aspectOf, justifyRows } from '../gallery';
import { useTone } from './Blocks';

// Screenshots of the app, lined up in rows of one height (see justifyRows),
// each opening full size in a viewer. Captions come from site:gallery.shots.

const caption = (t, key) => t(`site:gallery.shots.${key}`);

// One screenshot in its frame: a laptop screen, a phone screen or a page.
// Every frame adds the same border, so a row's shots stay one height.
const Shot = ({ shotKey, height, onOpen, showCaption }) => {
  const { t } = useContent();
  const tone = useTone();
  const [hovered, setHovered] = useState(false);
  const shot = SHOTS[shotKey];
  const width = Math.round(height * aspectOf(shotKey));
  const text = caption(t, shotKey);
  return (
    <View style={{ width }}>
      <Pressable
        onPress={onOpen}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityLabel={t('site:gallery.open', { caption: text })}
        style={({ pressed }) => [
          styles.frame,
          styles[`frame_${shot.frame}`],
          { borderColor: hovered ? colors.primaryText : tone.cardBorder },
          hovered && styles.lifted,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={{ uri: shotUri(shotKey), width: shot.width, height: shot.height }}
          style={[{ width: width - 2, height: Math.round(height) - 2 }, styles[`image_${shot.frame}`]]}
          resizeMode="cover"
          accessibilityLabel={text}
        />
        <View style={[styles.zoomBadge, hovered && styles.zoomBadgeShown]}>
          <Icon name="expand" size={iconSize.sm} color={colors.textInverse} />
        </View>
      </Pressable>
      {showCaption ? <Text style={[styles.caption, { color: tone.body }]}>{text}</Text> : null}
    </View>
  );
};

// The screenshots `keys`, in rows that fill the width the page gives them.
export const ShotRows = ({ keys, onOpen, showCaption = true }) => {
  const site = useSiteStyle();
  const [width, setWidth] = useState(0);
  const gap = site.isPhone ? spacing.md : spacing.xl;
  const rows = width ? justifyRows(keys, {
    width,
    gap,
    maxAspect: site.isPhone ? 1 : site.isTablet ? 2.2 : 3.3,
    maxHeight: site.isPhone ? 520 : 560,
  }) : [];
  return (
    <View testID="shot-rows" onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={styles.rows}>
      {rows.map((row) => (
        <View key={row.keys.join()} style={[styles.row, { gap }]}>
          {row.keys.map((key) => (
            <Shot key={key} shotKey={key} height={row.height} onOpen={() => onOpen(key)} showCaption={showCaption} />
          ))}
        </View>
      ))}
    </View>
  );
};

// The viewer: one screenshot as large as the window allows, its caption, and
// the way to the previous and next ones. Arrow keys and Escape work on the web.
export const ShotViewer = ({ keys, current, onChange, onClose }) => {
  const { t } = useContent();
  const window = useWindowDimensions();
  const index = keys.indexOf(current);
  const open = index >= 0;
  const go = (step) => onChange(keys[(index + step + keys.length) % keys.length]);

  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  const shot = SHOTS[current];
  const text = caption(t, current);
  // On a phone the arrows sit below the picture instead of beside it.
  const narrow = window.width < 600;
  const roomWidth = window.width - (narrow ? 24 : 160);
  const roomHeight = window.height - (narrow ? 230 : 170);
  const scale = Math.min(roomWidth / shot.width, roomHeight / shot.height, 1);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('site:gallery.close')} />
        <View style={styles.viewerTop} pointerEvents="box-none">
          <Text style={styles.counter}>{t('site:gallery.counter', { current: index + 1, total: keys.length })}</Text>
          <Pressable onPress={onClose} style={styles.viewerButton} accessibilityRole="button" accessibilityLabel={t('site:gallery.close')} hitSlop={8}>
            <Icon name="close" size={iconSize.lg} color={colors.textInverse} />
          </Pressable>
        </View>
        <View style={styles.viewerStage} pointerEvents="box-none">
          <Image
            source={{ uri: shotUri(current), width: shot.width, height: shot.height }}
            style={[styles.viewerImage, { width: Math.round(shot.width * scale), height: Math.round(shot.height * scale) }]}
            resizeMode="contain"
            accessibilityLabel={text}
          />
          <Text style={[styles.viewerCaption, { maxWidth: Math.max(280, Math.round(shot.width * scale)) }]}>{text}</Text>
        </View>
        {keys.length > 1 ? (
          <>
            <Pressable onPress={() => go(-1)} style={[styles.viewerButton, styles.prev, narrow && styles.arrowBelow]} accessibilityRole="button" accessibilityLabel={t('site:gallery.previous')} hitSlop={8}>
              <Icon name="back" size={iconSize.lg} color={colors.textInverse} />
            </Pressable>
            <Pressable onPress={() => go(1)} style={[styles.viewerButton, styles.next, narrow && styles.arrowBelow]} accessibilityRole="button" accessibilityLabel={t('site:gallery.next')} hitSlop={8}>
              <Icon name="forward" size={iconSize.lg} color={colors.textInverse} />
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = themedStyles(() => ({
  rows: { gap: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start' },

  frame: { borderWidth: 1, overflow: 'hidden', backgroundColor: colors.surface, ...shadow.level2 },
  frame_browser: { borderRadius: radius.lg },
  frame_phone: { borderRadius: 22 },
  frame_doc: { borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  image_browser: {},
  image_phone: { borderRadius: 21 },
  image_doc: {},
  lifted: { ...shadow.level3, transform: [{ translateY: -3 }] },
  pressed: { opacity: 0.92 },
  zoomBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 22, 26, 0.72)',
    opacity: 0.85,
  },
  zoomBadgeShown: { opacity: 1, backgroundColor: colors.primaryText },
  caption: { ...type.small, marginTop: spacing.sm },

  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12, 15, 18, 0.96)' },
  viewerTop: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { ...type.smallMedium, color: colors.textInverseMuted },
  viewerStage: { alignItems: 'center', gap: spacing.md },
  viewerImage: { borderRadius: radius.md },
  viewerCaption: { ...type.body, color: colors.textInverse, textAlign: 'center', paddingHorizontal: spacing.md },
  viewerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 246, 248, 0.12)',
  },
  prev: { position: 'absolute', left: spacing.lg, top: '50%', marginTop: -24 },
  next: { position: 'absolute', right: spacing.lg, top: '50%', marginTop: -24 },
  arrowBelow: { top: 'auto', marginTop: 0, bottom: spacing.xl },
}));
