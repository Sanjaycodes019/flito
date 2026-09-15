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
import { KYC_DOCUMENT_LABELS, KYC_ID_TYPE_LABELS, TRUCK_DOCUMENT_LABELS } from '../utils/constants';
import { bodyTypeLabel, formatDate, formatKg, getErrorMessage, truckTypeLabel } from '../utils/helpers';
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
  'Pending Trucks': 'truck',
};

// Approve, or reject with a reason, for one item in a review queue.
const ReviewActions = ({ id, reason, onReasonChange, busy, onDecide, audience }) => {
  const canReject = reason.trim().length >= MIN_REASON_LENGTH;
  return (
    <>
      <Input
        value={reason}
        onChangeText={onReasonChange}
        placeholder={`Reason (required to reject, the ${audience} will see it)`}
        multiline
        icon="document"
        containerStyle={styles.reasonInput}
      />
      <View style={styles.actionsRow}>
        <Button
          title="Approve"
          icon="checkmark"
          onPress={() => onDecide(id, 'approved')}
          loading={busy}
          style={styles.actionButton}
        />
        <Button
          title="Reject"
          icon="close"
          variant="destructive"
          onPress={() => onDecide(id, 'rejected')}
          loading={busy}
          disabled={!canReject}
          style={styles.actionButton}
        />
      </View>
    </>
  );
};

const AdminDashboardScreen = () => {
  const [stats, setStats] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingTrucks, setPendingTrucks] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const layout = useScreenLayout('medium');

  const load = useCallback(async () => {
    try {
      const [statsRes, kycRes, trucksRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/kyc/pending'),
        api.get('/admin/trucks/pending'),
      ]);
      setStats(statsRes.data.stats);
      setPendingUsers(kycRes.data.users);
      setPendingTrucks(trucksRes.data.trucks);
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

  const decide = (path) => async (id, decision) => {
    setBusyId(id);
    try {
      await api.patch(`${path}/${id}`, { decision, reason: reasons[id] });
      setReasons((current) => ({ ...current, [id]: '' }));
      await load();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusyId(null);
  };

  const setReason = (id) => (text) => setReasons((current) => ({ ...current, [id]: text }));

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
        <StatTile label="Pending Trucks" value={stats?.pendingTrucks} highlight />
      </View>

      <Text style={styles.sectionTitle}>KYC Queue ({pendingUsers.length})</Text>
      {pendingUsers.length === 0 && (
        <EmptyState icon="verified" title="All caught up" message="No submissions waiting for review." />
      )}

      {pendingUsers.map((u) => (
        <Card key={u._id}>
          <View style={styles.nameRow}>
            <Icon name="person" size={iconSize.sm} color={colors.textMuted} style={styles.nameIcon} />
            <Text style={styles.name}>{u.firstName} {u.lastName}</Text>
          </View>
          <Text style={styles.meta}>
            {[u.email, u.phone, u.role, u.companyName].filter(Boolean).join(' · ')}
          </Text>
          {u.identityDocuments?.length ? (
            <Text style={styles.meta}>
              Identity: {u.identityDocuments.map((idType) => KYC_ID_TYPE_LABELS[idType] || idType).join(', ')}
            </Text>
          ) : null}
          {u.submittedAt ? <Text style={styles.meta}>Submitted {formatDate(u.submittedAt)}</Text> : null}

          <View style={styles.documents}>
            {u.documents.map((doc) => (
              <DocumentTile key={doc._id} doc={doc} label={KYC_DOCUMENT_LABELS[doc.type] || doc.type} />
            ))}
          </View>

          <ReviewActions
            id={u._id}
            reason={reasons[u._id] || ''}
            onReasonChange={setReason(u._id)}
            busy={busyId === u._id}
            onDecide={decide('/admin/kyc')}
            audience="user"
          />
        </Card>
      ))}

      <Text style={styles.sectionTitle}>Truck Verification Queue ({pendingTrucks.length})</Text>
      {pendingTrucks.length === 0 && (
        <EmptyState icon="truck" title="No trucks waiting" message="Trucks sent for verification show up here." />
      )}

      {pendingTrucks.map((t) => {
        const ownerName = t.owner?.companyName || [t.owner?.firstName, t.owner?.lastName].filter(Boolean).join(' ');
        const papers = [
          t.bluebookRenewedUntil && `Bluebook tax until ${formatDate(t.bluebookRenewedUntil)}`,
          t.insurance?.validUntil && `Insurance until ${formatDate(t.insurance.validUntil)}${t.insurance.company ? ` (${t.insurance.company})` : ''}`,
          t.emissionTestValidUntil && `Green sticker until ${formatDate(t.emissionTestValidUntil)}`,
        ].filter(Boolean);
        return (
          <Card key={t._id}>
            <View style={styles.nameRow}>
              <Icon name="truck" size={iconSize.sm} color={colors.textMuted} style={styles.nameIcon} />
              <Text style={styles.name}>{t.registrationNumber}</Text>
            </View>
            <Text style={styles.detail}>
              {[truckTypeLabel(t.truckType), bodyTypeLabel(t.bodyType), t.capacity ? formatKg(t.capacity) : null, t.makeModel, t.year]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={styles.detail}>
              {`Owner: ${[ownerName, t.owner?.phone, t.owner?.email].filter(Boolean).join(' · ')}${t.owner?.verified ? ' (identity verified)' : ' (identity not verified)'}`}
            </Text>
            {t.chassisNumber || t.engineNumber ? (
              <Text style={styles.detail}>{`Chassis ${t.chassisNumber || '-'} · Engine ${t.engineNumber || '-'}`}</Text>
            ) : null}
            {papers.length ? <Text style={styles.detail}>{papers.join(' · ')}</Text> : null}
            {t.submittedAt ? <Text style={styles.detail}>{`Submitted ${formatDate(t.submittedAt)}`}</Text> : null}

            <View style={styles.documents}>
              {t.documents.map((doc) => (
                <DocumentTile key={doc._id} doc={doc} label={TRUCK_DOCUMENT_LABELS[doc.type] || doc.type} />
              ))}
            </View>

            <ReviewActions
              id={t._id}
              reason={reasons[t._id] || ''}
              onReasonChange={setReason(t._id)}
              busy={busyId === t._id}
              onDecide={decide('/admin/trucks')}
              audience="owner"
            />
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
  detail: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  documents: { marginTop: spacing.sm },
  reasonInput: { marginTop: spacing.sm, marginBottom: 0 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1 },
});

export default AdminDashboardScreen;
