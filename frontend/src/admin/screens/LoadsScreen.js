import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatKg } from '../../utils/helpers';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact } from '../components/AdminCard';
import { partyName } from '../format';

const FILTER_GROUPS = [
  {
    key: 'status',
    icon: 'info',
    labelKey: 'admin:filters.status',
    countKey: 'loads.status',
    options: ['open', 'quoted', 'negotiating', 'booked', 'completed', 'cancelled', 'expired']
      .map((value) => ({ value, labelKey: `common:status.${value}` })),
  },
];

const LoadCard = ({ load }) => {
  const { t } = useTranslation();
  const shipper = [partyName(load.shipperId) || t('admin:loadsList.shipperFallback'), load.shipperId?.verified ? t('loads:common.verifiedOwner') : null]
    .filter(Boolean).join(' · ');

  return (
    <AdminCard icon="load" title={load.goodsType} subtitle={shipper} right={<StatusBadge status={load.status} />}>
      <Fact icon="pickup" label={t('loads:common.pickup')}>{load.pickupLocation?.label || load.pickupLocation?.address || '-'}</Fact>
      <Fact icon="dropoff" label={t('loads:common.dropoff')}>{load.dropoffLocation?.label || load.dropoffLocation?.address || '-'}</Fact>
      <Fact icon="weight">{load.weight ? formatKg(load.weight) : null}</Fact>
      <Fact icon="quote">{load.totalQuotes ? t('admin:loadsList.quotes', { count: load.totalQuotes }) : null}</Fact>
      <Fact icon="calendar">{t('admin:loadsList.posted', { date: formatDate(load.createdAt) })}</Fact>
    </AdminCard>
  );
};

const LoadsScreen = () => (
  <ResourceScreen
    page="loads"
    endpoint="/admin/loads"
    itemsKey="loads"
    filterGroups={FILTER_GROUPS}
    emptyIcon="load"
    renderItem={(load) => <LoadCard load={load} />}
  />
);

export default LoadsScreen;
