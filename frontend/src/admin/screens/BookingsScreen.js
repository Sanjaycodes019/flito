import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { dayLabel } from '../../utils/nepalDate';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, Pill, RouteLine } from '../components/AdminCard';
import { displayName, partyName } from '../format';
import { openAdminRecord } from '../records';

const FILTER_GROUPS = [
  {
    key: 'status',
    icon: 'info',
    labelKey: 'admin:filters.status',
    countKey: 'bookings.status',
    options: ['pending', 'confirmed', 'in_transit', 'completed', 'cancelled']
      .map((value) => ({ value, labelKey: `common:status.${value}` })),
  },
];

const BookingCard = ({ booking }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const load = booking.loadId;

  return (
    <AdminCard
      icon="truckDelivery"
      title={load?.goodsType || t('admin:bookingsList.goodsFallback')}
      subtitle={booking.truckId?.registrationNumber || null}
      badges={(
        <>
          <StatusBadge status={booking.status} />
          {booking.totalAmount ? <Pill icon="price" tone="accent">{formatCurrency(booking.totalAmount)}</Pill> : null}
        </>
      )}
      onPress={() => openAdminRecord(navigation, 'booking', booking._id)}
    >
      {load?.pickupLocation || load?.dropoffLocation ? (
        <RouteLine from={load.pickupLocation?.label} to={load.dropoffLocation?.label} />
      ) : null}
      <Fact icon="shipper" label={t('bookings:detail.shipper')}>{partyName(booking.shipperId) || '—'}</Fact>
      <Fact icon="owner" label={t('bookings:detail.owner')}>{partyName(booking.ownerId) || '—'}</Fact>
      <Fact icon="driver" label={t('bookings:detail.driver')} tone={booking.driverId ? undefined : 'warning'}>
        {booking.driverId ? displayName(booking.driverId) : t('bookings:detail.notAssigned')}
      </Fact>
      <Fact icon="calendar" label={t('admin:cards.pickup')}>{load?.pickupDay ? dayLabel(load.pickupDay) : null}</Fact>
      <Fact icon="time" label={t('admin:cards.booked')}>{formatDate(booking.createdAt)}</Fact>
    </AdminCard>
  );
};

const BookingsScreen = () => (
  <ResourceScreen
    page="bookings"
    endpoint="/admin/bookings"
    itemsKey="bookings"
    searchable={false}
    filterGroups={FILTER_GROUPS}
    emptyIcon="truckDelivery"
    renderItem={(booking) => <BookingCard booking={booking} />}
  />
);

export default BookingsScreen;
