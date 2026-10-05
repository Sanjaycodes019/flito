import React, { useState } from 'react';
import { View, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import VerifiedBadge from '../../../components/common/VerifiedBadge';
import DocumentTile from '../../../components/kyc/DocumentTile';
import { spacing, themedStyles } from '../../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage, kycDocumentLabel, kycIdTypeLabel } from '../../../utils/helpers';
import { confirmAction, notify } from '../../../utils/alert';
import api from '../../../services/api';
import useAdminRecord from '../../useAdminRecord';
import { refreshAdminStats } from '../../useAdminStats';
import { formatPhone, formatWhen } from '../../format';
import DetailPage from '../../components/detail/DetailPage';
import { Hero, Lead, Panel, InfoGrid, InfoItem, Notice, Muted } from '../../components/detail/DetailParts';
import VerificationPanel from '../../components/detail/VerificationPanel';
import ReasonModal from '../../components/detail/ReasonModal';
import RelatedList from '../../components/detail/RelatedList';
import HistoryTimeline from '../../components/detail/HistoryTimeline';
import { BookingRow, LoadRow, PersonRow, TruckRow } from '../../components/detail/rows';

// What an admin can do to an account, given where it stands now.
const STATUS_ACTIONS = {
  active: [
    { action: 'suspend', status: 'suspended', icon: 'lock', variant: 'secondary' },
    { action: 'ban', status: 'banned', icon: 'close', variant: 'destructive' },
  ],
  suspended: [
    { action: 'reactivate', status: 'active', icon: 'checkmark', variant: 'primary' },
    { action: 'ban', status: 'banned', icon: 'close', variant: 'destructive' },
  ],
  banned: [{ action: 'reactivate', status: 'active', icon: 'checkmark', variant: 'primary' }],
};

const yesNo = (value, t) => (value ? t('admin:detail.yes') : t('admin:detail.no'));

// The account's standing, and the support actions: suspend, ban, reactivate,
// and a new login PIN for someone who called having forgotten theirs.
const AccountPanel = ({ user, isMe, onChanged }) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState(null);
  const [resetting, setResetting] = useState(false);
  const name = user.name || user.email || formatPhone(user.phone);
  const canResetPin = Boolean(user.phone) && user.role !== 'admin';

  const changeStatus = async (reason) => {
    await api.patch(`/admin/users/${user._id}/status`, { status: pending.status, reason: reason || undefined });
    await onChanged();
    refreshAdminStats();
  };

  const resetPin = () => confirmAction({
    title: t('admin:userActions.resetPin.title'),
    message: t('admin:userActions.resetPin.message', { name, phone: user.phone }),
    confirmLabel: t('admin:userActions.resetPin.confirm'),
    onConfirm: async () => {
      setResetting(true);
      try {
        const { data } = await api.post(`/admin/users/${user._id}/reset-pin`);
        notify(t('admin:userActions.resetPin.doneTitle'), t('admin:userActions.resetPin.doneMessage', { pin: data.pin, phone: user.phone }));
        await onChanged();
      } catch (error) {
        notify(t('admin:common.error'), getErrorMessage(error));
      }
      setResetting(false);
    },
  });

  return (
    <Panel icon="lock" title={t('admin:detail.user.account')} action={<StatusBadge status={user.status} />}>
      {user.status !== 'active' ? (
        <Notice tone={user.status === 'banned' ? 'error' : 'warning'} title={t(`admin:detail.user.blocked.${user.status}`)}>
          {t('admin:detail.user.blockedHint')}
        </Notice>
      ) : null}
      {isMe ? (
        <Muted>{t('admin:detail.user.thisIsYou')}</Muted>
      ) : (
        <View style={styles.actions}>
          {(STATUS_ACTIONS[user.status] || []).map((item) => (
            <Button
              key={item.action}
              title={t(`admin:userActions.${item.action}.button`)}
              icon={item.icon}
              variant={item.variant}
              onPress={() => setPending(item)}
              style={styles.action}
            />
          ))}
          {canResetPin ? (
            <Button title={t('admin:userActions.resetPin.button')} icon="lock" variant="tertiary" onPress={resetPin} loading={resetting} style={styles.action} />
          ) : null}
        </View>
      )}
      <ReasonModal
        visible={Boolean(pending)}
        title={pending ? t(`admin:userActions.${pending.action}.title`) : ''}
        message={pending ? t(`admin:userActions.${pending.action}.message`, { name }) : ''}
        confirmLabel={pending ? t(`admin:userActions.${pending.action}.confirm`) : ''}
        destructive={pending?.action !== 'reactivate'}
        required={false}
        onConfirm={changeStatus}
        onClose={() => setPending(null)}
      />
    </Panel>
  );
};

