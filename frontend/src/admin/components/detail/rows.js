import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../../components/common/StatusBadge';
import VerifiedBadge from '../../../components/common/VerifiedBadge';
import { formatCurrency, formatDate, formatKg, truckTypeLabel } from '../../../utils/helpers';
import { openAdminRecord } from '../../records';
import { partyName, formatPhone } from '../../format';
import { Lead, RecordRow } from './DetailParts';

// One row per kind of record, so a booking looks the same in a user's list,
// a truck's list and a load's list, and always opens the booking's page.

const routeOf = (load) => {
  const from = load?.pickupLocation?.label || load?.pickup?.label || load?.pickupLocation?.address || load?.pickup?.address;
  const to = load?.dropoffLocation?.label || load?.dropoff?.label || load?.dropoffLocation?.address || load?.dropoff?.address;
  return from || to ? `${from || '?'} → ${to || '?'}` : null;
};

export const BookingRow = ({ booking, first }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const load = booking.loadId && typeof booking.loadId === 'object' ? booking.loadId : booking.load;
  const truck = booking.truckId && typeof booking.truckId === 'object' ? booking.truckId : booking.truck;
  return (
    <RecordRow
      first={first}
      lead={<Lead icon="truckDelivery" />}
      title={load?.goodsType || t('admin:bookingsList.goodsFallback')}
      subtitle={[routeOf(load), truck?.registrationNumber].filter(Boolean).join(' · ') || null}
      meta={[booking.totalAmount ? formatCurrency(booking.totalAmount) : null, formatDate(booking.createdAt)].filter(Boolean).join(' · ')}
      right={<StatusBadge status={booking.status} />}
      onPress={() => openAdminRecord(navigation, 'booking', booking._id)}
    />
  );
};

export const TruckRow = ({ truck, first, right }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  return (
    <RecordRow
      first={first}
      lead={<Lead icon="truck" />}
      title={truck.registrationNumber}
      subtitle={[truckTypeLabel(truck.truckType, t), truck.capacity ? formatKg(truck.capacity) : null, truck.makeModel].filter(Boolean).join(' · ')}
      right={right || <StatusBadge status={truck.verificationStatus || 'not_submitted'} />}
      onPress={() => openAdminRecord(navigation, 'truck', truck._id)}
    />
  );
};

export const LoadRow = ({ load, first }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const trucks = (load.trucksNeeded || 1) > 1
    ? t('loads:truckSlots.booked', { booked: load.trucksBooked || 0, needed: load.trucksNeeded })
    : null;
  return (
    <RecordRow
      first={first}
      lead={<Lead icon="load" />}
      title={load.goodsType}
      subtitle={routeOf(load)}
      meta={[load.weight ? formatKg(load.weight) : null, trucks, formatDate(load.createdAt)].filter(Boolean).join(' · ')}
      right={<StatusBadge status={load.status} />}
      onPress={() => openAdminRecord(navigation, 'load', load._id)}
    />
  );
};

// A person on another record: their role there, and how to reach them.
export const PersonRow = ({ person, role, first, right }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  if (!person) return null;
  const name = partyName(person) || person.email || formatPhone(person.phone) || t('admin:usersList.unnamed');
  return (
    <RecordRow
      first={first}
      lead={<Lead imageUrl={person.avatarUrl} person={name} />}
      title={name}
      subtitle={[role, person.companyName && person.companyName !== name ? person.companyName : null].filter(Boolean).join(' · ') || null}
      meta={[formatPhone(person.phone), person.email].filter(Boolean).join(' · ') || null}
      right={right ?? (person.status && person.status !== 'active'
        ? <StatusBadge status={person.status} />
        : person.verified ? <VerifiedBadge size={18} label={t('admin:detail.verified')} /> : null)}
      onPress={() => openAdminRecord(navigation, 'user', person._id)}
    />
  );
};
