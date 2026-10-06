import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';
import { StatusPill } from '../../components/common/SettingsList';
import PaymentHero from '../../components/payments/PaymentHero';
import PayoutMethodCard from '../../components/payments/PayoutMethodCard';
import RecordPaymentModal from '../../components/payments/RecordPaymentModal';
import useScreenLayout from '../../hooks/useScreenLayout';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles, themed } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import { formatBsMonth, formatDayKey, nepalDay } from '../../utils/nepalDate';
import { notify } from '../../utils/alert';
import socketService from '../../services/socket';
import { getMyCommission, recordCommissionPayment } from '../../services/commission';

const MONTH_TONES = { open: 'info', due: 'warning', overdue: 'error', paid: 'success' };
const PAYMENT_TONES = { reported: 'warning', confirmed: 'success', rejected: 'error' };

const BANNER = themed(() => ({
  overdue: { tint: colors.errorMuted, text: colors.errorText, icon: 'warning' },
  due: { tint: colors.warningMuted, text: colors.warningText, icon: 'time' },
  awaiting: { tint: colors.infoMuted, text: colors.infoText, icon: 'pending' },
  clear: { tint: colors.successMuted, text: colors.successText, icon: 'success' },
}));

// Where the owner stands, in one line: past due, due, being checked, or clear.
const standingOf = (summary) => {
  if (summary.overdue - summary.awaiting > 0) return 'overdue';
  if (summary.payableNow - summary.awaiting > 0) return 'due';
  if (summary.awaiting > 0) return 'awaiting';
  return 'clear';
};

const Stat = ({ label, value, detail, tone }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, tone && styles[`tone_${tone}`]]} numberOfLines={1}>{value}</Text>
    {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
  </View>
);

const SectionTitle = ({ icon, title }) => (
  <View style={styles.sectionTitleRow}>
    <Icon name={icon} size={iconSize.md} color={colors.primaryText} />
    <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
  </View>
);

const Row = ({ first, title, detail, right, children }) => (
  <View style={[styles.row, !first && styles.rowRule]}>
    <View style={styles.rowTop}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {right}
    </View>
    {children}
  </View>
);