const ContactPanel = ({ user }) => {
  const { t } = useTranslation();
  return (
    <Panel icon="phone" title={t('admin:detail.user.contact')}>
      <InfoGrid>
        <InfoItem icon="phone" label={t('admin:detail.user.phone')} value={formatPhone(user.phone)} wide />
        <InfoItem icon="email" label={t('admin:detail.user.email')} value={user.email} wide />
      </InfoGrid>
      <View style={styles.actions}>
        {user.phone ? (
          <Button title={t('admin:detail.call')} icon="phone" variant="secondary" size="sm" onPress={() => Linking.openURL(`tel:${user.phone}`)} style={styles.action} />
        ) : null}
        {user.email ? (
          <Button title={t('admin:detail.emailButton')} icon="email" variant="secondary" size="sm" onPress={() => Linking.openURL(`mailto:${user.email}`)} style={styles.action} />
        ) : null}
      </View>
    </Panel>
  );
};

// What the user has on FLITO, by role: a shipper's loads, an owner's trucks
// and drivers, a driver's trucks, and everyone's bookings, each paginated.
const RelatedRecords = ({ user }) => {
  const { t } = useTranslation();
  const id = user._id;
  return (
    <>
      {user.role === 'shipper' ? (
        <RelatedList
          icon="load"
          title={t('admin:detail.related.loads')}
          endpoint="/admin/loads"
          itemsKey="loads"
          filters={{ shipperId: id }}
          emptyText={t('admin:detail.related.noLoads')}
          renderRow={(load, first) => <LoadRow load={load} first={first} />}
        />
      ) : null}
      {user.role === 'owner' ? (
        <>
          <RelatedList
            icon="truck"
            title={t('admin:detail.related.trucks')}
            endpoint="/admin/trucks"
            itemsKey="trucks"
            filters={{ ownerId: id }}
            emptyText={t('admin:detail.related.noTrucks')}
            renderRow={(truck, first) => <TruckRow truck={truck} first={first} />}
          />
          <RelatedList
            icon="driver"
            title={t('admin:detail.related.drivers')}
            endpoint="/admin/users"
            itemsKey="users"
            filters={{ addedBy: id }}
            emptyText={t('admin:detail.related.noDrivers')}
            renderRow={(driver, first) => (
              <PersonRow
                first={first}
                person={{ ...driver, name: [driver.firstName, driver.lastName].filter(Boolean).join(' ') }}
                role={t('admin:roles.driver')}
                right={<StatusBadge status={driver.kycStatus} />}
              />
            )}
          />
        </>
      ) : null}
      {user.role === 'driver' ? (
        <RelatedList
          icon="truck"
          title={t('admin:detail.related.drivesTrucks')}
          endpoint="/admin/trucks"
          itemsKey="trucks"
          filters={{ driverId: id }}
          emptyText={t('admin:detail.related.noAssignedTrucks')}
          renderRow={(truck, first) => <TruckRow truck={truck} first={first} />}
        />
      ) : null}
      {user.role !== 'admin' ? (
        <RelatedList
          icon="truckDelivery"
          title={t('admin:detail.related.bookings')}
          endpoint="/admin/bookings"
          itemsKey="bookings"
          filters={{ userId: id }}
          emptyText={t('admin:detail.related.noBookings')}
          renderRow={(booking, first) => <BookingRow booking={booking} first={first} />}
        />
      ) : null}
    </>
  );
};

