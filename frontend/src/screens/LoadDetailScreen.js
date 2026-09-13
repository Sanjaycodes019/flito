import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import VerificationPrompt from '../components/kyc/VerificationPrompt';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { notify } from '../utils/alert';
import LoadPhotosSection from '../components/loads/LoadPhotosSection';

const DETAIL_ICON = {
  Pickup: 'pickup',
  Dropoff: 'dropoff',
  Weight: 'weight',
  'Truck Type': 'truck',
  'Budget Estimate': 'price',
  Posted: 'calendar',
  Truck: 'truck',
};

const LoadDetailScreen = ({ route, navigation }) => {
  const { loadId } = route.params;
  const { user } = useSelector((state) => state.auth);
  const [load, setLoad] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [myQuote, setMyQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

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
        const existing = mineRes.quotes.find((q) => (q.loadId?._id || q.loadId) === loadId);
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
      notify('Quote accepted', 'A booking has been created', () =>
        navigation.replace('BookingDetail', { bookingId: data.booking._id })
      );
    } catch (error) {
      notify('Error', getErrorMessage(error));
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
      notify('Error', getErrorMessage(error));
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
      notify('Load relisted', 'Your load is open for quotes again for the next 24 hours');
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusy(false);
  };

  if (loading) return <Spinner />;
  if (!load) return <EmptyState icon="empty" title="Load not found" message="This load may have been removed." />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
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
        {load.weight ? <Detail label="Weight" value={`${load.weight} kg`} /> : null}
        <Detail label="Truck Type" value={load.truckTypePreference} />
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

      {isShipper && isMyLoad && (
        <View>
          <Text style={styles.sectionTitle}>Quotes ({quotes.length})</Text>
          {quotes.length === 0 && (
            <EmptyState icon="quote" title="No quotes yet" message="Owners will submit offers here as they come in." />
          )}
          {quotes.map((q) => (
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
          onSubmitted={fetchAll}
          onAccept={handleAccept}
          onReject={handleReject}
          onCounter={handleCounter}
        />
      )}
    </ScrollView>
  );
};

// One quote in a negotiation, from either side's point of view. Only the party
// who did NOT make the standing offer can accept or counter it. The other side
// is waiting for a response. `canRespond` is false for an owner who isn't
// verified: they can still reject, but not make or accept an offer.
const QuoteCard = ({ quote, viewerSide, busy, onAccept, onReject, onCounter, showOwner = true, canRespond = true }) => {
  const [countering, setCountering] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');

  const standingPrice = quote.counterOfferPrice ?? quote.quotedPrice;
  const offerBy = quote.status === 'countered' ? quote.counterOfferBy : 'owner';
  const isOpen = ['pending', 'countered'].includes(quote.status);
  const myTurn = isOpen && offerBy !== viewerSide;

  const submitCounter = () => {
    const value = Number(counterPrice);
    if (!value || value <= 0) {
      notify('Invalid price', 'Enter a counter-offer amount greater than zero');
      return;
    }
    setCountering(false);
    setCounterPrice('');
    onCounter(quote._id, value);
  };

  return (
    <Card>
      <View style={styles.row}>
        {showOwner ? (
          <Text style={styles.ownerName}>
            {quote.ownerId?.companyName || `${quote.ownerId?.firstName || ''} ${quote.ownerId?.lastName || ''}`}
          </Text>
        ) : (
          <Text style={styles.ownerName}>Your Quote</Text>
        )}
        <StatusBadge status={quote.status} />
      </View>

      <Text style={styles.price}>{formatCurrency(standingPrice)}</Text>
      {quote.counterOfferPrice != null && (
        <Text style={styles.counterNote}>
          Countered by the {quote.counterOfferBy}, originally {formatCurrency(quote.quotedPrice)}
        </Text>
      )}
      {quote.truckType ? <Detail label="Truck" value={quote.truckType} /> : null}

      {isOpen && !myTurn && (
        <View style={styles.waitingRow}>
          <Icon name="time" size={iconSize.xs} color={colors.textMuted} />
          <Text style={styles.waitingNote}>Waiting for the other party to respond to your offer.</Text>
        </View>
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
        <View style={styles.actionsRow}>
          <Button title="Accept" icon="checkmark" onPress={() => onAccept(quote._id)} loading={busy} style={styles.actionButton} />
          <Button title="Counter" icon="counterOffer" variant="secondary" onPress={() => setCountering(true)} style={styles.actionButton} />
          <Button title="Reject" icon="close" variant="destructive" onPress={() => onReject(quote._id)} loading={busy} style={styles.actionButton} />
        </View>
      )}

      {myTurn && canRespond && countering && (
        <View>
          <Input
            label="Your Counter-Offer (Rs.)"
            value={counterPrice}
            onChangeText={setCounterPrice}
            keyboardType="numeric"
            placeholder={String(standingPrice)}
            icon="price"
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

const Detail = ({ label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelRow}>
      {!!DETAIL_ICON[label] && <Icon name={DETAIL_ICON[label]} size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />}
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue}>{value || '-'}</Text>
  </View>
);

const OwnerQuoteSection = ({ load, myQuote, kycStatus, busy, onSubmitted, onAccept, onReject, onCounter }) => {
  const [price, setPrice] = useState('');
  const [truckType, setTruckType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Mirrors the server: owners must be verified to make or accept offers.
  const verified = kycStatus === 'approved';
  const canQuote = ['open', 'quoted', 'negotiating'].includes(load.status) && !myQuote;

  const handleSubmit = async () => {
    if (!price) {
      notify('Missing info', 'Enter your quoted price');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/quotes', { loadId: load._id, quotedPrice: Number(price), truckType });
      await onSubmitted();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setSubmitting(false);
  };

  if (myQuote) {
    return (
      <View>
        <QuoteCard
          quote={myQuote}
          viewerSide="owner"
          busy={busy}
          onAccept={onAccept}
          onReject={onReject}
          onCounter={onCounter}
          showOwner={false}
          canRespond={verified}
        />
      </View>
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

  return (
    <Card>
      <Text style={styles.sectionTitle}>Submit a Quote</Text>
      <Input label="Your Price (Rs.)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 15000" icon="price" />
      <Input label="Truck Type" value={truckType} onChangeText={setTruckType} placeholder="e.g. 10-ton" icon="truck" />
      <Button title="Submit Quote" icon="quote" onPress={handleSubmit} loading={submitting} />
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.h2, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  desc: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: spacing.xs },
  detailLabel: { ...type.small, color: colors.textMuted },
  detailValue: { ...type.smallMedium, color: colors.textPrimary },
  sectionTitle: { ...type.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  ownerName: { ...type.bodyMedium, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  price: { ...type.h2, color: colors.primaryText, marginVertical: spacing.xs },
  counterNote: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  waitingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: spacing.sm },
  waitingNote: { ...type.small, color: colors.textMuted, flex: 1 },
  expiredNote: { ...type.small, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});

export default LoadDetailScreen;
