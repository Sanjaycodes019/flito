import React from 'react';
import { View, Text, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// The four things a driver does on every job, in order. Each names the
// status update it sends and whether it needs an "are you sure?" first (the
// two that can't be taken back).
const STEPS = [
  { key: 'arrivedPickup', icon: 'pickup', send: { pickupStatus: 'arrived' } },
  { key: 'loaded', icon: 'load', send: { pickupStatus: 'picked_up', status: 'in_transit' }, confirm: 'pickedUp' },
  { key: 'arrivedDropoff', icon: 'dropoff', send: { dropoffStatus: 'arrived' } },
  { key: 'delivered', icon: 'success', send: { dropoffStatus: 'delivered', status: 'completed' }, confirm: 'delivered' },
];

// Which step is next, from what the driver has reported so far: 0-3, or 4
// once the goods are delivered.
export const nextStepIndex = (booking) => {
  if (booking.dropoffStatus === 'delivered') return 4;
  if (booking.dropoffStatus === 'arrived') return 3;
  if (booking.pickupStatus === 'picked_up') return 2;
  if (booking.pickupStatus === 'arrived') return 1;
  return 0;
};

// Google Maps directions to a stop: its pinned spot when there is one,
// otherwise its written address. Opens the Maps app on a phone.
const directionsUrl = (stop) => {
  const { lat, lng } = stop?.coordinates || {};
  const destination = lat != null && lng != null ? `${lat},${lng}` : stop?.address;
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
};

// A driver's whole job as one big button for the next thing to do, with the
// four steps listed underneath so they can see how far along they are.
const DriverJobCard = ({ booking, busy, onStep }) => {
  const { t } = useTranslation();
  const current = nextStepIndex(booking);
  const step = STEPS[current];
  if (!step) return null;

  const goingToPickup = current < 2;
  const stop = goingToPickup ? booking.loadId?.pickupLocation : booking.loadId?.dropoffLocation;
  const mapUrl = directionsUrl(stop);

  return (
    <Card>
      <Text style={styles.kicker}>{t('bookings:driverJob.nextStep')}</Text>
      <Text style={styles.where}>
        {t(goingToPickup ? 'bookings:driverJob.goToPickup' : 'bookings:driverJob.goToDropoff')}
      </Text>
      {!!stop?.address && <Text style={styles.address}>{stop.address}</Text>}

      <Button
        title={t(`bookings:driverJob.steps.${step.key}.button`)}
        icon={step.icon}
        size="lg"
        onPress={() => onStep(step)}
        loading={busy}
        style={styles.mainButton}
      />
      {mapUrl && (
        <Button
          title={t('bookings:driverJob.directions')}
          icon="location"
          variant="tertiary"
          onPress={() => Linking.openURL(mapUrl).catch(() => {})}
        />
      )}

      <View style={styles.steps} accessibilityRole="list">
        {STEPS.map((item, index) => {
          const done = index < current;
          const now = index === current;
          return (
            <View key={item.key} style={styles.stepRow} accessibilityLabel={t(`bookings:driverJob.steps.${item.key}.label`)}>
              <View style={[styles.stepDot, done && styles.stepDotDone, now && styles.stepDotNow]}>
                {done
                  ? <Icon name="checkmark" size={iconSize.sm} color={colors.textOnPrimary} />
                  : <Text style={[styles.stepNumber, now && styles.stepNumberNow]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.stepText, done && styles.stepTextDone, now && styles.stepTextNow]}>
                {t(`bookings:driverJob.steps.${item.key}.label`)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
};

const DOT = 30;

const styles = themedStyles(() => ({
  kicker: { ...type.smallMedium, color: colors.textMuted, textTransform: 'uppercase' },
  where: { ...type.h2, color: colors.textPrimary, marginTop: spacing.xxs },
  address: { ...type.bodyLarge, color: colors.textSecondary, marginTop: spacing.xxs },
  mainButton: { marginTop: spacing.lg },
  steps: { marginTop: spacing.lg, gap: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepDot: {
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepDotNow: { borderColor: colors.primaryText },
  stepNumber: { ...type.smallMedium, color: colors.textMuted },
  stepNumberNow: { color: colors.primaryText },
  stepText: { ...type.body, color: colors.textMuted, flex: 1 },
  stepTextDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  stepTextNow: { ...type.bodyMedium, color: colors.textPrimary },
}));

export default DriverJobCard;