const statsFor = (user, counts, t) => {
  const stats = [];
  if (user.role === 'shipper') stats.push({ icon: 'load', value: counts.loads ?? 0, label: t('admin:detail.stats.loads', { count: counts.loads ?? 0 }) });
  if (user.role === 'owner') {
    stats.push({ icon: 'truck', value: counts.trucks ?? 0, label: t('admin:detail.stats.trucks', { count: counts.trucks ?? 0 }) });
    stats.push({ icon: 'driver', value: counts.drivers ?? 0, label: t('admin:detail.stats.drivers', { count: counts.drivers ?? 0 }) });
  }
  if (user.role !== 'admin') {
    stats.push({ icon: 'truckDelivery', value: counts.bookings ?? 0, label: t('admin:detail.stats.bookings', { count: counts.bookings ?? 0 }) });
    stats.push({ icon: 'success', value: counts.completedBookings ?? 0, label: t('admin:detail.stats.completed') });
  }
  if (user.totalRatings) {
    stats.push({ icon: 'star', value: `★ ${user.rating.toFixed(1)}`, label: t('admin:usersList.rating', { count: user.totalRatings }) });
  }
  return stats;
};

// One user, everything about them in one place: profile, contact, identity
// verification with its documents, account actions, what they have on FLITO
// and what admins have done to the account.
const UserDetailScreen = ({ route }) => {
  const { t } = useTranslation();
  const { userId } = route.params;
  const myId = useSelector((state) => state.auth.user?._id);
  const record = useAdminRecord(`/admin/users/${userId}`);
  const { user, counts = {}, history = [] } = record.data || {};

  const decide = async (decision, reason) => {
    await api.patch(`/admin/kyc/${userId}`, { decision, reason });
    await record.refresh();
    refreshAdminStats();
  };
  const revoke = async (reason) => {
    await api.post(`/admin/kyc/${userId}/revoke`, { reason });
    await record.refresh();
    refreshAdminStats();
  };

  const name = user ? user.name || user.email || formatPhone(user.phone) || t('admin:usersList.unnamed') : '';
  const kyc = user?.kyc;

  return (
    <DetailPage
      kind="user"
      record={record}
      title={name}
      hero={user ? (
        <Hero
          lead={<Lead imageUrl={user.avatarUrl} person={name} size={72} />}
          kicker={t(`admin:roles.${user.role}`, user.role)}
          title={name}
          subtitle={[user.companyName, t('admin:detail.user.memberSince', { date: formatDate(user.memberSince) })].filter(Boolean).join(' · ')}
          badges={(
            <>
              <StatusBadge status={user.status} />
              {kyc.status === 'approved' ? <VerifiedBadge size={22} label={t('admin:detail.verified')} /> : <StatusBadge status={kyc.status} />}
            </>
          )}
          stats={statsFor(user, counts, t)}
        />
      ) : null}
      side={user ? (
        <>
          <AccountPanel user={user} isMe={user._id === myId} onChanged={record.refresh} />
          {user.role !== 'admin' ? (
            <VerificationPanel
              title={t('admin:detail.user.identity')}
              audience="user"
              status={kyc.status}
              rejectionReason={kyc.rejectionReason}
              submittedAt={kyc.submittedAt}
              reviewedAt={kyc.reviewedAt}
              reviewedBy={kyc.reviewedBy}
              missing={kyc.missingDocuments.map((type) => (type === 'identity' ? t('admin:detail.user.anIdentityDocument') : kycDocumentLabel(type, t)))}
              onDecide={decide}
              onRevoke={revoke}
            />
          ) : null}
          <ContactPanel user={user} />
          <HistoryTimeline entries={history} />
        </>
      ) : null}
    >
      {user ? (
        <>
          <Panel icon="person" title={t('admin:detail.user.profile')}>
            <InfoGrid>
              <InfoItem label={t('admin:detail.user.firstName')} value={user.firstName} />
              <InfoItem label={t('admin:detail.user.lastName')} value={user.lastName} />
              <InfoItem label={t('admin:detail.user.role')} value={t(`admin:roles.${user.role}`, user.role)} />
              <InfoItem label={t('admin:detail.user.company')} value={user.companyName} />
              <InfoItem
                label={t('admin:detail.user.email')}
                value={user.email ? `${user.email} · ${user.emailVerified ? t('admin:detail.user.confirmed') : t('admin:detail.user.notConfirmed')}` : null}
              />
              <InfoItem label={t('admin:detail.user.phone')} value={user.phone ? formatPhone(user.phone) : null} />
              <InfoItem icon="location" label={t('admin:detail.user.address')} value={user.address?.formatted} wide />
              <InfoItem
                label={t('admin:detail.user.signIn')}
                value={[
                  user.signIn.pin ? t('admin:detail.user.signInPin') : null,
                  user.signIn.password ? t('admin:detail.user.signInPassword') : null,
                  user.signIn.google ? 'Google' : null,
                ].filter(Boolean).join(', ')}
              />
              <InfoItem
                label={t('admin:detail.user.pinLocked')}
                value={yesNo(user.pinLocked, t)}
                tone={user.pinLocked ? 'warning' : undefined}
              />
              <InfoItem label={t('admin:detail.user.notifications')} value={user.pushEnabled ? t('admin:detail.user.pushOn') : t('admin:detail.user.pushOff')} />
              <InfoItem label={t('admin:detail.user.memberSinceLabel')} value={formatWhen(user.memberSince)} />
              {user.role === 'owner' || user.bank ? (
                <InfoItem
                  label={t('admin:detail.user.bank')}
                  value={user.payoutMethods?.length
                    ? user.payoutMethods.map((method) => [method.name, method.account, method.hasQr ? 'QR' : null].filter(Boolean).join(' ')).join(', ')
                    : user.bank ? [user.bank.bankName, user.bank.account].filter(Boolean).join(' · ') : null}
                />
              ) : null}
              {user.role !== 'admin' ? <InfoItem label={t('admin:detail.user.wallet')} value={formatCurrency(user.walletBalance)} /> : null}
            </InfoGrid>
          </Panel>

          {user.addedBy ? (
            <Panel icon="owner" title={t('admin:detail.user.addedBy')}>
              <PersonRow first person={user.addedBy} role={t('admin:roles.owner')} />
            </Panel>
          ) : null}

          {user.role !== 'admin' ? (
            <Panel icon="idCard" title={t('admin:detail.user.documents')} count={kyc.documents.length}>
              {kyc.identityDocuments.length ? (
                <Muted>{t('admin:kycQueue.identity', { list: kyc.identityDocuments.map((idType) => kycIdTypeLabel(idType, t)).join(', ') })}</Muted>
              ) : null}
              {kyc.documents.length ? (
                <View style={styles.documents}>
                  {kyc.documents.map((doc) => (
                    <View key={doc._id} style={styles.document}>
                      <DocumentTile doc={doc} label={kycDocumentLabel(doc.type, t)} size={64} />
                    </View>
                  ))}
                </View>
              ) : (
                <Muted>{t('admin:detail.user.noDocuments')}</Muted>
              )}
            </Panel>
          ) : null}

          <RelatedRecords user={user} />
        </>
      ) : null}
    </DetailPage>
  );
};

const styles = themedStyles(() => ({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  action: { flexGrow: 1, flexBasis: 130 },
  documents: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm, marginTop: spacing.sm },
  document: { width: '100%', maxWidth: 360, flexGrow: 1, flexBasis: 240, paddingHorizontal: spacing.sm },
}));

export default UserDetailScreen;
