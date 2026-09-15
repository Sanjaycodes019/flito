import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import VerificationPrompt from '../components/kyc/VerificationPrompt';
import VerifiedBadge from '../components/common/VerifiedBadge';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, formatKg, getErrorMessage, truckTypeLabel } from '../utils/helpers';
import { dayLabel } from '../utils/nepalDate';
import {
  MAX_OFFERS, isOpenQuote, offerHistory, openingSide, standingOffer,
} from '../utils/negotiation';
import api from '../services/api';
import { notify } from '../utils/alert';
import LoadPhotosSection from '../components/loads/LoadPhotosSection';
import useScreenLayout from '../hooks/useScreenLayout';

const DETAIL_ICON = {
  Pickup: 'pickup',
  Dropoff: 'dropoff',
  'Pickup Date': 'calendar',
  Distance: 'route',
  Weight: 'weight',
  'Truck Type': 'truck',
  'Budget Estimate': 'price',
  Posted: 'calendar',
  Truck: 'truck',
};

const TAKING_OFFERS = ['open', 'quoted', 'negotiating'];
const MIN_PRICE = 100;

const isWholePrice = (text) => /^\d+$/.test(text.trim()) && Number(text) >= MIN_PRICE;

const LoadDetailScreen = ({ route, navigation }) => {
  const { loadId } = route.params;
  const { user } = useSelector((state) => state.auth);
  const [load, setLoad] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [myQuote, setMyQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  // One readable column below desktop; the load and its offers side by side above.
  const layout = useScreenLayout('narrow', 'wide');

  const isShipper = user?.role === ROLES.SHIPPER;
  const isOwner = user?.role === ROLES.OWNER;
  const isMyLoad = load && String(load.shipperId?._id || load.shipperId) === user?._id;

  const fetchAll = useCallback(async () => {
    try {
      const { data: loadRes } = await api.get(`/loads/${loadId}`);
      setLoad(loadRes.load);

      if (isShipper && isMyLoad !== false) {
        const { data: quotesRes } = await api.get(`/loads/${loadId}/quotes`);
        setQuotes(quotesRes.quotes);
      }
      if (isOwner) {
        const { data: mineRes } = await api.get('/quotes/mine');
        const existing = mineRes.quotes.find((q) => (q.loadId?._id || q.loadId) === loadId && isOpenQuote(q))
          || mineRes.quotes.find((q) => (q.loadId?._id || q.loadId) === loadId);
        setMyQuote(existing || null);
      }
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
  }, [loadId, isShipper, isOwner, isMyLoad]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleAccept = async (quoteId) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/quotes/${quoteId}/accept`);
      notify('Offer accepted', 'The load is booked', () =>
        navigation.replace('BookingDetail', { bookingId: data.booking._id })
      );
    } catch (error) {
      notify('Could not accept', getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleReject = async (quoteId) => {
    setBusy(true);
    try {
      await api.patch(`/quotes/${quoteId}/reject`);
      await fetchAll();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleCounter = async (quoteId, counterOfferPrice) => {
    setBusy(true);
    try {
      await api.patch(`/quotes/${quoteId}/counter`, { counterOfferPrice });
      await fetchAll();
    } catch (error) {
      notify('Could not send the counter-offer', getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleCancelLoad = async () => {
    setBusy(true);
    try {
      await api.patch(`/loads/${loadId}/cancel`);
      await fetchAll();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleRelist = async () => {
    setBusy(true);
    try {
      await api.patch(`/loads/${loadId}/relist`);
      await fetchAll();
      notify('Load relisted', 'Your load is open for offers again');
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusy(false);
  };

  if (loading) return <Spinner />;
  if (!load) return <EmptyState icon="empty" title="Load not found" message="This load may have been removed." />;

  const takingOffers = TAKING_OFFERS.includes(load.status) && !(load.expiresAt && new Date(load.expiresAt) <= new Date());
  const hasSide = (isShipper && isMyLoad) || isOwner;
  const twoColumns = layout.isDesktop && hasSide;
  // Offers still waiting on someone come first.
  const orderedQuotes = [...quotes].sort((a, b) => Number(isOpenQuote(b)) - Number(isOpenQuote(a)));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={twoColumns ? styles.columns : null}>
        <View style={twoColumns ? styles.mainColumn : null}>
          <Card>
            <View style={styles.row}>
              <Text style={styles.title}>{load.goodsType}</Text>
              <StatusBadge status={load.status} />
            </View>
            {load.description ? <Text style={styles.desc}>{load.description}</Text> : null}

            <LoadPhotosSection
              load={load}
              canEdit={isMyLoad && ['open', 'quoted', 'negotiating', 'expired'].includes(load.status)}
              onChanged={fetchAll}
            />

            <Detail label="Pickup" value={load.pickupLocation?.address} />
            <Detail label="Dropoff" value={load.dropoffLocation?.address} />
            {load.pickupDay ? <Detail label="Pickup Date" value={dayLabel(load.pickupDay)} /> : null}
            {load.distanceKm ? <Detail label="Distance" value={`About ${load.distanceKm} km by road`} /> : null}
            {load.weight ? <Detail label="Weight" value={formatKg(load.weight)} /> : null}
            {load.truckTypePreference && load.truckTypePreference !== 'any'
              ? <Detail label="Truck Type" value={truckTypeLabel(load.truckTypePreference)} />
              : null}
            {load.budgetEstimate ? <Detail label="Budget Estimate" value={formatCurrency(load.budgetEstimate)} /> : null}
            <Detail label="Posted" value={formatDate(load.createdAt)} />

            {isMyLoad && load.status === 'expired' && (
              <>
                <Text style={styles.expiredNote}>No booking was made before this load expired.</Text>
                <Button title="Relist Load" icon="refresh" onPress={handleRelist} loading={busy} />
              </>
            )}

            {isMyLoad && ['open', 'quoted', 'negotiating', 'expired'].includes(load.status) && (
              <Button title="Cancel Load" icon="close" variant="destructive" onPress={handleCancelLoad} loading={busy} />
            )}
          </Card>
        </View>

        {hasSide && (
          <View style={twoColumns ? styles.sideColumn : null}>
            {isShipper && isMyLoad && takingOffers && (
              <Card style={styles.findCard}>
                <View style={styles.findRow}>
                  <View style={styles.findIcon}>
                    <Icon name="truck" size={iconSize.lg} color={colors.primaryText} />
                  </View>
                  <View style={styles.findText}>
                    <Text style={styles.findTitle}>Choose a truck</Text>
                    <Text style={styles.findHint}>
                      See the trucks that can carry this load, ranked by fit, distance, rating and price, and send your price.
                    </Text>
                  </View>
                </View>
                <Button title="Choose a Truck" icon="truck" onPress={() => navigation.navigate('TruckMatches', { loadId })} />
              </Card>
            )}

            {isShipper && isMyLoad && (
              <View>
                <Text style={[styles.sectionTitle, twoColumns && !takingOffers && styles.sectionTitleSide]}>
                  {`Offers (${quotes.length})`}
                </Text>
                {quotes.length === 0 && (
                  <EmptyState icon="quote" title="No offers yet" message="Choose a truck to send your price, or wait for owners to quote." />
                )}
                {orderedQuotes.map((q) => (
                  <QuoteCard
                    key={q._id}
                    quote={q}
                    viewerSide="shipper"
                    busy={busy}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onCounter={handleCounter}
                  />
                ))}
              </View>
            )}

            {isOwner && (
              <OwnerQuoteSection
                load={load}
                myQuote={myQuote}
                kycStatus={user?.kycStatus}
                busy={busy}
                navigation={navigation}
                onSubmitted={fetchAll}
                onAccept={handleAccept}
                onReject={handleReject}
                onCounter={handleCounter}
              />
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const sideName = (by, viewerSide) => (by === viewerSide ? 'You' : by === 'owner' ? 'Owner' : 'Shipper');

// One negotiation, from either side's point of view. Only the party who did
// NOT make the offer on the table can accept or counter it; the other waits,
// and can withdraw. `canRespond` is false for an owner who isn't verified:
// they can still reject, but not make or accept an offer.
const QuoteCard = ({ quote, viewerSide, busy, onAccept, onReject, onCounter, canRespond = true }) => {
  const [countering, setCountering] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');

  const standing = standingOffer(quote);
  const history = offerHistory(quote);
  const isOpen = isOpenQuote(quote);
  const myTurn = isOpen && standing.by !== viewerSide;
  const request = openingSide(quote) === 'shipper';
  const offersLeft = history.length < MAX_OFFERS;

  const ownerName = quote.ownerId?.companyName
    || `${quote.ownerId?.firstName || ''} ${quote.ownerId?.lastName || ''}`.trim();
  const heading = viewerSide === 'shipper' ? ownerName : request ? 'Booking Request' : 'Your Quote';
  const kind = viewerSide === 'shipper'
    ? (request ? 'You requested this truck' : 'Quote from the owner')
    : (request ? 'A shipper asked for your truck' : 'You quoted on this load');

  const truck = quote.truckId && typeof quote.truckId === 'object' ? quote.truckId : null;
  const truckLine = truck
    ? [truckTypeLabel(truck.truckType), truck.capacity ? formatKg(truck.capacity) : null, truck.makeModel, truck.registrationNumber].filter(Boolean).join(' · ')
    : quote.truckType ? truckTypeLabel(quote.truckType) : null;

  const submitCounter = () => {
    if (!isWholePrice(counterPrice)) {
      notify('Invalid price', `Enter a whole number of rupees, at least ${formatCurrency(MIN_PRICE)}`);
      return;
    }
    setCountering(false);
    setCounterPrice('');
    onCounter(quote._id, Number(counterPrice));
  };

  const counterRule = viewerSide === 'shipper'
    ? `Offer less than ${formatCurrency(standing.price)}. Each side can move toward the other, up to ${MAX_OFFERS} offers in all.`
    : `Ask more than ${formatCurrency(standing.price)}. Each side can move toward the other, up to ${MAX_OFFERS} offers in all.`;

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.headingRow}>
          <Text style={styles.ownerName} numberOfLines={1}>{heading}</Text>
          {viewerSide === 'shipper' && quote.ownerId?.verified && <VerifiedBadge size={16} label="Verified owner" />}
        </View>
        <StatusBadge status={quote.status} />
      </View>
      <Text style={styles.quoteKind}>{kind}</Text>

      {viewerSide === 'shipper' && quote.ownerId?.totalRatings > 0 && (
        <View style={styles.ratingRow}>
          <Icon name="star" size={iconSize.xs} color={colors.warningText} />
          <Text style={styles.ratingText}>{`${quote.ownerId.rating.toFixed(1)} from ${quote.ownerId.totalRatings} ${quote.ownerId.totalRatings === 1 ? 'review' : 'reviews'}`}</Text>
        </View>
      )}

      {truckLine ? <Detail label="Truck" value={truckLine} verified={truck?.verified} verifiedLabel="Verified truck" /> : null}

      <Text style={styles.price}>{formatCurrency(standing.price)}</Text>
      <Text style={styles.counterNote}>
        {`Latest offer from ${standing.by === viewerSide ? 'you' : `the ${standing.by}`}`}
      </Text>

      {history.length > 1 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>{`Earlier offers (${history.length} of ${MAX_OFFERS})`}</Text>
          {history.slice(0, -1).map((offer, index) => (
            <View key={`${offer.by}-${index}`} style={styles.historyRow}>
              <Text style={styles.historyWho}>{sideName(offer.by, viewerSide)}</Text>
              <Text style={styles.historyPrice}>{formatCurrency(offer.price)}</Text>
            </View>
          ))}
        </View>
      )}

      {isOpen && !myTurn && (
        <>
          <View style={styles.waitingRow}>
            <Icon name="time" size={iconSize.xs} color={colors.textMuted} />
            <Text style={styles.waitingNote}>Waiting for the other party to respond to your offer.</Text>
          </View>
          <View style={styles.actionsRow}>
            <Button title="Withdraw" icon="close" variant="tertiary" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
          </View>
        </>
      )}

      {myTurn && !canRespond && (
        <>
          <View style={styles.waitingRow}>
            <Icon name="unverified" size={iconSize.xs} color={colors.warningText} />
            <Text style={styles.waitingNote}>
              Verify your identity to accept or counter this offer. You can still reject it.
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <Button title="Reject" icon="close" variant="destructive" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
          </View>
        </>
      )}

      {myTurn && canRespond && !countering && (
        <>
          {!offersLeft && (
            <Text style={styles.lastOffer}>This is the last offer in this negotiation. Accept or reject it.</Text>
          )}
          <View style={styles.actionsRow}>
            <Button title="Accept" icon="checkmark" onPress={() => onAccept(quote._id)} loading={busy} style={styles.actionButton} />
            {offersLeft && (
              <Button title="Counter" icon="counterOffer" variant="secondary" onPress={() => setCountering(true)} style={styles.actionButton} />
            )}
            <Button title="Reject" icon="close" variant="destructive" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
          </View>
        </>
      )}

      {myTurn && canRespond && countering && (
        <View>
          <Input
            label="Your Counter-Offer (Rs.)"
            value={counterPrice}
            onChangeText={setCounterPrice}
            keyboardType="numeric"
            placeholder={String(standing.price)}
            icon="price"
            helperText={counterRule}
          />
          <View style={styles.actionsRow}>
            <Button title="Send" icon="send" onPress={submitCounter} loading={busy} style={styles.actionButton} />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => { setCountering(false); setCounterPrice(''); }}
              style={styles.actionButton}
            />
          </View>
        </View>
      )}
    </Card>
  );
};

const Detail = ({ label, value, verified = false, verifiedLabel = 'Verified' }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelRow}>
      {!!DETAIL_ICON[label] && <Icon name={DETAIL_ICON[label]} size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />}
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <View style={styles.detailValueRow}>
      <Text style={styles.detailValue}>{value || '-'}</Text>
      {verified && <VerifiedBadge size={14} label={verifiedLabel} />}
    </View>
  </View>
);

const OwnerQuoteSection = ({ load, myQuote, kycStatus, busy, navigation, onSubmitted, onAccept, onReject, onCounter }) => {
  // Mirrors the server: owners must be verified to make or accept offers.
  const verified = kycStatus === 'approved';
  const canQuote = TAKING_OFFERS.includes(load.status) && !(myQuote && isOpenQuote(myQuote));

  if (myQuote && (isOpenQuote(myQuote) || !canQuote)) {
    return (
      <QuoteCard
        quote={myQuote}
        viewerSide="owner"
        busy={busy}
        onAccept={onAccept}
        onReject={onReject}
        onCounter={onCounter}
        canRespond={verified}
      />
    );
  }

  if (!canQuote) return null;

  if (!verified) {
    return (
      <VerificationPrompt
        kycStatus={kycStatus}
        message="Verify your identity to submit a quote on this load."
      />
    );
  }

  return <QuoteForm load={load} navigation={navigation} onSubmitted={onSubmitted} />;
};

const TruckChoice = ({ truck, selected, onPress }) => {
  const unavailable = Boolean(truck.unavailableReason);
  const label = `${truckTypeLabel(truck.truckType)} ${truck.registrationNumber}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: unavailable }}
      accessibilityLabel={label}
      style={[styles.truckChoice, selected && styles.truckChoiceSelected, unavailable && styles.truckChoiceUnavailable]}
    >
      <Icon name="truck" size={iconSize.md} color={unavailable ? colors.disabledText : selected ? colors.primaryText : colors.textMuted} />
      <View style={styles.truckChoiceText}>
        <View style={styles.headingRow}>
          <Text style={[styles.truckChoiceTitle, unavailable && styles.truckChoiceMuted]}>{label}</Text>
          {truck.verified && <VerifiedBadge size={14} label="Verified truck" />}
        </View>
        <Text style={styles.truckChoiceHint}>
          {unavailable
            ? truck.unavailableReason
            : [formatKg(truck.capacity), truck.askingPrice ? `your rates: ${formatCurrency(truck.askingPrice)}` : 'no rate set'].join(' · ')}
        </Text>
      </View>
      {selected && <Icon name="checkmark" size={iconSize.md} color={colors.primaryText} />}
    </Pressable>
  );
};

