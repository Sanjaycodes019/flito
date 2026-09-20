import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../../theme/tokens';
import { getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import api from '../../services/api';

// How often the driver's position is sampled and pushed while sharing.
// The server only accepts pings while the booking is in_transit, matching
// the one state this component renders in.
const TIME_INTERVAL_MS = 15000;
const DISTANCE_INTERVAL_M = 25;

// Shown only to the assigned driver, only while a booking is in transit.
// Sharing is opt-in per booking and stops automatically on unmount (leaving
// the screen) so a driver never broadcasts without the screen open.
const LocationSharingToggle = ({ bookingId }) => {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const subscriptionRef = useRef(null);

  const stop = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setSharing(false);
  };

  // Stop broadcasting the moment this screen goes away, not just on manual toggle.
  useEffect(() => () => subscriptionRef.current?.remove(), []);

  const start = async () => {
    setStarting(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error(t('bookings:locationSharing.permissionDenied'));

      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: TIME_INTERVAL_MS, distanceInterval: DISTANCE_INTERVAL_M },
        async ({ coords }) => {
          try {
            await api.patch(`/bookings/${bookingId}/location`, { lat: coords.latitude, lng: coords.longitude });
            setLastSentAt(new Date());
          } catch (error) {
            // A single dropped ping isn't worth interrupting the driver over.
            // The next one a few seconds later will likely succeed.
            console.log('[location-share] ping failed:', getErrorMessage(error));
          }
        }
      );
      setSharing(true);
    } catch (error) {
      notify(t('bookings:locationSharing.couldNotStartTitle'), getErrorMessage(error));
    }
    setStarting(false);
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name={sharing ? 'gps' : 'location'} size={iconSize.md} color={sharing ? colors.successText : colors.primaryText} style={styles.titleIcon} />
        <Text style={styles.title}>{t('bookings:locationSharing.title')}</Text>
        {sharing && <View style={styles.liveDot} />}
      </View>
      <Text style={styles.hint}>
        {sharing
          ? t('bookings:locationSharing.sharingHint')
          : t('bookings:locationSharing.notSharingHint')}
      </Text>
      {sharing && lastSentAt && (
        <Text style={styles.meta}>{t('bookings:locationSharing.lastSent', { time: lastSentAt.toLocaleTimeString() })}</Text>
      )}
      <Button
        title={sharing ? t('bookings:locationSharing.stopSharing') : t('bookings:locationSharing.shareMyLocation')}
        icon={sharing ? 'close' : 'gps'}
        variant={sharing ? 'tertiary' : 'primary'}
        onPress={sharing ? stop : start}
        loading={starting}
      />
    </Card>
  );
};

const styles = themedStyles(() => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  titleIcon: { marginRight: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginLeft: spacing.sm },
  hint: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  meta: { ...type.small, fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
}));

export default LocationSharingToggle;
