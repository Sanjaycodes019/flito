import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatKg } from '../../utils/helpers';
import { dayLabel } from '../../utils/nepalDate';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, Pill, RouteLine, VerificationPill } from '../components/AdminCard';
import { partyName } from '../format';
import { openAdminRecord } from '../records';

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
  const navigation = useNavigation();
  const needed = load.trucksNeeded || 1;
  const shipper = partyName(load.shipperId) || t('admin:loadsList.shipperFallback');

  return (
    <AdminCard
      icon="load"
      title={load.goodsType}
      subtitle={shipper}
      badges={(
        <>
          <StatusBadge status={load.status} />
          {load.shipperId?.verified ? <VerificationPill status="approved" /> : null}
          {needed > 1 ? (
            <Pill icon="truck" tone={(load.trucksBooked || 0) >= needed ? 'accent' : 'info'}>
              {t('loads:truckSlots.booked', { booked: load.trucksBooked || 0, needed })}
            </Pill>
          ) : null}
        </>
      )}
      onPress={() => openAdminRecord(navigation, 'load', load._id)}
    >
      <RouteLine
        from={load.pickupLocation?.label || load.pickupLocation?.address}
        to={load.dropoffLocation?.label || load.dropoffLocation?.address}
      />
      <Fact icon="weight" label={t('loads:common.weight')}>{load.weight ? formatKg(load.weight) : null}</Fact>
      <Fact icon="calendar" label={t('admin:cards.pickup')}>{load.pickupDay ? dayLabel(load.pickupDay) : null}</Fact>
      <Fact icon="quote" label={t('admin:cards.offers')}>{String(load.totalQuotes || 0)}</Fact>
      <Fact icon="time" label={t('admin:cards.posted')}>{formatDate(load.createdAt)}</Fact>
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