// An owner picks which of their trucks carries the load, and their price.
const QuoteForm = ({ load, navigation, onSubmitted }) => {
  const [trucks, setTrucks] = useState(null);
  const [truckId, setTruckId] = useState(null);
  const [price, setPrice] = useState('');
  const [priceEdited, setPriceEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/loads/${load._id}/my-trucks`)
      .then(({ data }) => {
        if (!active) return;
        setTrucks(data.trucks);
        const first = data.trucks.find((truck) => !truck.unavailableReason);
        if (first) {
          setTruckId(first._id);
          if (first.askingPrice) setPrice(String(first.askingPrice));
        }
      })
      .catch((error) => {
        if (!active) return;
        setTrucks([]);
        notify('Could not load your trucks', getErrorMessage(error));
      });
    return () => { active = false; };
  }, [load._id]);

  const chooseTruck = (truck) => {
    setTruckId(truck._id);
    if (!priceEdited && truck.askingPrice) setPrice(String(truck.askingPrice));
  };

  const handleSubmit = async () => {
    if (!truckId) {
      notify('Choose a truck', 'Pick which of your trucks will carry this load');
      return;
    }
    if (!isWholePrice(price)) {
      notify('Missing info', `Enter your price in whole rupees, at least ${formatCurrency(MIN_PRICE)}`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/quotes', { loadId: load._id, quotedPrice: Number(price), truckId });
      await onSubmitted();
    } catch (error) {
      notify('Could not send the quote', getErrorMessage(error));
    }
    setSubmitting(false);
  };

  const selected = trucks?.find((truck) => truck._id === truckId);
  const available = (trucks || []).filter((truck) => !truck.unavailableReason);

  return (
    <Card>
      <Text style={[styles.sectionTitle, styles.formTitle]}>Submit a Quote</Text>

      {!trucks ? (
        <Text style={styles.formHint}>Loading your trucks...</Text>
      ) : trucks.length === 0 ? (
        <>
          <Text style={styles.formHint}>Add a truck to your fleet to quote on loads.</Text>
          <Button title="Go to My Fleet" icon="fleet" onPress={() => navigation.navigate('Fleet')} />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Which truck will carry it?</Text>
          <View accessibilityRole="radiogroup" style={styles.truckChoices}>
            {trucks.map((truck) => (
              <TruckChoice key={truck._id} truck={truck} selected={truck._id === truckId} onPress={() => chooseTruck(truck)} />
            ))}
          </View>

          {available.length === 0 ? (
            <>
              <Text style={styles.formHint}>None of your trucks can carry this load right now.</Text>
              <Button title="Manage My Fleet" icon="fleet" variant="tertiary" onPress={() => navigation.navigate('Fleet')} />
            </>
          ) : (
            <>
              <Input
                label="Your Price (Rs.)"
                value={price}
                onChangeText={(value) => { setPrice(value); setPriceEdited(true); }}
                keyboardType="numeric"
                placeholder="e.g. 15000"
                icon="price"
                helperText={selected?.askingPrice
                  ? `Your rates come to ${formatCurrency(selected.askingPrice)} for this trip.`
                  : 'Set a rate per km on this truck to get a suggested price.'}
              />
              <Button title="Submit Quote" icon="quote" onPress={handleSubmit} loading={submitting} />
            </>
          )}
        </>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  mainColumn: { flex: 3, minWidth: 0 },
  sideColumn: { flex: 2, minWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...type.h2, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  desc: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: spacing.xs },
  detailLabel: { ...type.small, color: colors.textMuted },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, flexShrink: 1 },
  detailValue: { ...type.smallMedium, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  sectionTitle: { ...type.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  // In the side column the title sits level with the top of the load card.
  sectionTitleSide: { marginTop: spacing.sm },
  formTitle: { marginTop: 0 },

  findCard: { borderWidth: 1, borderColor: colors.primaryMuted },
  findRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  findIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findText: { flex: 1, minWidth: 0 },
  findTitle: { ...type.h3, color: colors.textPrimary },
  findHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, minWidth: 0 },
  ownerName: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  quoteKind: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
  ratingText: { ...type.small, color: colors.textSecondary },
  price: { ...type.h2, color: colors.primaryText, marginTop: spacing.sm },
  counterNote: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  history: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  historyTitle: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xxs },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  historyWho: { ...type.small, color: colors.textSecondary },
  historyPrice: { ...type.smallMedium, color: colors.textSecondary },
  waitingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: spacing.sm },
  waitingNote: { ...type.small, color: colors.textMuted, flex: 1 },
  lastOffer: { ...type.small, color: colors.warningText, marginTop: spacing.sm },
  expiredNote: { ...type.small, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1 },

  fieldLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  formHint: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  truckChoices: { gap: spacing.sm, marginBottom: spacing.lg },
  truckChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  truckChoiceSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  truckChoiceUnavailable: { backgroundColor: colors.surfaceMuted },
  truckChoiceText: { flex: 1, minWidth: 0 },
  truckChoiceTitle: { ...type.bodyMedium, color: colors.textPrimary },
  truckChoiceMuted: { color: colors.textMuted },
  truckChoiceHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
});

export default LoadDetailScreen;