// A truck owner's FLITO fees: how they work, where the owner stands, FLITO's
// accounts to pay into, and their monthly bills, trips and payments.
const CommissionScreen = () => {
  const { t } = useTranslation();
  const layout = useScreenLayout('medium', 'wide');
  const twoColumns = layout.isDesktop;
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [proofUrl, setProofUrl] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await getMyCommission());
      setLoadError(null);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // An admin confirming or rejecting a payment shows up straight away.
  useEffect(() => {
    socketService.on('commission-updated', load);
    return () => socketService.off('commission-updated', load);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const submitPayment = async (fields, proof) => {
    try {
      setData(await recordCommissionPayment(fields, proof));
      setPaying(false);
      notify(t('payments:commission.sentTitle'), t('payments:commission.sentMessage'));
    } catch (error) {
      notify(t('payments:booking.failedTitle'), getErrorMessage(error));
    }
  };

  if (loadError && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t('payments:commission.loadFailed')}</Text>
        <Button title={t('payments:commission.retry')} icon="refresh" variant="tertiary" onPress={load} />
      </View>
    );
  }
  if (!data) return <Spinner />;

  const { rules, summary, charges, payments, payTo } = data;
  const current = summary.periods.find((row) => row.period === summary.currentPeriod);
  const standing = standingOf(summary);
  const banner = BANNER[standing];
  const notStarted = rules.startsOn && nepalDay() < rules.startsOn;
  const bannerTitle = {
    overdue: t('payments:commission.status.overdueTitle', { amount: formatCurrency(summary.overdue - summary.awaiting) }),
    due: t('payments:commission.status.dueTitle', {
      amount: formatCurrency(summary.payableNow - summary.awaiting),
      date: summary.dueDay ? formatDayKey(summary.dueDay) : '',
    }),
    awaiting: t('payments:commission.status.awaitingTitle'),
    clear: t('payments:commission.status.clearTitle'),
  }[standing];
  const bannerText = standing === 'awaiting'
    ? t('payments:commission.status.awaitingText', { amount: formatCurrency(summary.awaiting) })
    : t(`payments:commission.status.${standing}Text`);

  const rates = (
    <Card>
      <SectionTitle icon="price" title={t('payments:commission.howTitle')} />
      <Text style={styles.howText}>{t('payments:commission.howText')}</Text>
      {rules.welcomeTrips ? (
        <View style={styles.welcome}>
          <Icon name="sparkle" size={iconSize.sm} color={colors.successText} />
          <Text style={styles.welcomeText}>
            {summary.welcomeTripsLeft
              ? t('payments:commission.welcomeLeft', { count: summary.welcomeTripsLeft, total: rules.welcomeTrips })
              : t('payments:commission.welcomeUsed')}
          </Text>
        </View>
      ) : null}
    </Card>
  );

  const pay = (
    <Card>
      <SectionTitle icon="wallet" title={t('payments:commission.payTitle')} />
      {payTo.length ? (
        <>
          <Text style={styles.muted}>{t('payments:commission.payHint')}</Text>
          {payTo.map((method) => <PayoutMethodCard key={method._id} method={method} compact />)}
        </>
      ) : <Text style={styles.muted}>{t('payments:commission.noAccounts')}</Text>}
      {summary.maxPayment > 0 ? (
        <Button title={t('payments:commission.iPaid')} icon="paymentCheck" size="lg" onPress={() => setPaying(true)} />
      ) : null}
    </Card>
  );

  const months = (
    <Card>
      <SectionTitle icon="calendar" title={t('payments:commission.monthsTitle')} />
      {summary.periods.length ? summary.periods.map((month, index) => (
        <Row
          key={month.period}
          first={index === 0}
          title={formatBsMonth(month.period)}
          detail={[
            t('payments:commission.monthTrips', {
              trips: t('payments:commission.tripsCount', { count: month.trips }),
              amount: formatCurrency(month.amount),
            }),
            month.paid && month.left ? t('payments:commission.monthPaid', { amount: formatCurrency(month.paid) }) : null,
            month.left && month.status !== 'open' ? t('payments:commission.monthDue', { date: formatDayKey(month.dueDay) }) : null,
          ].filter(Boolean).join(' · ')}
          right={<StatusPill label={t(`payments:commission.monthStatus.${month.status}`)} tone={MONTH_TONES[month.status]} />}
        />
      )) : <Text style={styles.muted}>{t('payments:commission.noTrips')}</Text>}
    </Card>
  );

  const trips = (
    <Card>
      <SectionTitle icon="truckDelivery" title={t('payments:commission.tripsTitle')} />
      {charges.length ? charges.map((charge, index) => (
        <Row
          key={charge._id}
          first={index === 0}
          title={[charge.goodsType, [charge.from, charge.to].filter(Boolean).join(' → ')].filter(Boolean).join(' · ')}
          detail={[
            formatDayKey(charge.completedDay),
            charge.welcome
              ? t('payments:commission.tripWelcome', { fare: formatCurrency(charge.fare) })
              : t('payments:commission.tripLine', { fare: formatCurrency(charge.fare) }),
          ].join(' · ')}
          right={charge.welcome
            ? <StatusPill label={t('payments:commission.free')} tone="success" />
            : <Text style={styles.amount}>{formatCurrency(charge.amount)}</Text>}
        />
      )) : <Text style={styles.muted}>{t('payments:commission.noTrips')}</Text>}
    </Card>
  );

  const paymentList = (
    <Card>
      <SectionTitle icon="receipt" title={t('payments:commission.paymentsTitle')} />
      {payments.length ? payments.map((payment, index) => (
        <Row
          key={payment._id}
          first={index === 0}
          title={formatCurrency(payment.amount)}
          detail={[
            payment.paidTo || t(`payments:kinds.${payment.method}`, payment.method),
            payment.transactionId ? t('payments:booking.reference', { id: payment.transactionId }) : null,
            formatDate(payment.createdAt),
          ].filter(Boolean).join(' · ')}
          right={<StatusPill label={t(`payments:commission.paymentStatus.${payment.status}`)} tone={PAYMENT_TONES[payment.status]} />}
        >
          {payment.rejectionReason ? (
            <Text style={styles.rejected}>{t('payments:commission.rejectedReason', { reason: payment.rejectionReason })}</Text>
          ) : null}
          {payment.proofUrl ? (
            <Button title={t('payments:booking.viewProof')} icon="image" size="sm" variant="ghost" onPress={() => setProofUrl(payment.proofUrl)} style={styles.proofLink} />
          ) : null}
        </Row>
      )) : <Text style={styles.muted}>{t('payments:commission.noPayments')}</Text>}
    </Card>
  );

  const overview = (
    <>
      <View style={[styles.banner, { backgroundColor: banner.tint }]}>
        <Icon name={banner.icon} size={iconSize.lg} color={banner.text} />
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: banner.text }]}>{bannerTitle}</Text>
          <Text style={styles.bannerBody}>{bannerText}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Stat
          label={t('payments:commission.thisMonth')}
          value={formatCurrency(current?.amount || 0)}
          detail={t('payments:commission.tripsCount', { count: current?.trips || 0 })}
        />
        <Stat
          label={t('payments:commission.toPayNow')}
          value={formatCurrency(Math.max(0, summary.payableNow - summary.awaiting))}
          tone={summary.overdue - summary.awaiting > 0 ? 'error' : summary.payableNow - summary.awaiting > 0 ? 'warning' : null}
        />
        <Stat label={t('payments:commission.awaiting')} value={formatCurrency(summary.awaiting)} />
      </View>
    </>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <PaymentHero
        icon="receipt"
        eyebrow={t('payments:commission.heroEyebrow')}
        title={t('payments:commission.heroTitle')}
        body={t('payments:commission.heroText', { day: rules.dueDay })}
        points={[
          { icon: 'shipper', label: t('payments:commission.points.noShipper') },
          { icon: 'calendar', label: t('payments:commission.points.monthly') },
          { icon: 'close', label: t('payments:commission.points.cancelled') },
        ]}
      >
        {notStarted ? (
          <Text style={styles.startsOn}>{t('payments:commission.startsOn', { date: formatDayKey(rules.startsOn) })}</Text>
        ) : null}
      </PaymentHero>

      <View style={styles.body}>
        {twoColumns ? (
          <View style={styles.columns}>
            <View style={styles.mainColumn}>{overview}{pay}{months}</View>
            <View style={styles.sideColumn}>{rates}{paymentList}{trips}</View>
          </View>
        ) : (
          <>{overview}{pay}{rates}{months}{paymentList}{trips}</>
        )}
      </View>

      <RecordPaymentModal
        visible={paying}
        title={t('payments:commission.reportTitle')}
        destinationLabel={t('payments:report.paidTo')}
        withProof
        payTo={payTo}
        due={summary.maxPayment}
        onClose={() => setPaying(false)}
        onSubmit={submitPayment}
      />

      <Modal visible={Boolean(proofUrl)} title={t('payments:booking.proofTitle')} onClose={() => setProofUrl(null)}>
        {proofUrl ? <Image source={{ uri: proofUrl }} style={styles.proofLarge} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
      </Modal>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  body: { marginTop: spacing.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  mainColumn: { flex: 3, minWidth: 0 },
  sideColumn: { flex: 2, minWidth: 0 },
  muted: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  startsOn: { ...type.smallMedium, color: colors.primary, marginTop: spacing.md },

  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, marginVertical: spacing.sm },
  bannerText: { flex: 1 },
  bannerTitle: { ...type.h3 },
  bannerBody: { ...type.small, color: colors.textPrimary, marginTop: spacing.xxs },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  stat: { flexGrow: 1, flexBasis: 140, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  statLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted },
  statValue: { ...type.h3, color: colors.textPrimary },
  statDetail: { ...type.small, color: colors.textMuted },
  tone_warning: { color: colors.warningText },
  tone_error: { color: colors.errorText },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  howText: { ...type.body, color: colors.textSecondary },
  welcome: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.successMuted,
  },
  welcomeText: { ...type.small, color: colors.textPrimary, flex: 1 },

  row: { paddingVertical: spacing.md },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.bodyMedium, color: colors.textPrimary },
  rowDetail: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  amount: { ...type.bodyMedium, color: colors.textPrimary },
  rejected: { ...type.small, color: colors.errorText, marginTop: spacing.xs },
  proofLink: { alignSelf: 'flex-start', marginTop: spacing.xs },
  proofLarge: { width: '100%', height: 420 },
}));

export default CommissionScreen;
