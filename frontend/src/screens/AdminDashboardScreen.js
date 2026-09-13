import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import DocumentTile from '../components/kyc/DocumentTile';
import { FLITO_COLORS } from '../utils/colors';
import { KYC_DOCUMENT_LABELS } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { notify } from '../utils/alert';

// Mirrors the server: a rejection must tell the user what to fix.
const MIN_REASON_LENGTH = 5;

const AdminDashboardScreen = () => {
  const [stats, setStats] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, kycRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/kyc/pending'),
      ]);
      setStats(statsRes.data.stats);
      setPendingUsers(kycRes.data.users);
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const decide = async (userId, decision) => {
    setBusyId(userId);
    try {
      await api.patch(`/admin/kyc/${userId}`, { decision, reason: reasons[userId] });
      setReasons((current) => ({ ...current, [userId]: '' }));
      await load();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusyId(null);
  };

  if (loading) return <Spinner />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.statsGrid}>
        <StatTile label="Users" value={stats?.userCount} />
        <StatTile label="Loads" value={stats?.loadCount} />
        <StatTile label="Bookings" value={stats?.bookingCount} />
        <StatTile label="Pending KYC" value={stats?.pendingKyc} highlight />
      </View>

      <Text style={styles.sectionTitle}>KYC Queue ({pendingUsers.length})</Text>
      {pendingUsers.length === 0 && <Text style={styles.empty}>No submissions waiting for review</Text>}

      {pendingUsers.map((u) => {
        const reason = reasons[u._id] || '';
        const canReject = reason.trim().length >= MIN_REASON_LENGTH;
        return (
          <Card key={u._id}>
            <Text style={styles.name}>{u.firstName} {u.lastName}</Text>
            <Text style={styles.meta}>
              {u.phone} · {u.role}{u.companyName ? ` · ${u.companyName}` : ''}
            </Text>
            {u.submittedAt ? <Text style={styles.meta}>Submitted {formatDate(u.submittedAt)}</Text> : null}

            <View style={styles.documents}>
              {u.documents.map((doc) => (
                <DocumentTile key={doc._id} doc={doc} label={KYC_DOCUMENT_LABELS[doc.type] || doc.type} />
              ))}
            </View>

            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={(text) => setReasons((current) => ({ ...current, [u._id]: text }))}
              placeholder="Reason — required to reject (the user will see it)"
              multiline
            />

            <View style={styles.actionsRow}>
              <Button
                title="Approve"
                onPress={() => decide(u._id, 'approved')}
                loading={busyId === u._id}
                style={styles.actionButton}
              />
              <Button
                title="Reject"
                variant="outline"
                onPress={() => decide(u._id, 'rejected')}
                loading={busyId === u._id}
                disabled={!canReject}
                style={styles.actionButton}
              />
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
};

const StatTile = ({ label, value, highlight }) => (
  <Card style={styles.statTile}>
    <Text style={[styles.statValue, highlight && { color: FLITO_COLORS.warning }]}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Card>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  statTile: { width: '47%', alignItems: 'center', paddingVertical: 20 },
  statValue: { fontSize: 26, fontWeight: '800', color: FLITO_COLORS.secondary },
  statLabel: { fontSize: 12, color: FLITO_COLORS.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginTop: 20, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600', color: FLITO_COLORS.secondary },
  meta: { fontSize: 12, color: FLITO_COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },
  documents: { marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontSize: 14,
    minHeight: 44,
  },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { flex: 1 },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 10, fontSize: 14 },
});

export default AdminDashboardScreen;
