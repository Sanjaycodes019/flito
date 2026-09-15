import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import { StatusPill } from '../common/SettingsList';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import { bodyTypeLabel, formatCurrency, formatKg, truckTypeLabel } from '../../utils/helpers';
import { TRUCK_FEATURES } from '../../utils/constants';

const Fact = ({ icon, text, muted }) => (
  <View style={styles.fact}>
    <Icon name={icon} size={iconSize.sm} color={colors.textMuted} />
    <Text style={[styles.factText, muted && styles.muted]} numberOfLines={2}>{text}</Text>
  </View>
);

// The offer already open with this truck's owner, in the shipper's words.
const offerStatus = (offer) => {
  if (offer.by === 'shipper') {
    return { tone: 'info', text: `Request sent for ${formatCurrency(offer.price)}. Waiting for the owner.` };
  }
  if (offer.initiatedBy === 'owner' && offer.status === 'pending') {
    return { tone: 'warning', text: `This owner quoted ${formatCurrency(offer.price)}. Your turn to reply.` };
  }
  return { tone: 'warning', text: `The owner countered with ${formatCurrency(offer.price)}. Your turn to reply.` };
};

// One truck a shipper can choose for their load: what it is, who runs it,
// why it suits the load, its asking price, and how to ask for it.
const TruckMatchCard = ({ match, best, canRequest, maxOpenRequests, sending, onRequest, onMakeOffer, onViewOffer }) => {
  const { truck, owner, offer } = match;
  const rated = owner.totalRatings > 0;
  const status = offer ? offerStatus(offer) : null;
  const priced = match.askingPrice != null;
  const bed = truck.cargoBed;
  const badges = [
    truck.insurance && {
      label: truck.insurance === 'comprehensive' ? 'Comprehensive insurance' : 'Insured',
      tone: 'success',
      icon: 'verified',
    },
    ...TRUCK_FEATURES.filter((feature) => truck.features?.[feature.key]).map((feature) => ({ label: feature.short, tone: 'info' })),
  ].filter(Boolean);

  return (
    <Card style={[styles.card, best && styles.cardBest]} containerStyle={styles.fill}>
      <View style={styles.header}>
        <View style={styles.truckIcon}>
          <Icon name="truck" size={iconSize.lg} color={colors.primaryText} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title} numberOfLines={1}>{truckTypeLabel(truck.truckType)}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {[bodyTypeLabel(truck.bodyType), truck.makeModel, truck.year ? String(truck.year) : null, `carries ${formatKg(truck.capacity)}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {best ? <StatusPill label="Best match" tone="success" icon="star" /> : null}
      </View>

      <View style={styles.ownerRow}>
        <Icon name="owner" size={iconSize.sm} color={colors.textMuted} />
        <Text style={styles.ownerName} numberOfLines={1}>{owner.name}</Text>
        {rated ? (
          <View style={styles.rating}>
            <Icon name="star" size={iconSize.xs} color={colors.warningText} />
            <Text style={styles.ratingText}>{`${owner.rating.toFixed(1)} (${owner.totalRatings})`}</Text>
          </View>
        ) : (
          <Text style={styles.newOwner}>New on FLITO</Text>
        )}
        {owner.completedTrips > 0 ? (
          <Text style={styles.trips}>{`${owner.completedTrips} ${owner.completedTrips === 1 ? 'trip' : 'trips'}`}</Text>
        ) : null}
      </View>

      {badges.length > 0 && (
        <View style={styles.badges}>
          {badges.map((badge) => <StatusPill key={badge.label} label={badge.label} tone={badge.tone} icon={badge.icon} />)}
        </View>
      )}

      <View style={styles.facts}>
        {match.fillPercent != null && <Fact icon="weight" text={`Your load fills ${match.fillPercent}% of it`} />}
        {bed?.lengthFt ? (
          <Fact
            icon="load"
            text={`Cargo bed ${[bed.lengthFt, bed.widthFt, bed.heightFt].filter(Boolean).join(' x ')} ft`}
          />
        ) : null}
        <Fact
          icon="pickup"
          text={truck.base
            ? `Based in ${truck.base}${match.distanceToPickupKm != null ? `, about ${match.distanceToPickupKm} km from pickup` : ''}`
            : 'Base not listed'}
          muted={!truck.base}
        />
        <Fact
          icon="driver"
          text={match.driverReady ? 'Driver assigned' : 'Owner assigns a driver after booking'}
          muted={!match.driverReady}
        />
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Match score</Text>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${match.score}%` }]} />
        </View>
        <Text style={styles.scoreValue}>{`${match.score}/100`}</Text>
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
        <Text style={styles.priceLabel}>{priced ? 'Asking price' : 'No listed rate'}</Text>
        <Text style={[styles.price, !priced && styles.priceMissing]}>{priced ? formatCurrency(match.askingPrice) : 'Name your price'}</Text>
      </View>

      {status ? (
        <View style={[styles.status, status.tone === 'info' ? styles.statusInfo : styles.statusWarning]}>
          <Text style={[styles.statusText, { color: status.tone === 'info' ? colors.infoText : colors.warningText }]}>{status.text}</Text>
          <Button title="View Offer" icon="forward" iconPosition="right" variant="tertiary" size="sm" onPress={onViewOffer} />
        </View>
      ) : canRequest ? (
        <View style={styles.actions}>
          {priced && (
            <Button title={`Request for ${formatCurrency(match.askingPrice)}`} icon="send" onPress={onRequest} loading={sending} />
          )}
          <Button title="Make an Offer" icon="counterOffer" variant={priced ? 'tertiary' : 'primary'} onPress={onMakeOffer} disabled={sending} />
        </View>
      ) : (
        <Text style={styles.limitNote}>
          {`You have ${maxOpenRequests} requests waiting. Withdraw one or wait for a reply before asking this truck.`}
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
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
  title: { ...type.h3, color: colors.textPrimary },
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
});

export default TruckMatchCard;
