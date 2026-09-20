import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { StatusPill } from '../common/SettingsList';
import VerifiedBadge from '../common/VerifiedBadge';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { bodyTypeLabel, formatCurrency, formatKg, truckFeatureLabel, truckTypeLabel } from '../../utils/helpers';
import { TRUCK_FEATURES } from '../../utils/constants';

const Fact = ({ icon, text, muted }) => (
  <View style={styles.fact}>
    <Icon name={icon} size={iconSize.sm} color={colors.textMuted} />
    <Text style={[styles.factText, muted && styles.muted]} numberOfLines={2}>{text}</Text>
  </View>
);

// The offer already open with this truck's owner, in the shipper's words.
const offerStatus = (offer, t) => {
  if (offer.by === 'shipper') {
    return { tone: 'info', text: t('loads:truckMatchCard.requestSentWaiting', { price: formatCurrency(offer.price) }) };
  }
  if (offer.initiatedBy === 'owner' && offer.status === 'pending') {
    return { tone: 'warning', text: t('loads:truckMatchCard.ownerQuotedYourTurn', { price: formatCurrency(offer.price) }) };
  }
  return { tone: 'warning', text: t('loads:truckMatchCard.ownerCounteredYourTurn', { price: formatCurrency(offer.price) }) };
};

