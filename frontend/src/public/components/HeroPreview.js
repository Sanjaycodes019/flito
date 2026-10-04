import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';
import { useContent } from '../content';
import useSiteStyle from '../siteStyle';

// A drawing of the app, not live data: a load with competing offers, as a
// shipper sees it, with the moments that follow (the truck on the road, the
// owner's return trip filled) pinned beside it. It stays still: in FLITO motion
// only ever marks a change of state (see theme/tokens motion). Screen readers
// get one sentence instead of the pieces.
const HeroPreview = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const offers = list('site:landing.preview.offers');
  const compact = site.isPhone;

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${t('site:landing.preview.label')}: ${t('site:landing.preview.goods')}, ${t('site:landing.preview.from')} → ${t('site:landing.preview.to')}, ${t('site:landing.preview.offersTitle')}`}
    >
      <View style={styles.glow} />

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.exampleTag}>
            <Text style={styles.exampleText}>{t('site:landing.preview.label')}</Text>
          </View>
          <View style={styles.meta}>
            <Icon name="calendar" size={iconSize.xs} color={colors.textMuted} />
            <Text style={styles.metaText}>{t('site:landing.preview.pickup')}</Text>
          </View>
        </View>

        <View style={styles.goodsRow}>
          <View style={styles.goodsIcon}>
            <Icon name="goodsCement" size={iconSize.lg} color={colors.primaryText} />
          </View>
          <Text style={styles.goods}>{t('site:landing.preview.goods')}</Text>
        </View>

        <View style={styles.route}>
          <View style={styles.stop}>
            <View style={[styles.pin, styles.pinFrom]} />
            <Text style={styles.place}>{t('site:landing.preview.from')}</Text>
          </View>
          <View style={styles.routeLine}>
            {Array.from({ length: 9 }).map((_, i) => <View key={i} style={styles.dash} />)}
            <View style={styles.routeTruck}>
              <Icon name="truckDelivery" size={iconSize.sm} color={colors.textOnPrimary} />
            </View>
          </View>
          <View style={[styles.stop, styles.stopEnd]}>
            <Text style={styles.place}>{t('site:landing.preview.to')}</Text>
            <View style={[styles.pin, styles.pinTo]} />
          </View>
        </View>

        <View style={styles.chips}>
          <View style={styles.chip}><Icon name="weight" size={iconSize.xs} color={colors.textSecondary} /><Text style={styles.chipText}>{t('site:landing.preview.weight')}</Text></View>
          <View style={styles.chip}><Icon name="truck" size={iconSize.xs} color={colors.textSecondary} /><Text style={styles.chipText}>{t('site:landing.preview.truck')}</Text></View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.offersTitle}>{t('site:landing.preview.offersTitle')}</Text>

        {offers.map((offer, index) => {
          const mine = index === offers.length - 1;
          return (
            <View key={offer.who} style={[styles.offer, mine && styles.offerMine]}>
              <View style={[styles.avatar, mine && styles.avatarMine]}>
                <Icon name={mine ? 'counterOffer' : 'owner'} size={iconSize.sm} color={mine ? colors.primaryText : colors.textSecondary} />
              </View>
              <View style={styles.offerText}>
                <Text style={styles.offerWho} numberOfLines={1}>{offer.who}</Text>
                <View style={styles.offerNote}>
                  {!mine ? <Icon name="verified" size={12} color={colors.accentText} /> : <Icon name="time" size={12} color={colors.primaryText} />}
                  <Text style={[styles.offerNoteText, mine && styles.offerNoteMine]} numberOfLines={1}>{offer.note}</Text>
                </View>
              </View>
              <Text style={styles.price}>{offer.price}</Text>
              {index === 1 && !compact ? (
                <View style={styles.accept}><Text style={styles.acceptText}>{t('site:landing.preview.accept')}</Text></View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={[styles.note, styles.noteTop, compact && styles.noteTopCompact]}>
        <View style={[styles.noteIcon, styles.noteIconTeal]}>
          <Icon name="truckBooked" size={iconSize.sm} color={colors.accentText} />
        </View>
        <Text style={styles.noteText}>{t('site:landing.preview.returnFilled')}</Text>
      </View>

      <View style={[styles.note, styles.noteDark, styles.noteBottom, compact && styles.noteBottomCompact]}>
        <View style={[styles.noteIcon, styles.noteIconAmber]}>
          <Icon name="gps" size={iconSize.sm} color={colors.textOnPrimary} />
        </View>
        <Text style={[styles.noteText, styles.noteTextDark]}>{t('site:landing.preview.tracking')}</Text>
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  wrap: { paddingVertical: 36, paddingHorizontal: 28, width: '100%', maxWidth: 500, alignSelf: 'center' },
  wrapCompact: { paddingHorizontal: 0, paddingVertical: 32 },
  glow: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 30,
    right: 30,
    borderRadius: 40,
    backgroundColor: colors.primaryMuted,
    transform: [{ rotate: '-4deg' }],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.level3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  exampleTag: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  exampleText: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...type.small, color: colors.textMuted },
  goodsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goodsIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  goods: { ...type.h3, color: colors.textPrimary, flex: 1 },

  route: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stopEnd: { justifyContent: 'flex-end' },
  pin: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  pinFrom: { borderColor: colors.primary, backgroundColor: colors.surface },
  pinTo: { borderColor: colors.accent, backgroundColor: colors.accent },
  place: { ...type.bodyMedium, color: colors.textPrimary },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minWidth: 60 },
  dash: { width: 6, height: 2, borderRadius: 1, backgroundColor: colors.borderStrong },
  routeTruck: {
    position: 'absolute',
    left: '42%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipText: { ...type.small, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  offersTitle: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },

  offer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  offerMine: { backgroundColor: colors.primaryMuted, marginTop: spacing.xs },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  avatarMine: { backgroundColor: colors.surface },
  offerText: { flex: 1, minWidth: 0 },
  offerWho: { ...type.smallMedium, color: colors.textPrimary },
  offerNote: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  offerNoteText: { fontSize: 13, lineHeight: 18, color: colors.accentText, fontWeight: '600' },
  offerNoteMine: { color: colors.primaryText },
  price: { ...type.bodyMedium, color: colors.textPrimary },
  accept: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  acceptText: { fontSize: 13, fontWeight: '700', color: colors.textOnPrimary },

  note: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.level2,
  },
  noteTop: { top: 0, right: 0 },
  noteTopCompact: { right: spacing.sm },
  noteBottom: { bottom: 0, left: 0 },
  noteBottomCompact: { left: spacing.sm },
  // Deep Asphalt in both themes, so the note reads as a dark chip on any page.
  noteDark: { backgroundColor: '#1E242B', borderColor: '#1E242B' },
  noteIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noteIconTeal: { backgroundColor: colors.accentMuted },
  noteIconAmber: { backgroundColor: colors.primary },
  noteText: { ...type.smallMedium, color: colors.textPrimary },
  noteTextDark: { color: '#F4F6F8' },
}));

export default HeroPreview;
