import React, { useState } from 'react';
import { Text } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import { colors, type, themedStyles } from '../../theme/tokens';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, PillRow, ActionRow } from '../components/AdminCard';
import { refreshAdminStats } from '../useAdminStats';
import { displayName } from '../format';

// What an admin can do to a user given where they stand now. An admin's own
// account is left out (the server refuses it, and locking yourself out helps
// no one).
const ACTIONS = {
  active: [
    { action: 'suspend', status: 'suspended', icon: 'lock', variant: 'tertiary' },
    { action: 'ban', status: 'banned', icon: 'close', variant: 'destructive' },
  ],
  suspended: [
    { action: 'reactivate', status: 'active', icon: 'checkmark', variant: 'tertiary' },
    { action: 'ban', status: 'banned', icon: 'close', variant: 'destructive' },
  ],
  banned: [{ action: 'reactivate', status: 'active', icon: 'checkmark', variant: 'tertiary' }],
};

const options = (values, labelKey) => values.map((value) => ({ value, labelKey: labelKey(value) }));

const FILTER_GROUPS = [
  { key: 'role', icon: 'person', labelKey: 'admin:filters.role', countKey: 'users.role', options: options(['shipper', 'owner', 'driver', 'admin'], (v) => `admin:roles.${v}`) },
  { key: 'status', icon: 'info', labelKey: 'admin:filters.status', countKey: 'users.status', options: options(['active', 'suspended', 'banned'], (v) => `common:status.${v}`) },
  { key: 'kycStatus', icon: 'idCard', labelKey: 'admin:filters.identity', countKey: 'users.kycStatus', options: options(['not_submitted', 'pending', 'approved', 'rejected'], (v) => `common:status.${v}`) },
];

const UserCard = ({ user, list }) => {
  const { t } = useTranslation();
  const myId = useSelector((state) => state.auth.user?._id);
  const [busy, setBusy] = useState(false);
  const name = displayName(user) || t('admin:usersList.unnamed');
  const actions = user._id !== myId ? ACTIONS[user.status] : null;

  const change = ({ action, status }) => confirmAction({
    title: t(`admin:userActions.${action}.title`),
    message: t(`admin:userActions.${action}.message`, { name: displayName(user) || user.email || t('admin:usersList.unnamed') }),
    confirmLabel: t(`admin:userActions.${action}.confirm`),
    destructive: action !== 'reactivate',
    onConfirm: async () => {
      setBusy(true);
      try {
        await api.patch(`/admin/users/${user._id}/status`, { status });
        await list.refresh();
        refreshAdminStats();
      } catch (error) {
        notify(t('admin:common.error'), getErrorMessage(error));
      }
      setBusy(false);
    },
  });

  return (
    <AdminCard
      person={name}
      title={name}
      subtitle={[t(`admin:roles.${user.role}`, user.role), user.companyName].filter(Boolean).join(' · ')}
      right={<StatusBadge status={user.status} />}
      footer={actions ? (
        <ActionRow>
          {actions.map((item) => (
            <Button
              key={item.action}
              title={t(`admin:userActions.${item.action}.button`)}
              icon={item.icon}
              variant={item.variant}
              size="sm"
              style={styles.action}
              loading={busy}
              onPress={() => change(item)}
            />
          ))}
        </ActionRow>
      ) : null}
    >
      <Fact icon="email">{user.email}</Fact>
      <Fact icon="phone">{user.phone}</Fact>
      <Fact icon="calendar">{t('admin:usersList.joined', { date: formatDate(user.createdAt) })}</Fact>
      <PillRow>
        <StatusBadge status={user.kycStatus} />
        {user.totalRatings ? (
          <Text style={styles.rating}>★ {user.rating.toFixed(1)} · {t('admin:usersList.rating', { count: user.totalRatings })}</Text>
        ) : null}
      </PillRow>
    </AdminCard>
  );
};

const styles = themedStyles(() => ({
  rating: { ...type.small, color: colors.textMuted },
  action: { flexGrow: 1, flexBasis: 120 },
}));

const UsersScreen = () => (
  <ResourceScreen
    page="users"
    endpoint="/admin/users"
    itemsKey="users"
    filterGroups={FILTER_GROUPS}
    emptyIcon="people"
    renderItem={(user, list) => <UserCard user={user} list={list} />}
  />
);

export default UsersScreen;