// One truck a shipper can choose for their load: what it is, who runs it,
// why it suits the load, its asking price, and how to ask for it.
const TruckMatchCard = ({ match, best, canRequest, maxOpenRequests, sending, onRequest, onMakeOffer, onViewOffer }) => {
  const { t } = useTranslation();
  const { truck, owner, offer } = match;
  const rated = owner.totalRatings > 0;
  const status = offer ? offerStatus(offer, t) : null;
  const priced = match.askingPrice != null;
  const bed = truck.cargoBed;
  const badges = [
    truck.insurance && {
      label: truck.insurance === 'comprehensive' ? t('loads:truckMatchCard.comprehensiveInsurance') : t('loads:truckMatchCard.insured'),
      tone: 'success',
      icon: 'verified',
    },
    ...TRUCK_FEATURES.filter((feature) => truck.features?.[feature.key]).map((feature) => ({ label: truckFeatureLabel(feature.key, t, 'short'), tone: 'info' })),
  ].filter(Boolean);

  return (
    <Card style={[styles.card, best && styles.cardBest]} containerStyle={styles.fill}>
      <View style={styles.header}>
        <View style={styles.truckIcon}>
          <Icon name="truck" size={iconSize.lg} color={colors.primaryText} />
        </View>
        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{truckTypeLabel(truck.truckType, t)}</Text>
            {truck.verified && <VerifiedBadge size={18} label={t('loads:common.verifiedTruck')} />}
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {[bodyTypeLabel(truck.bodyType, t), truck.makeModel, truck.year ? String(truck.year) : null, t('loads:truckMatchCard.carriesCapacity', { capacity: formatKg(truck.capacity) })]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {best ? <StatusPill label={t('loads:truckMatchCard.bestMatch')} tone="success" icon="star" /> : null}
      </View>

      <View style={styles.ownerRow}>
        <Icon name="owner" size={iconSize.sm} color={colors.textMuted} />
        <Text style={styles.ownerName} numberOfLines={1}>{owner.name}</Text>
        {owner.verified && <VerifiedBadge size={16} label={t('loads:common.verifiedOwner')} />}
        {rated ? (
          <View style={styles.rating}>
            <Icon name="star" size={iconSize.xs} color={colors.warningText} />
            <Text style={styles.ratingText}>{`${owner.rating.toFixed(1)} (${owner.totalRatings})`}</Text>
          </View>
        ) : (
          <Text style={styles.newOwner}>{t('loads:truckMatchCard.newOnFlito')}</Text>
        )}
        {owner.completedTrips > 0 ? (
          <Text style={styles.trips}>{t('loads:truckMatchCard.completedTrips', { count: owner.completedTrips })}</Text>
        ) : null}
      </View>

      {badges.length > 0 && (
        <View style={styles.badges}>
          {badges.map((badge) => <StatusPill key={badge.label} label={badge.label} tone={badge.tone} icon={badge.icon} />)}
        </View>
      )}

      <View style={styles.facts}>
        {match.fillPercent != null && <Fact icon="weight" text={t('loads:truckMatchCard.fillsPercent', { percent: match.fillPercent })} />}
        {bed?.lengthFt ? (
          <Fact
            icon="load"
            text={t('loads:truckMatchCard.cargoBedDims', { dims: [bed.lengthFt, bed.widthFt, bed.heightFt].filter(Boolean).join(' x ') })}
          />
        ) : null}
        <Fact
          icon="pickup"
          text={truck.base
            ? (match.distanceToPickupKm != null
              ? t('loads:truckMatchCard.basedInWithDistance', { base: truck.base, km: match.distanceToPickupKm })
              : t('loads:truckMatchCard.basedIn', { base: truck.base }))
            : t('loads:truckMatchCard.baseNotListed')}
          muted={!truck.base}
        />
        <Fact
          icon="driver"
          text={match.driverReady ? t('loads:truckMatchCard.driverAssigned') : t('loads:truckMatchCard.ownerAssignsDriver')}
          muted={!match.driverReady}
        />
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>{t('loads:truckMatchCard.matchScore')}</Text>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${match.score}%` }]} />
        </View>
        <Text style={styles.scoreValue}>{t('loads:truckMatchCard.scoreOutOf100', { score: match.score })}</Text>
      </View>

      {match.reasons.length > 0 && (
        <View style={styles.reasons}>
          {match.reasons.map((reason) => (
            <View key={reason} style={styles.reason}>
              <Icon name="checkmark" size={iconSize.xs} color={colors.successText} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>{priced ? t('loads:truckMatchCard.askingPrice') : t('loads:truckMatchCard.noListedRate')}</Text>
        <Text style={[styles.price, !priced && styles.priceMissing]}>{priced ? formatCurrency(match.askingPrice) : t('loads:truckMatchCard.nameYourPrice')}</Text>
      </View>

      {status ? (
        <View style={[styles.status, status.tone === 'info' ? styles.statusInfo : styles.statusWarning]}>
          <Text style={[styles.statusText, { color: status.tone === 'info' ? colors.infoText : colors.warningText }]}>{status.text}</Text>
          <Button title={t('loads:truckMatchCard.viewOfferButton')} icon="forward" iconPosition="right" variant="tertiary" size="sm" onPress={onViewOffer} />
        </View>
      ) : canRequest ? (
        <View style={styles.actions}>
          {priced && (
            <Button title={t('loads:truckMatchCard.requestForPrice', { price: formatCurrency(match.askingPrice) })} icon="send" onPress={onRequest} loading={sending} />
          )}
          <Button title={t('loads:truckMatchCard.makeAnOfferButton')} icon="counterOffer" variant={priced ? 'tertiary' : 'primary'} onPress={onMakeOffer} disabled={sending} />
        </View>
      ) : (
        <Text style={styles.limitNote}>
          {t('loads:truckMatchCard.requestsLimitNote', { max: maxOpenRequests })}
        </Text>
      )}
    </Card>
  );
};

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  card: { flex: 1, marginVertical: 0, borderWidth: 1, borderColor: 'transparent' },
  cardBest: { borderColor: colors.accentText },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  truckIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary, flexShrink: 1 },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  ownerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  ownerName: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { ...type.smallMedium, color: colors.textPrimary },
  newOwner: { ...type.small, color: colors.textMuted },
  trips: { ...type.small, color: colors.textMuted },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  facts: { marginTop: spacing.md, gap: spacing.xs },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  factText: { ...type.small, color: colors.textSecondary, flex: 1 },
  muted: { color: colors.textMuted },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  scoreLabel: { ...type.small, color: colors.textMuted },
  scoreTrack: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  scoreFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accentText },
  scoreValue: { ...type.smallMedium, color: colors.textPrimary },

  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.successMuted,
  },
  reasonText: { ...type.small, color: colors.successText },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  priceLabel: { ...type.small, color: colors.textMuted },
  price: { ...type.h2, color: colors.primaryText },
  priceMissing: { ...type.bodyMedium, color: colors.textSecondary },

  actions: { gap: spacing.xxs, marginTop: spacing.sm },
  status: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  statusInfo: { backgroundColor: colors.infoMuted },
  statusWarning: { backgroundColor: colors.warningMuted },
  statusText: { ...type.smallMedium },
  limitNote: { ...type.small, color: colors.textMuted, marginTop: spacing.md },
}));

export default TruckMatchCard;
