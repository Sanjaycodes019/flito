import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import PayoutMethodCard from '../payments/PayoutMethodCard';
import RecordPaymentModal from '../payments/RecordPaymentModal';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import { formatBsMonth } from '../../utils/nepalDate';
import { confirmAction, notify } from '../../utils/alert';
import socketService from '../../services/socket';
import {
  getBookingPayments, recordBookingPayment, confirmBookingPayment, disputeBookingPayment,
} from '../../services/payments';

const Stat = ({ label, value, tone }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, tone && styles[`tone_${tone}`]]} numberOfLines={1}>{value}</Text>
  </View>
);

const PaymentRow = ({ payment, first, canAnswer, busy, onConfirm, onDispute, onProof }) => {
  const { t } = useTranslation();
  const how = payment.paidTo || t(`payments:kinds.${payment.method}`, payment.method);
  return (
    <View style={[styles.payment, !first && styles.paymentRule]}>
      <View style={styles.paymentTop}>
        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
        <StatusBadge status={payment.status} />
      </View>
      <Text style={styles.paymentMeta}>
        {[how, payment.transactionId && t('payments:booking.reference', { id: payment.transactionId }), formatDate(payment.createdAt)]
          .filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.paymentBy}>{t(`payments:booking.by.${payment.recordedBy}`)}</Text>
      {payment.note ? <Text style={styles.paymentNote}>{payment.note}</Text> : null}
      {payment.status === 'disputed' && payment.disputeReason ? (
        <Text style={styles.paymentDispute}>{t('payments:booking.disputeReason', { reason: payment.disputeReason })}</Text>
      ) : null}
      {payment.proofUrl ? (
        <Button title={t('payments:booking.viewProof')} icon="image" size="sm" variant="ghost" onPress={() => onProof(payment.proofUrl)} style={styles.proofLink} />
      ) : null}
      {canAnswer ? (
        <View style={styles.answer}>
          <Text style={styles.answerQuestion}>{t('payments:booking.toConfirm')}</Text>
          <View style={styles.answerButtons}>
            <Button title={t('payments:booking.confirmReceived')} icon="checkmark" size="sm" onPress={() => onConfirm(payment)} loading={busy} style={styles.fill} />
            <Button title={t('payments:booking.notReceived')} icon="close" size="sm" variant="tertiary" onPress={() => onDispute(payment)} style={styles.fill} />
          </View>
        </View>
      ) : null}
    </View>
  );
};

