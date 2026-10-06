import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import Avatar from '../../components/common/Avatar';
import PayoutMethodsManager from '../../components/payments/PayoutMethodsManager';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, shadow, themedStyles } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import { formatDayKey } from '../../utils/nepalDate';
import { confirmAction, notify } from '../../utils/alert';
import {
  getCommissionOverview, confirmCommissionPayment, rejectCommissionPayment, platformAccountsApi,
} from '../../services/commission';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, Pill, ActionRow } from '../components/AdminCard';
import useAdminStats, { refreshAdminStats } from '../useAdminStats';
import { openAdminRecord } from '../records';

// Mirrors the server: a rejection must tell the owner what is wrong.
const MIN_REASON_LENGTH = 5;

const STATUS_PILLS = {
  reported: { tone: 'warning', icon: 'time' },
  confirmed: { tone: 'success', icon: 'success' },
  rejected: { tone: 'error', icon: 'error' },
};

const FILTER_GROUPS = [
  {
    key: 'status',
    icon: 'info',
    labelKey: 'admin:filters.status',
    allowAll: false,
    options: ['reported', 'confirmed', 'rejected'].map((value) => ({ value, labelKey: `common:status.${value}` })),
  },
];

const Total = ({ label, value, detail, tone }) => (
  <View style={styles.total}>
    <Text style={styles.totalLabel}>{label}</Text>
    <Text style={[styles.totalValue, tone && styles[`tone_${tone}`]]} numberOfLines={1}>{value}</Text>
    {detail ? <Text style={styles.totalDetail}>{detail}</Text> : null}
  </View>
);

const Panel = ({ icon, title, hint, children }) => (
  <View style={styles.panel}>
    <View style={styles.panelHeader}>
      <Icon name={icon} size={iconSize.md} color={colors.primaryText} />
      <Text style={styles.panelTitle} accessibilityRole="header">{title}</Text>
    </View>
    {hint ? <Text style={styles.panelHint}>{hint}</Text> : null}
    {children}
  </View>
);

