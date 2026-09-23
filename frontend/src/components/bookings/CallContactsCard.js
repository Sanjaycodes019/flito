import React from 'react';
import { View, Text, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../../theme/tokens';
import { notify } from '../../utils/alert';

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ');

// Everyone on this job the viewer might need to phone: the other people on
// the booking, then the contact people named at the pickup and drop-off.
// People without a number still get a row, so it is clear why there is no
// button rather than the person silently missing.
const contactsFor = (booking, myId, t) => {
  const people = [
    { key: 'shipper', icon: 'shipper', person: booking.shipperId, role: t('bookings:detail.shipper') },
    { key: 'owner', icon: 'owner', person: booking.ownerId, role: t('bookings:detail.owner') },
    { key: 'driver', icon: 'driver', person: booking.driverId, role: t('bookings:detail.driver') },
  ]
    .filter(({ person }) => person && typeof person === 'object' && String(person._id) !== myId)
    .map(({ key, icon, person, role }) => ({
      key,
      icon,
      role,
      name: (key === 'owner' && person.companyName) || fullName(person),
      phone: person.phone,
    }));

  const stops = [
    { key: 'pickupContact', icon: 'pickup', stop: booking.loadId?.pickupLocation, role: t('bookings:contacts.pickupContact') },
    { key: 'dropoffContact', icon: 'dropoff', stop: booking.loadId?.dropoffLocation, role: t('bookings:contacts.dropoffContact') },
  ]
    .filter(({ stop }) => stop?.phone)
    .map(({ key, icon, stop, role }) => ({ key, icon, role, name: stop.contactPerson || '', phone: stop.phone }));

  return [...people, ...stops];
};

const CallContactsCard = ({ booking, myId }) => {
  const { t } = useTranslation();
  if (booking.status === 'cancelled') return null;

  const contacts = contactsFor(booking, myId, t);
  if (!contacts.length) return null;

  const call = async (phone) => {
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (error) {
      notify(t('bookings:contacts.couldNotCallTitle'), t('bookings:contacts.couldNotCallMessage', { phone }));
    }
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name="phone" size={iconSize.md} color={colors.primaryText} />
        <Text style={styles.title}>{t('bookings:contacts.title')}</Text>
      </View>
      {contacts.map((contact) => (
        <View key={contact.key} style={styles.row}>
          <Icon name={contact.icon} size={iconSize.lg} color={colors.textMuted} />
          <View style={styles.who}>
            <Text style={styles.role}>{contact.role}</Text>
            {!!contact.name && <Text style={styles.name} numberOfLines={2}>{contact.name}</Text>}
            {!contact.phone && <Text style={styles.noPhone}>{t('bookings:contacts.noPhone')}</Text>}
          </View>
          {!!contact.phone && (
            <Button
              title={t('bookings:contacts.call')}
              icon="phone"
              size="lg"
              onPress={() => call(contact.phone)}
              accessibilityLabel={t('bookings:contacts.callAccessibilityLabel', { name: contact.name || contact.role })}
              style={styles.callButton}
            />
          )}
        </View>
      ))}
    </Card>
  );
};

const styles = themedStyles(() => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  who: { flex: 1, minWidth: 0 },
  role: { ...type.small, color: colors.textMuted },
  name: { ...type.bodyLarge, fontWeight: '600', color: colors.textPrimary },
  noPhone: { ...type.small, color: colors.textMuted, fontStyle: 'italic' },
  callButton: { marginVertical: 0, paddingHorizontal: spacing.md },
}));

export default CallContactsCard;