// Payment on a booking, for its shipper and owner. The shipper sees the
// owner's accounts and QR codes, pays with their own bank app or wallet, and
// says so here; the owner confirms each payment reached them. Nothing counts
// as paid until the owner confirms it.
const PaymentSection = ({ bookingId, ownerName }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [disputing, setDisputing] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [proofUrl, setProofUrl] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await getBookingPayments(bookingId));
      setFailed(false);
    } catch (error) {
      setFailed(true);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // The other side answering, or paying, shows up without a refresh.
  useEffect(() => {
    const onUpdate = ({ bookingId: id }) => { if (String(id) === String(bookingId)) load(); };
    socketService.on('booking-payment-updated', onUpdate);
    return () => socketService.off('booking-payment-updated', onUpdate);
  }, [bookingId, load]);

  if (failed) {
    return (
      <Card>
        <SectionTitle title={t('payments:booking.title')} />
        <Text style={styles.muted}>{t('payments:booking.loadFailed')}</Text>
        <Button title={t('payments:booking.retry')} icon="refresh" size="sm" variant="tertiary" onPress={load} />
      </Card>
    );
  }
  if (!data) return null;

  const { party, summary, payTo, payments, commission } = data;
  const isOwner = party === 'owner';
  const fullyPaid = summary.total > 0 && summary.due === 0;
  const canRecord = summary.due - (isOwner ? 0 : summary.awaitingConfirmation) > 0;

  const submitPayment = async (fields, proof) => {
    try {
      setData(await recordBookingPayment(bookingId, fields, proof));
      setRecording(false);
      notify(t('payments:report.sentTitle'), isOwner ? t('payments:report.sentOwner') : t('payments:report.sentShipper'));
    } catch (error) {
      notify(t('payments:booking.failedTitle'), getErrorMessage(error));
    }
  };

  const confirm = (payment) => confirmAction({
    title: t('payments:booking.confirmTitle', { amount: formatCurrency(payment.amount) }),
    message: t('payments:booking.confirmMessage'),
    confirmLabel: t('payments:booking.confirmLabel'),
    onConfirm: async () => {
      setBusyId(payment._id);
      try {
        setData(await confirmBookingPayment(bookingId, payment._id));
      } catch (error) {
        notify(t('payments:booking.failedTitle'), getErrorMessage(error));
      }
      setBusyId(null);
    },
  });

  const sendDispute = async () => {
    const payment = disputing;
    setBusyId(payment._id);
    try {
      setData(await disputeBookingPayment(bookingId, payment._id, disputeReason.trim() || undefined));
      setDisputing(null);
    } catch (error) {
      notify(t('payments:booking.failedTitle'), getErrorMessage(error));
    }
    setBusyId(null);
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <SectionTitle title={t('payments:booking.title')} />
        <StatusBadge status={summary.status} />
      </View>

      <View style={styles.stats}>
        <Stat label={t('payments:booking.total')} value={formatCurrency(summary.total)} />
        <Stat label={t('payments:booking.paid')} value={formatCurrency(summary.paid)} tone={summary.paid > 0 ? 'success' : null} />
        <Stat label={t('payments:booking.due')} value={formatCurrency(summary.due)} tone={summary.due > 0 ? 'warning' : null} />
      </View>
      {summary.awaitingConfirmation > 0 ? (
        <View style={styles.awaiting}>
          <Icon name="time" size={iconSize.sm} color={colors.warningText} />
          <Text style={styles.awaitingText}>
            {t(isOwner ? 'payments:booking.awaitingOwner' : 'payments:booking.awaitingShipper', { amount: formatCurrency(summary.awaitingConfirmation) })}
          </Text>
        </View>
      ) : null}
      {isOwner && commission ? (
        <View style={styles.feeRow}>
          <Icon name="receipt" size={iconSize.sm} color={colors.textMuted} />
          <Text style={styles.feeText}>
            <Text style={styles.feeLabel}>{t('payments:commission.bookingFee')}: </Text>
            {commission.welcome
              ? t('payments:commission.bookingFeeWelcome')
              : commission.charged
              ? t('payments:commission.bookingFeeCharged', {
                amount: formatCurrency(commission.amount), month: formatBsMonth(commission.period),
              })
              : t('payments:commission.bookingFeeEstimate', { amount: formatCurrency(commission.amount) })}
          </Text>
        </View>
      ) : null}
      {fullyPaid ? (
        <View style={styles.paidBanner}>
          <Icon name="success" size={iconSize.md} color={colors.successText} />
          <Text style={styles.paidText}>{t('payments:booking.fullyPaid')}</Text>
        </View>
      ) : null}

      {!isOwner && !fullyPaid ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('payments:booking.payOwnerTitle', { name: ownerName })}</Text>
          {payTo.length ? (
            <>
              <Text style={styles.muted}>{t('payments:booking.payOwnerHint')}</Text>
              {payTo.map((method) => <PayoutMethodCard key={method._id} method={method} compact />)}
            </>
          ) : <Text style={styles.muted}>{t('payments:booking.noAccounts')}</Text>}
        </View>
      ) : null}

      {isOwner && !payTo.length ? (
        <View style={styles.notice}>
          <Icon name="warning" size={iconSize.md} color={colors.warningText} />
          <View style={styles.fill}>
            <Text style={styles.noticeTitle}>{t('payments:booking.ownerNoAccountsTitle')}</Text>
            <Text style={styles.muted}>{t('payments:booking.ownerNoAccountsText')}</Text>
            <Button
              title={t('payments:booking.addAccounts')}
              icon="bank"
              size="sm"
              variant="tertiary"
              onPress={() => navigation.navigate('Profile', { screen: 'PaymentMethods', initial: false })}
              style={styles.noticeButton}
            />
          </View>
        </View>
      ) : null}

      {canRecord && !fullyPaid ? (
        <Button
          title={isOwner ? t('payments:booking.recordReceived') : t('payments:booking.iPaid')}
          icon={isOwner ? 'cash' : 'paymentCheck'}
          variant={isOwner ? 'tertiary' : 'primary'}
          size="lg"
          onPress={() => setRecording(true)}
        />
      ) : null}

      <Text style={styles.historyTitle}>{t('payments:booking.history')}</Text>
      {payments.length ? payments.map((payment, index) => (
        <PaymentRow
          key={payment._id}
          payment={payment}
          first={index === 0}
          canAnswer={isOwner && payment.status === 'reported'}
          busy={busyId === payment._id}
          onConfirm={confirm}
          onDispute={(p) => { setDisputeReason(''); setDisputing(p); }}
          onProof={setProofUrl}
        />
      )) : <Text style={styles.muted}>{t('payments:booking.noPayments')}</Text>}

      <RecordPaymentModal
        visible={recording}
        title={isOwner ? t('payments:report.ownerTitle') : t('payments:report.shipperTitle')}
        destinationLabel={isOwner ? t('payments:report.receivedIn') : t('payments:report.paidTo')}
        withProof={!isOwner}
        payTo={payTo}
        due={Math.max(0, summary.due - (isOwner ? 0 : summary.awaitingConfirmation))}
        onClose={() => setRecording(false)}
        onSubmit={submitPayment}
      />

      <Modal
        visible={Boolean(disputing)}
        size="sm"
        title={t('payments:booking.disputeTitle')}
        onClose={() => setDisputing(null)}
        footer={<Button title={t('payments:booking.disputeConfirm')} icon="send" variant="destructive" onPress={sendDispute} loading={Boolean(disputing) && busyId === disputing._id} style={styles.fill} />}
      >
        <Text style={styles.muted}>{t('payments:booking.disputeHint')}</Text>
        <Input value={disputeReason} onChangeText={setDisputeReason} placeholder={t('payments:booking.disputePlaceholder')} />
      </Modal>

      <Modal visible={Boolean(proofUrl)} title={t('payments:booking.proofTitle')} onClose={() => setProofUrl(null)}>
        {proofUrl ? <Image source={{ uri: proofUrl }} style={styles.proofLarge} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
      </Modal>
    </Card>
  );
};

