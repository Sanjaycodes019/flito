import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button';
import VerifiedBadge from '../common/VerifiedBadge';
import RecordCard, { Fact, Pill } from '../common/RecordCard';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { bodyTypeLabel, formatCurrency, formatKg, truckFeatureLabel, truckTypeLabel } from '../../utils/helpers';
import { TRUCK_FEATURES } from '../../utils/constants';

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
// why it suits the load, its asking price, and how to ask for it. Built on the
// app's record card, so the price and the buttons sit at the bottom of every
// card in a row, level with each other.
const TruckMatchCard = ({ match, best, canRequest, maxOpenRequests, sending, onRequest, onMakeOffer, onViewOffer }) => {
  const { t } = useTranslation();
  const { truck, owner, offer } = match;
  const status = offer ? offerStatus(offer, t) : null;
  const priced = match.askingPrice != null;
  const bed = truck.cargoBed;
  const features = TRUCK_FEATURES.filter((feature) => truck.features?.[feature.key]);
  const ownerMeta = [
    owner.totalRatings > 0 ? `★ ${owner.rating.toFixed(1)} (${owner.totalRatings})` : t('loads:truckMatchCard.newOnFlito'),
    owner.completedTrips > 0 ? t('loads:truckMatchCard.completedTrips', { count: owner.completedTrips }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <RecordCard
      icon="truck"
      title={truckTypeLabel(truck.truckType, t)}
      titleAddon={truck.verified ? <VerifiedBadge size={18} label={t('loads:common.verifiedTruck')} /> : null}
      subtitle={[bodyTypeLabel(truck.bodyType, t), truck.makeModel, truck.year ? String(truck.year) : null, t('loads:truckMatchCard.carriesCapacity', { capacity: formatKg(truck.capacity) })]
        .filter(Boolean)
        .join(' · ')}
      highlight={best}
      badges={(
        <>
          {best ? <Pill icon="star" tone="success">{t('loads:truckMatchCard.bestMatch')}</Pill> : null}
          {truck.insurance ? (
            <Pill icon="verified" tone="success">
              {truck.insurance === 'comprehensive' ? t('loads:truckMatchCard.comprehensiveInsurance') : t('loads:truckMatchCard.insured')}
            </Pill>
          ) : null}
          {features.map((feature) => <Pill key={feature.key} tone="info">{truckFeatureLabel(feature.key, t, 'short')}</Pill>)}
        </>
      )}
      footer={(
        <>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel} numberOfLines={1}>{priced ? t('loads:truckMatchCard.askingPrice') : t('loads:truckMatchCard.noListedRate')}</Text>
            <Text style={[styles.price, !priced && styles.priceMissing]} numberOfLines={1}>
              {priced ? formatCurrency(match.askingPrice) : t('loads:truckMatchCard.nameYourPrice')}
            </Text>
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
            <Text style={styles.limitNote}>{t('loads:truckMatchCard.requestsLimitNote', { max: maxOpenRequests })}</Text>
          )}
        </>
      )}
    >
      <View style={styles.owner}>
        <Icon name="owner" size={iconSize.xs} color={colors.textMuted} />
        <Text style={styles.ownerName} numberOfLines={1}>{owner.name}</Text>
        {owner.verified ? <VerifiedBadge size={16} label={t('loads:common.verifiedOwner')} /> : null}
        <Text style={styles.ownerMeta} numberOfLines={1}>{ownerMeta}</Text>
      </View>
      {match.fillPercent != null ? <Fact icon="weight">{t('loads:truckMatchCard.fillsPercent', { percent: match.fillPercent })}</Fact> : null}
      {bed?.lengthFt ? (
        <Fact icon="load">{t('loads:truckMatchCard.cargoBedDims', { dims: [bed.lengthFt, bed.widthFt, bed.heightFt].filter(Boolean).join(' × ') })}</Fact>
      ) : null}
      <Fact icon="pickup" lines={2}>
        {truck.base
          ? (match.distanceToPickupKm != null
            ? t('loads:truckMatchCard.basedInWithDistance', { base: truck.base, km: match.distanceToPickupKm })
            : t('loads:truckMatchCard.basedIn', { base: truck.base }))
          : t('loads:truckMatchCard.baseNotListed')}
      </Fact>
      <Fact icon="driver" tone={match.driverReady ? 'success' : undefined}>
        {match.driverReady ? t('loads:truckMatchCard.driverAssigned') : t('loads:truckMatchCard.ownerAssignsDriver')}
      </Fact>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel} numberOfLines={1}>{t('loads:truckMatchCard.matchScore')}</Text>
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
    </RecordCard>
  );
};

const styles = themedStyles(() => ({
  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  ownerName: { ...type.smallMedium, color: colors.textPrimary, flexShrink: 1 },
  ownerMeta: { ...type.small, color: colors.textMuted, flexShrink: 2, marginLeft: 'auto' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  scoreLabel: { ...type.small, color: colors.textMuted, flexShrink: 0 },
  scoreTrack: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  scoreFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accentText },
  scoreValue: { ...type.smallMedium, color: colors.textPrimary, flexShrink: 0 },

  reasons: { gap: spacing.xs },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  reasonText: { ...type.small, color: colors.successText, flex: 1, minWidth: 0 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  priceLabel: { ...type.small, color: colors.textMuted, flexShrink: 1 },
  price: { ...type.h2, color: colors.primaryText, flexShrink: 0 },
  priceMissing: { ...type.bodyMedium, color: colors.textSecondary },

  actions: { gap: spacing.xxs, marginTop: spacing.sm },
  status: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  statusInfo: { backgroundColor: colors.infoMuted },
  statusWarning: { backgroundColor: colors.warningMuted },
  statusText: { ...type.smallMedium },
  limitNote: { ...type.small, color: colors.textMuted, marginTop: spacing.md },
}));

export default TruckMatchCard;
