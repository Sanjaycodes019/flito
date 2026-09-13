import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import Card from '../common/Card';
import Button from '../common/Button';
import { FLITO_COLORS } from '../../utils/colors';
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
      if (!granted) throw new Error('Allow location access to share your position');

      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: TIME_INTERVAL_MS, distanceInterval: DISTANCE_INTERVAL_M },
        async ({ coords }) => {
          try {
            await api.patch(`/bookings/${bookingId}/location`, { lat: coords.latitude, lng: coords.longitude });
            setLastSentAt(new Date());
          } catch (error) {
            // A single dropped ping isn't worth interrupting the driver over;
            // the next one a few seconds later will likely succeed.
            console.log('[location-share] ping failed:', getErrorMessage(error));
          }
        }
      );
      setSharing(true);
    } catch (error) {
      notify('Could not start sharing', getErrorMessage(error));
    }
    setStarting(false);
  };

  return (
    <Card>
      <Text style={styles.title}>Live Location</Text>
      <Text style={styles.hint}>
        {sharing
          ? 'The shipper and owner can see your position on the map.'
          : 'Share your position so the shipper and owner can track this delivery.'}
      </Text>
      {sharing && lastSentAt && (
        <Text style={styles.meta}>Last sent {lastSentAt.toLocaleTimeString()}</Text>
      )}
      <Button
        title={sharing ? 'Stop Sharing' : 'Share My Location'}
        variant={sharing ? 'outline' : 'primary'}
        onPress={sharing ? stop : start}
        loading={starting}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginBottom: 4 },
  hint: { fontSize: 13, color: FLITO_COLORS.textMuted, marginBottom: 6 },
  meta: { fontSize: 11, color: FLITO_COLORS.textMuted, marginBottom: 8 },
});

export default LocationSharingToggle;