const SectionTitle = ({ title }) => (
  <View style={styles.sectionTitleRow}>
    <Icon name="wallet" size={iconSize.md} color={colors.primaryText} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  pressed: { opacity: 0.8 },
  muted: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionTitle: { ...type.h3, color: colors.textPrimary },

  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  statLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted },
  statValue: { ...type.bodyMedium, color: colors.textPrimary },
  tone_success: { color: colors.successText },
  tone_warning: { color: colors.warningText },
  awaiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  awaitingText: { ...type.small, color: colors.warningText, flex: 1 },
  paidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.successMuted, marginBottom: spacing.sm,
  },
  paidText: { ...type.bodyMedium, color: colors.successText },
  feeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginBottom: spacing.sm },
  feeText: { ...type.small, color: colors.textSecondary, flex: 1 },
  feeLabel: { ...type.smallMedium, color: colors.textPrimary },

  block: { marginTop: spacing.sm },
  blockTitle: { ...type.bodyMedium, color: colors.textPrimary, marginBottom: spacing.xxs },
  notice: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningMuted, marginVertical: spacing.sm,
  },
  noticeTitle: { ...type.bodyMedium, color: colors.textPrimary },
  noticeButton: { alignSelf: 'flex-start', marginTop: spacing.xs },

  historyTitle: { ...type.smallMedium, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },
  payment: { paddingVertical: spacing.md },
  paymentRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  paymentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  paymentAmount: { ...type.bodyMedium, color: colors.textPrimary },
  paymentMeta: { ...type.small, color: colors.textSecondary, marginTop: spacing.xxs },
  paymentBy: { ...type.caption, fontWeight: '400', color: colors.textMuted, marginTop: spacing.xxs },
  paymentNote: { ...type.small, color: colors.textPrimary, marginTop: spacing.xs },
  paymentDispute: { ...type.small, color: colors.errorText, marginTop: spacing.xs },
  proofLink: { alignSelf: 'flex-start', marginTop: spacing.xs },
  answer: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryMuted },
  answerQuestion: { ...type.smallMedium, color: colors.textPrimary, marginBottom: spacing.sm },
  answerButtons: { flexDirection: 'row', gap: spacing.sm },

  proofLarge: { width: '100%', height: 420 },
}));

export default PaymentSection;
