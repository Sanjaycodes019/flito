import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import { FLITO_COLORS } from '../utils/colors';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { notify } from '../utils/alert';

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

  if (loading) return <Spinner />;
  if (!load) return <Text style={styles.empty}>Load not found</Text>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card>
        <View style={styles.row}>
          <Text style={styles.title}>{load.goodsType}</Text>
          <StatusBadge status={load.status} />
        </View>
        {load.description ? <Text style={styles.desc}>{load.description}</Text> : null}

        <Detail label="Pickup" value={load.pickupLocation?.address} />
        <Detail label="Dropoff" value={load.dropoffLocation?.address} />
        {load.weight ? <Detail label="Weight" value={`${load.weight} kg`} /> : null}
        <Detail label="Truck Type" value={load.truckTypePreference} />
        {load.budgetEstimate ? <Detail label="Budget Estimate" value={formatCurrency(load.budgetEstimate)} /> : null}
        <Detail label="Posted" value={formatDate(load.createdAt)} />

        {isMyLoad && ['open', 'quoted', 'negotiating'].includes(load.status) && (
          <Button title="Cancel Load" variant="outline" onPress={handleCancelLoad} loading={busy} />
        )}
      </Card>

      {isShipper && isMyLoad && (
        <View>
          <Text style={styles.sectionTitle}>Quotes ({quotes.length})</Text>
          {quotes.length === 0 && <Text style={styles.empty}>No quotes yet</Text>}
          {quotes.map((q) => (
            <Card key={q._id}>
              <View style={styles.row}>
                <Text style={styles.ownerName}>{q.ownerId?.firstName} {q.ownerId?.lastName}</Text>
                <StatusBadge status={q.status} />
              </View>
              <Text style={styles.price}>{formatCurrency(q.counterOfferPrice ?? q.quotedPrice)}</Text>
              {q.truckType ? <Detail label="Truck" value={q.truckType} /> : null}
              {q.status === 'pending' && (
                <View style={styles.actionsRow}>
                  <Button title="Accept" onPress={() => handleAccept(q._id)} loading={busy} style={styles.actionButton} />
                  <Button title="Reject" variant="outline" onPress={() => handleReject(q._id)} loading={busy} style={styles.actionButton} />
                </View>
              )}
            </Card>
          ))}
        </View>
      )}

      {isOwner && (
        <OwnerQuoteSection
          load={load}
          myQuote={myQuote}
          onSubmitted={fetchAll}
        />
      )}
    </ScrollView>
  );
};

const Detail = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || '—'}</Text>
  </View>
);

const OwnerQuoteSection = ({ load, myQuote, onSubmitted }) => {
  const [price, setPrice] = useState('');
  const [truckType, setTruckType] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      <Card>
        <Text style={styles.sectionTitle}>Your Quote</Text>
        <View style={styles.row}>
          <Text style={styles.price}>{formatCurrency(myQuote.counterOfferPrice ?? myQuote.quotedPrice)}</Text>
          <StatusBadge status={myQuote.status} />
        </View>
      </Card>
    );
  }

  if (!canQuote) return null;

  return (
    <Card>
      <Text style={styles.sectionTitle}>Submit a Quote</Text>
      <Text style={styles.label}>Your Price (Rs.)</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 15000" />
      <Text style={styles.label}>Truck Type</Text>
      <TextInput style={styles.input} value={truckType} onChangeText={setTruckType} placeholder="e.g. 10-ton" />
      <Button title="Submit Quote" onPress={handleSubmit} loading={submitting} />
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: FLITO_COLORS.secondary },
  desc: { fontSize: 14, color: FLITO_COLORS.textMuted, marginTop: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  detailLabel: { fontSize: 13, color: FLITO_COLORS.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: FLITO_COLORS.secondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginTop: 16, marginBottom: 8 },
  ownerName: { fontSize: 15, fontWeight: '600', color: FLITO_COLORS.secondary },
  price: { fontSize: 18, fontWeight: '700', color: FLITO_COLORS.primary, marginVertical: 6 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 20, fontSize: 14 },
});

export default LoadDetailScreen;
