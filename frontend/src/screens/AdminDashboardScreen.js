import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import DocumentTile from '../components/kyc/DocumentTile';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { KYC_DOCUMENT_LABELS, KYC_ID_TYPE_LABELS } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { notify } from '../utils/alert';
import useScreenLayout from '../hooks/useScreenLayout';

// Mirrors the server: a rejection must tell the user what to fix.
const MIN_REASON_LENGTH = 5;

const STAT_ICON = {
  Users: 'people',
  Loads: 'load',
  Bookings: 'truckDelivery',
  'Pending KYC': 'pending',
};

const AdminDashboardScreen = () => {
  const [stats, setStats] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const layout = useScreenLayout('medium');

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
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.statsGrid}>
        <StatTile label="Users" value={stats?.userCount} />
        <StatTile label="Loads" value={stats?.loadCount} />
        <StatTile label="Bookings" value={stats?.bookingCount} />
        <StatTile label="Pending KYC" value={stats?.pendingKyc} highlight />
      </View>

      <Text style={styles.sectionTitle}>KYC Queue ({pendingUsers.length})</Text>
      {pendingUsers.length === 0 && (
        <EmptyState icon="verified" title="All caught up" message="No submissions waiting for review." />
      )}

      {pendingUsers.map((u) => {
        const reason = reasons[u._id] || '';
        const canReject = reason.trim().length >= MIN_REASON_LENGTH;
        return (
          <Card key={u._id}>
            <View style={styles.nameRow}>
              <Icon name="person" size={iconSize.sm} color={colors.textMuted} style={styles.nameIcon} />
              <Text style={styles.name}>{u.firstName} {u.lastName}</Text>
            </View>
            <Text style={styles.meta}>
              {[u.email, u.phone, u.role, u.companyName].filter(Boolean).join(' · ')}
            </Text>
            {u.idType ? <Text style={styles.meta}>Identity document: {KYC_ID_TYPE_LABELS[u.idType] || u.idType}</Text> : null}
            {u.submittedAt ? <Text style={styles.meta}>Submitted {formatDate(u.submittedAt)}</Text> : null}

            <View style={styles.documents}>
              {u.documents.map((doc) => (
                <DocumentTile key={doc._id} doc={doc} label={KYC_DOCUMENT_LABELS[doc.type] || doc.type} />
              ))}
            </View>

            <Input
              value={reason}
              onChangeText={(text) => setReasons((current) => ({ ...current, [u._id]: text }))}
              placeholder="Reason (required to reject, the user will see it)"
              multiline
              icon="document"
              containerStyle={styles.reasonInput}
            />

            <View style={styles.actionsRow}>
              <Button
                title="Approve"
                icon="checkmark"
                onPress={() => decide(u._id, 'approved')}
                loading={busyId === u._id}
                style={styles.actionButton}
              />
              <Button
                title="Reject"
                icon="close"
                variant="destructive"
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
    <View style={[styles.statIconWrap, highlight && styles.statIconWrapHighlight]}>
      <Icon name={STAT_ICON[label]} size={iconSize.md} color={highlight ? colors.warningText : colors.primaryText} />
    </View>
    <Text style={[styles.statValue, highlight && { color: colors.warningText }]}>{value ?? '-'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Card>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  statTile: { width: '47%', alignItems: 'center', paddingVertical: spacing.xl },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statIconWrapHighlight: { backgroundColor: colors.warningMuted },
  statValue: { ...type.display, fontSize: 26, color: colors.textPrimary },
  statLabel: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { ...type.h3, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameIcon: { marginRight: spacing.xs },
  name: { ...type.bodyMedium, color: colors.textPrimary },
  meta: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs, textTransform: 'capitalize' },
  documents: { marginTop: spacing.sm },
  reasonInput: { marginTop: spacing.sm, marginBottom: 0 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1 },
});

export default AdminDashboardScreen;
