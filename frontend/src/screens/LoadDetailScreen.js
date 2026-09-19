import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
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
import { formatCurrency, formatDate, formatKg, formatTrip, getErrorMessage, truckTypeLabel } from '../utils/helpers';
import { dayLabel } from '../utils/nepalDate';
import {
  MAX_OFFERS, isOpenQuote, offerHistory, openingSide, standingOffer,
} from '../utils/negotiation';
import api from '../services/api';
import { notify } from '../utils/alert';
import LoadPhotosSection from '../components/loads/LoadPhotosSection';
import useScreenLayout from '../hooks/useScreenLayout';

const TAKING_OFFERS = ['open', 'quoted', 'negotiating'];
const MIN_PRICE = 100;

const isWholePrice = (text) => /^\d+$/.test(text.trim()) && Number(text) >= MIN_PRICE;

const LoadDetailScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
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
      notify(t('loads:loadDetail.errorTitle'), getErrorMessage(error));
    }
  }, [loadId, isShipper, isOwner, isMyLoad, t]);

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
      notify(t('loads:loadDetail.offerAcceptedTitle'), t('loads:loadDetail.offerAcceptedMessage'), () =>
        navigation.replace('BookingDetail', { bookingId: data.booking._id })
      );
    } catch (error) {
      notify(t('loads:loadDetail.couldNotAcceptTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleReject = async (quoteId) => {
    setBusy(true);
    try {
      await api.patch(`/quotes/${quoteId}/reject`);
      await fetchAll();
    } catch (error) {
      notify(t('loads:loadDetail.errorTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleCounter = async (quoteId, counterOfferPrice) => {
    setBusy(true);
    try {
      await api.patch(`/quotes/${quoteId}/counter`, { counterOfferPrice });
      await fetchAll();
    } catch (error) {
      notify(t('loads:loadDetail.couldNotSendCounterOfferTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleCancelLoad = async () => {
    setBusy(true);
    try {
      await api.patch(`/loads/${loadId}/cancel`);
      await fetchAll();
    } catch (error) {
      notify(t('loads:loadDetail.errorTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleRelist = async () => {
    setBusy(true);
    try {
      await api.patch(`/loads/${loadId}/relist`);
      await fetchAll();
      notify(t('loads:loadDetail.loadRelistedTitle'), t('loads:loadDetail.loadRelistedMessage'));
    } catch (error) {
      notify(t('loads:loadDetail.errorTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  if (loading) return <Spinner />;
  if (!load) return <EmptyState icon="empty" title={t('loads:loadDetail.loadNotFoundTitle')} message={t('loads:loadDetail.loadNotFoundMessage')} />;

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

            <Detail icon="pickup" label={t('loads:common.pickup')} value={load.pickupLocation?.address} />
            <Detail icon="dropoff" label={t('loads:common.dropoff')} value={load.dropoffLocation?.address} />
            {load.pickupDay ? <Detail icon="calendar" label={t('loads:loadDetail.pickupDateLabel')} value={dayLabel(load.pickupDay)} /> : null}
            {load.distanceKm ? <Detail icon="route" label={t('loads:loadDetail.distanceLabel')} value={formatTrip(t, load)} /> : null}
            {load.weight ? <Detail icon="weight" label={t('loads:common.weight')} value={formatKg(load.weight)} /> : null}
            {load.truckTypePreference && load.truckTypePreference !== 'any'
              ? <Detail icon="truck" label={t('loads:loadDetail.truckTypeLabel')} value={truckTypeLabel(load.truckTypePreference, t)} />
              : null}
            {load.budgetEstimate ? <Detail icon="price" label={t('loads:loadDetail.budgetEstimateLabel')} value={formatCurrency(load.budgetEstimate)} /> : null}
            <Detail icon="calendar" label={t('loads:loadDetail.postedLabel')} value={formatDate(load.createdAt)} />

            {isMyLoad && load.status === 'expired' && (
              <>
                <Text style={styles.expiredNote}>{t('loads:loadDetail.expiredNote')}</Text>
                <Button title={t('loads:loadDetail.relistLoadButton')} icon="refresh" onPress={handleRelist} loading={busy} />
              </>
            )}

            {isMyLoad && ['open', 'quoted', 'negotiating', 'expired'].includes(load.status) && (
              <Button title={t('loads:loadDetail.cancelLoadButton')} icon="close" variant="destructive" onPress={handleCancelLoad} loading={busy} />
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
                    <Text style={styles.findTitle}>{t('loads:loadDetail.chooseATruckTitle')}</Text>
                    <Text style={styles.findHint}>
                      {t('loads:loadDetail.chooseATruckHint')}
                    </Text>
                  </View>
                </View>
                <Button title={t('loads:loadDetail.chooseATruckButton')} icon="truck" onPress={() => navigation.navigate('TruckMatches', { loadId })} />
              </Card>
            )}

            {isShipper && isMyLoad && (
              <View>
                <Text style={[styles.sectionTitle, twoColumns && !takingOffers && styles.sectionTitleSide]}>
                  {t('loads:loadDetail.offersCount', { count: quotes.length })}
                </Text>
                {quotes.length === 0 && (
                  <EmptyState icon="quote" title={t('loads:loadDetail.noOffersYetTitle')} message={t('loads:loadDetail.noOffersYetMessage')} />
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

const sideName = (by, viewerSide, t) => (by === viewerSide
  ? t('loads:loadDetail.sideNames.you')
  : by === 'owner' ? t('loads:loadDetail.sideNames.owner') : t('loads:loadDetail.sideNames.shipper'));

// One negotiation, from either side's point of view. Only the party who did
// NOT make the offer on the table can accept or counter it; the other waits,
// and can withdraw. `canRespond` is false for an owner who isn't verified:
// they can still reject, but not make or accept an offer.
const QuoteCard = ({ quote, viewerSide, busy, onAccept, onReject, onCounter, canRespond = true }) => {
  const { t } = useTranslation();
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
  const heading = viewerSide === 'shipper' ? ownerName : request ? t('loads:loadDetail.bookingRequestHeading') : t('loads:loadDetail.yourQuoteHeading');
  const kind = viewerSide === 'shipper'
    ? (request ? t('loads:loadDetail.kind.youRequestedThisTruck') : t('loads:loadDetail.kind.quoteFromOwner'))
    : (request ? t('loads:loadDetail.kind.shipperAskedForYourTruck') : t('loads:loadDetail.kind.youQuotedOnThisLoad'));

  const truck = quote.truckId && typeof quote.truckId === 'object' ? quote.truckId : null;
  const truckLine = truck
    ? [truckTypeLabel(truck.truckType, t), truck.capacity ? formatKg(truck.capacity) : null, truck.makeModel, truck.registrationNumber].filter(Boolean).join(' · ')
    : quote.truckType ? truckTypeLabel(quote.truckType, t) : null;

  const submitCounter = () => {
    if (!isWholePrice(counterPrice)) {
      notify(t('loads:loadDetail.invalidPriceTitle'), t('loads:loadDetail.invalidPriceMessage', { min: formatCurrency(MIN_PRICE) }));
      return;
    }
    setCountering(false);
    setCounterPrice('');
    onCounter(quote._id, Number(counterPrice));
  };

  const counterRule = viewerSide === 'shipper'
    ? t('loads:loadDetail.counterRuleLess', { price: formatCurrency(standing.price), max: MAX_OFFERS })
    : t('loads:loadDetail.counterRuleMore', { price: formatCurrency(standing.price), max: MAX_OFFERS });

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.headingRow}>
          <Text style={styles.ownerName} numberOfLines={1}>{heading}</Text>
          {viewerSide === 'shipper' && quote.ownerId?.verified && <VerifiedBadge size={16} label={t('loads:common.verifiedOwner')} />}
        </View>
        <StatusBadge status={quote.status} />
      </View>
      <Text style={styles.quoteKind}>{kind}</Text>

      {viewerSide === 'shipper' && quote.ownerId?.totalRatings > 0 && (
        <View style={styles.ratingRow}>
          <Icon name="star" size={iconSize.xs} color={colors.warningText} />
          <Text style={styles.ratingText}>
            {t('loads:loadDetail.ratingFromReviews', { rating: quote.ownerId.rating.toFixed(1), count: quote.ownerId.totalRatings })}
          </Text>
        </View>
      )}

      {truckLine ? <Detail icon="truck" label={t('loads:loadDetail.truckLabel')} value={truckLine} verified={truck?.verified} verifiedLabel={t('loads:common.verifiedTruck')} /> : null}

      <Text style={styles.price}>{formatCurrency(standing.price)}</Text>
      <Text style={styles.counterNote}>
        {t('loads:loadDetail.latestOfferFrom', {
          side: standing.by === viewerSide ? t('loads:loadDetail.you') : t(`loads:loadDetail.the${standing.by === 'owner' ? 'Owner' : 'Shipper'}`),
        })}
      </Text>

      {history.length > 1 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>{t('loads:loadDetail.earlierOffers', { count: history.length, max: MAX_OFFERS })}</Text>
          {history.slice(0, -1).map((offer, index) => (
            <View key={`${offer.by}-${index}`} style={styles.historyRow}>
              <Text style={styles.historyWho}>{sideName(offer.by, viewerSide, t)}</Text>
              <Text style={styles.historyPrice}>{formatCurrency(offer.price)}</Text>
            </View>
          ))}
        </View>
      )}

      {isOpen && !myTurn && (
        <>
          <View style={styles.waitingRow}>
            <Icon name="time" size={iconSize.xs} color={colors.textMuted} />
            <Text style={styles.waitingNote}>{t('loads:loadDetail.waitingForOtherParty')}</Text>
          </View>
          <View style={styles.actionsRow}>
            <Button title={t('loads:loadDetail.withdrawButton')} icon="close" variant="tertiary" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
          </View>
        </>
      )}

      {myTurn && !canRespond && (
        <>
          <View style={styles.waitingRow}>
            <Icon name="unverified" size={iconSize.xs} color={colors.warningText} />
            <Text style={styles.waitingNote}>
              {t('loads:loadDetail.verifyToRespond')}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <Button title={t('loads:loadDetail.rejectButton')} icon="close" variant="destructive" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
          </View>
        </>
      )}

      {myTurn && canRespond && !countering && (
        <>
          {!offersLeft && (
            <Text style={styles.lastOffer}>{t('loads:loadDetail.lastOfferNote')}</Text>
          )}
          <View style={styles.actionsRow}>
            <Button title={t('loads:loadDetail.acceptButton')} icon="checkmark" onPress={() => onAccept(quote._id)} loading={busy} style={styles.actionButton} />
            {offersLeft && (
              <Button title={t('loads:loadDetail.counterButton')} icon="counterOffer" variant="secondary" onPress={() => setCountering(true)} style={styles.actionButton} />
            )}
            <Button title={t('loads:loadDetail.rejectButton')} icon="close" variant="destructive" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
          </View>
        </>
      )}

      {myTurn && canRespond && countering && (
        <View>
          <Input
            label={t('loads:loadDetail.counterOfferLabel')}
            value={counterPrice}
            onChangeText={setCounterPrice}
            keyboardType="numeric"
            placeholder={String(standing.price)}
            icon="price"
            helperText={counterRule}
          />
          <View style={styles.actionsRow}>
            <Button title={t('loads:loadDetail.sendButton')} icon="send" onPress={submitCounter} loading={busy} style={styles.actionButton} />
            <Button
              title={t('common:actions.cancel')}
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

const Detail = ({ icon, label, value, verified = false, verifiedLabel }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabelRow}>
        {!!icon && <Icon name={icon} size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />}
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <View style={styles.detailValueRow}>
        <Text style={styles.detailValue}>{value || '-'}</Text>
        {verified && <VerifiedBadge size={14} label={verifiedLabel || t('common:verifiedBadge.label')} />}
      </View>
    </View>
  );
};

const OwnerQuoteSection = ({ load, myQuote, kycStatus, busy, navigation, onSubmitted, onAccept, onReject, onCounter }) => {
  const { t } = useTranslation();
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
        message={t('loads:loadDetail.verifyToQuoteMessage')}
      />
    );
  }

  return <QuoteForm load={load} navigation={navigation} onSubmitted={onSubmitted} />;
};

const TruckChoice = ({ truck, selected, onPress }) => {
  const { t } = useTranslation();
  const unavailable = Boolean(truck.unavailableReason);
  const label = `${truckTypeLabel(truck.truckType, t)} ${truck.registrationNumber}`;
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
          {truck.verified && <VerifiedBadge size={14} label={t('loads:common.verifiedTruck')} />}
        </View>
        <Text style={styles.truckChoiceHint}>
          {unavailable
            ? truck.unavailableReason
            : [formatKg(truck.capacity), truck.askingPrice ? t('loads:loadDetail.yourRatesShort', { price: formatCurrency(truck.askingPrice) }) : t('loads:loadDetail.noRateSet')].join(' · ')}
        </Text>
      </View>
      {selected && <Icon name="checkmark" size={iconSize.md} color={colors.primaryText} />}
    </Pressable>
  );
};

// An owner picks which of their trucks carries the load, and their price.
const QuoteForm = ({ load, navigation, onSubmitted }) => {
  const { t } = useTranslation();
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
        notify(t('loads:loadDetail.couldNotLoadYourTrucksTitle'), getErrorMessage(error));
      });
    return () => { active = false; };
  }, [load._id, t]);

  const chooseTruck = (truck) => {
    setTruckId(truck._id);
    if (!priceEdited && truck.askingPrice) setPrice(String(truck.askingPrice));
  };

  const handleSubmit = async () => {
    if (!truckId) {
      notify(t('loads:loadDetail.chooseATruckAlertTitle'), t('loads:loadDetail.chooseATruckAlertMessage'));
      return;
    }
    if (!isWholePrice(price)) {
      notify(t('loads:loadDetail.missingInfoTitle'), t('loads:loadDetail.missingInfoMessage', { min: formatCurrency(MIN_PRICE) }));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/quotes', { loadId: load._id, quotedPrice: Number(price), truckId });
      await onSubmitted();
    } catch (error) {
      notify(t('loads:loadDetail.couldNotSendQuoteTitle'), getErrorMessage(error));
    }
    setSubmitting(false);
  };

  const selected = trucks?.find((truck) => truck._id === truckId);
  const available = (trucks || []).filter((truck) => !truck.unavailableReason);

  return (
    <Card>
      <Text style={[styles.sectionTitle, styles.formTitle]}>{t('loads:loadDetail.submitAQuoteTitle')}</Text>

      {!trucks ? (
        <Text style={styles.formHint}>{t('loads:loadDetail.loadingYourTrucks')}</Text>
      ) : trucks.length === 0 ? (
        <>
          <Text style={styles.formHint}>{t('loads:loadDetail.addTruckToFleetHint')}</Text>
          <Button title={t('loads:loadDetail.goToMyFleetButton')} icon="fleet" onPress={() => navigation.navigate('Fleet')} />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>{t('loads:loadDetail.whichTruckLabel')}</Text>
          <View accessibilityRole="radiogroup" style={styles.truckChoices}>
            {trucks.map((truck) => (
              <TruckChoice key={truck._id} truck={truck} selected={truck._id === truckId} onPress={() => chooseTruck(truck)} />
            ))}
          </View>

          {available.length === 0 ? (
            <>
              <Text style={styles.formHint}>{t('loads:loadDetail.noSuitableTruckHint')}</Text>
              <Button title={t('loads:loadDetail.manageMyFleetButton')} icon="fleet" variant="tertiary" onPress={() => navigation.navigate('Fleet')} />
            </>
          ) : (
            <>
              <Input
                label={t('loads:loadDetail.yourPriceLabel')}
                value={price}
                onChangeText={(value) => { setPrice(value); setPriceEdited(true); }}
                keyboardType="numeric"
                placeholder={t('loads:loadDetail.yourPricePlaceholder')}
                icon="price"
                helperText={selected?.askingPrice
                  ? t('loads:loadDetail.yourRatesForTrip', { price: formatCurrency(selected.askingPrice) })
                  : t('loads:loadDetail.setRatePerKmHint')}
              />
              <Button title={t('loads:loadDetail.submitQuoteButton')} icon="quote" onPress={handleSubmit} loading={submitting} />
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