// Totals, the owners who owe most, and FLITO's own accounts, above the list
// of payments. Refetched whenever the count of payments to check changes, so
// confirming one updates the totals too.
const CommissionOverview = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const stats = useAdminStats({ passive: true });
  const [overview, setOverview] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await getCommissionOverview());
      setFailed(false);
    } catch (error) {
      setFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, stats?.pendingCommissionPayments]);

  const totals = overview?.totals;
  return (
    <View style={styles.overview}>
      {failed ? <Text style={styles.muted}>{t('admin:commission.loadFailed')}</Text> : null}
      {totals ? (
        <View style={styles.totals}>
          <Total label={t('admin:commission.owed')} value={formatCurrency(totals.owed)} />
          <Total
            label={t('admin:commission.overdue')}
            value={formatCurrency(totals.overdue)}
            detail={t('admin:commission.ownersOverdue', { count: totals.ownersOverdue })}
            tone={totals.overdue > 0 ? 'error' : null}
          />
          <Total
            label={t('admin:commission.toCheck')}
            value={String(totals.awaitingCount)}
            detail={formatCurrency(totals.awaitingAmount)}
            tone={totals.awaitingCount ? 'warning' : null}
          />
          <Total label={t('admin:commission.received')} value={formatCurrency(totals.paid)} tone="success" />
        </View>
      ) : null}

      <View style={styles.panels}>
        <Panel icon="people" title={t('admin:commission.owingTitle')}>
          {overview?.owners.length ? overview.owners.map((row, index) => (
            <Pressable
              key={row.owner._id}
              onPress={() => openAdminRecord(navigation, 'user', row.owner._id)}
              accessibilityRole="button"
              accessibilityLabel={row.owner.name || ''}
              style={({ pressed }) => [styles.owner, index > 0 && styles.ownerRule, pressed && styles.pressed]}
            >
              <Avatar uri={row.owner.avatarUrl} role="owner" size={36} />
              <View style={styles.ownerText}>
                <Text style={styles.ownerName} numberOfLines={1}>{row.owner.companyName || row.owner.name}</Text>
                <Text style={styles.ownerDetail} numberOfLines={2}>
                  {[
                    t('admin:commission.owes', { amount: formatCurrency(row.balance) }),
                    row.overdue ? t('admin:commission.pastDue', { amount: formatCurrency(row.overdue) }) : null,
                    !row.overdue && row.dueDay ? t('admin:commission.dueBy', { date: formatDayKey(row.dueDay) }) : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {row.blocked ? <Pill tone="error" icon="prohibited">{t('admin:commission.blocked')}</Pill> : null}
              <Icon name="forward" size={iconSize.md} color={colors.textMuted} />
            </Pressable>
          )) : <Text style={styles.muted}>{overview ? t('admin:commission.owingEmpty') : ''}</Text>}
        </Panel>

        <Panel icon="bank" title={t('admin:commission.accountsTitle')} hint={t('admin:commission.accountsHint')}>
          <PayoutMethodsManager
            api={platformAccountsApi}
            heading={false}
            copy={{
              emptyTitle: t('admin:commission.accountsEmptyTitle'),
              emptyText: t('admin:commission.accountsEmptyText'),
              savedMessage: t('admin:commission.accountsSaved'),
              removeMessage: t('admin:commission.accountsRemove'),
            }}
          />
        </Panel>
      </View>

      <Text style={styles.listTitle} accessibilityRole="header">{t('admin:commission.paymentsTitle')}</Text>
    </View>
  );
};

// One payment an owner recorded, with its proof, and, while it waits, the
// buttons to say whether it reached FLITO's account.
const PaymentCard = ({ payment, list, onProof }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const pill = STATUS_PILLS[payment.status];
  const name = payment.owner?.companyName || payment.owner?.name || '';

  const done = async (action) => {
    setBusy(true);
    try {
      await action();
      await list.refresh();
      refreshAdminStats();
    } catch (error) {
      notify(t('admin:common.error'), getErrorMessage(error));
    }
    setBusy(false);
  };

  const confirm = () => confirmAction({
    title: t('admin:commission.confirmTitle', { amount: formatCurrency(payment.amount) }),
    message: t('admin:commission.confirmMessage'),
    confirmLabel: t('admin:commission.confirm'),
    onConfirm: () => done(() => confirmCommissionPayment(payment._id)),
  });

  return (
    <AdminCard
      person={name}
      title={formatCurrency(payment.amount)}
      subtitle={name}
      badges={<Pill tone={pill.tone} icon={pill.icon}>{t(`common:status.${payment.status}`)}</Pill>}
      onPress={payment.owner?._id ? () => openAdminRecord(navigation, 'user', payment.owner._id) : undefined}
      footer={payment.status === 'reported' ? (
        <>
          <Input
            value={reason}
            onChangeText={setReason}
            placeholder={t('admin:commission.rejectPlaceholder')}
            icon="document"
            containerStyle={styles.reason}
          />
          <ActionRow>
            <Button key="confirm" title={t('admin:commission.confirm')} icon="checkmark" onPress={confirm} loading={busy} />
            <Button
              key="reject"
              title={t('admin:commission.reject')}
              icon="close"
              variant="destructive"
              onPress={() => done(() => rejectCommissionPayment(payment._id, reason.trim()))}
              loading={busy}
              disabled={reason.trim().length < MIN_REASON_LENGTH}
            />
          </ActionRow>
        </>
      ) : null}
    >
      <Fact icon="wallet" label={t('admin:commission.paidTo')}>{payment.paidTo || t(`payments:kinds.${payment.method}`, payment.method)}</Fact>
      <Fact icon="receipt" label={t('admin:commission.reference')}>{payment.transactionId}</Fact>
      <Fact icon="document" label={t('admin:commission.note')} lines={2}>{payment.note}</Fact>
      <Fact icon="time" label={t('admin:commission.sent')}>{formatDate(payment.createdAt)}</Fact>
      <Fact icon="person">{payment.reviewedBy ? t('admin:commission.checkedBy', { name: payment.reviewedBy }) : null}</Fact>
      <Fact icon="warning" label={t('admin:commission.reason')} lines={2} tone="error">{payment.rejectionReason}</Fact>
      {payment.proofUrl ? (
        <Button title={t('admin:commission.proof')} icon="image" size="sm" variant="ghost" onPress={() => onProof(payment.proofUrl)} style={styles.proofLink} />
      ) : null}
    </AdminCard>
  );
};

const CommissionScreen = () => {
  const { t } = useTranslation();
  const [proofUrl, setProofUrl] = useState(null);

  return (
    <>
      <ResourceScreen
        page="commission"
        endpoint="/admin/commission/payments"
        itemsKey="payments"
        filterGroups={FILTER_GROUPS}
        initialFilters={{ status: 'reported' }}
        emptyIcon="receipt"
        header={<CommissionOverview />}
        renderItem={(payment, list) => <PaymentCard payment={payment} list={list} onProof={setProofUrl} />}
      />
      <Modal visible={Boolean(proofUrl)} title={t('admin:commission.proofTitle')} onClose={() => setProofUrl(null)}>
        {proofUrl ? <Image source={{ uri: proofUrl }} style={styles.proofLarge} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
      </Modal>
    </>
  );
};

const styles = themedStyles(() => ({
  overview: { marginBottom: spacing.md },
  muted: { ...type.small, color: colors.textMuted },
  pressed: { opacity: 0.8 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  total: { flexGrow: 1, flexBasis: 160, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.level1 },
  totalLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted },
  totalValue: { ...type.h2, color: colors.textPrimary },
  totalDetail: { ...type.small, color: colors.textMuted },
  tone_error: { color: colors.errorText },
  tone_warning: { color: colors.warningText },
  tone_success: { color: colors.successText },

  panels: { gap: spacing.lg },
  panel: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.level1 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  panelTitle: { ...type.h3, color: colors.textPrimary },
  panelHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs, marginBottom: spacing.sm },
  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  ownerRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  ownerText: { flex: 1, minWidth: 0 },
  ownerName: { ...type.bodyMedium, color: colors.textPrimary },
  ownerDetail: { ...type.small, color: colors.textMuted },
  listTitle: { ...type.h3, color: colors.textPrimary, marginTop: spacing.xl },

  reason: { marginTop: spacing.sm, marginBottom: 0 },
  proofLink: { alignSelf: 'flex-start', marginTop: spacing.xs },
  proofLarge: { width: '100%', height: 420 },
}));

export default CommissionScreen;
