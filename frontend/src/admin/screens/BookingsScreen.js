import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact } from '../components/AdminCard';
import { displayName, partyName } from '../format';

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
  return (
    <AdminCard
      icon="truckDelivery"
      title={booking.loadId?.goodsType || t('admin:bookingsList.goodsFallback')}
      subtitle={booking.totalAmount ? formatCurrency(booking.totalAmount) : null}
      right={<StatusBadge status={booking.status} />}
    >
      <Fact icon="shipper" label={t('bookings:detail.shipper')}>{displayName(booking.shipperId) || '-'}</Fact>
      <Fact icon="owner" label={t('bookings:detail.owner')}>{partyName(booking.ownerId) || '-'}</Fact>
      <Fact icon="driver" label={t('bookings:detail.driver')}>{booking.driverId ? displayName(booking.driverId) : t('bookings:detail.notAssigned')}</Fact>
      <Fact icon="truck" label={t('bookings:detail.truck')}>{booking.truckId?.registrationNumber}</Fact>
      <Fact icon="calendar">{t('admin:bookingsList.created', { date: formatDate(booking.createdAt) })}</Fact>
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
