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
import { metersBetween } from '../map/routeMath';

// The phone reads GPS often (every 4 s, after 10 m) so the driver's own map
// moves smoothly; that costs nothing beyond the phone. What goes to the
// server is thinner: a fix once the truck has moved 30 m or turned 30
// degrees, never more than one every 8 s, and the same fix once a minute
// while it stands still so the shipper can see sharing is still on. On a
// highway that is a fix every 8-10 s; in a traffic jam, one a minute. The
// server only accepts fixes while the booking is in_transit, matching the
// one state this renders in.
const GPS_INTERVAL_MS = 4000;
const GPS_DISTANCE_M = 10;
const SEND_MIN_GAP_MS = 8000;
const SEND_AFTER_MOVING_M = 30;
const SEND_AFTER_TURNING_DEG = 30;
const STILL_SHARING_EVERY_MS = 60 * 1000;

// Whether `fix` is worth sending, given the last one sent ({ fix, at }).
export const worthSending = (fix, last, now = Date.now()) => {
  if (!fix) return false;
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed < SEND_MIN_GAP_MS) return false;
  if (elapsed >= STILL_SHARING_EVERY_MS) return true;
  if (metersBetween([last.fix.lat, last.fix.lng], [fix.lat, fix.lng]) >= SEND_AFTER_MOVING_M) return true;
  if (fix.heading != null && last.fix.heading != null) {
    const turned = Math.abs(((fix.heading - last.fix.heading + 540) % 360) - 180);
    if (turned >= SEND_AFTER_TURNING_DEG) return true;
  }
  return false;
};

// A position fix as the server and the map take it. Phones report -1 or null
// for a heading or speed they don't know; those are left out.
const fixOf = ({ coords }) => ({
  lat: coords.latitude,
  lng: coords.longitude,
  ...(coords.heading != null && coords.heading >= 0 ? { heading: coords.heading } : {}),
  ...(coords.speed != null && coords.speed >= 0 ? { speed: coords.speed } : {}),
  ...(coords.accuracy != null && coords.accuracy > 0 ? { accuracy: coords.accuracy } : {}),
});

// Shown only to the assigned driver, only while a booking is in transit.
// Sharing is opt-in per booking and stops automatically on unmount (leaving
// the screen) so a driver never broadcasts without the screen open.
// `onFix` gets each new position, so the driver's own map can show it.
const LocationSharingToggle = ({ bookingId, onFix }) => {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const subscriptionRef = useRef(null);
  const timerRef = useRef(null);
  const lastFixRef = useRef(null);
  const lastSentRef = useRef(null);
  const sendingRef = useRef(false);

  const halt = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = () => {
    halt();
    setSharing(false);
  };

  // Stop broadcasting the moment this screen goes away, not just on manual toggle.
  useEffect(() => halt, []);

  // Sends the latest fix if it's worth it, one request at a time. A failed
  // one is tried again on the next check a few seconds later.
  const sendIfWorthIt = async () => {
    const fix = lastFixRef.current;
    if (sendingRef.current || !worthSending(fix, lastSentRef.current)) return;
    sendingRef.current = true;
    try {
      await api.patch(`/bookings/${bookingId}/location`, fix);
      lastSentRef.current = { fix, at: Date.now() };
      setLastSentAt(new Date());
    } catch (error) {
      // A single dropped ping isn't worth interrupting the driver over.
      console.log('[location-share] ping failed:', getErrorMessage(error));
    }
    sendingRef.current = false;
  };

  const start = async () => {
    setStarting(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error(t('bookings:locationSharing.permissionDenied'));

      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: GPS_INTERVAL_MS, distanceInterval: GPS_DISTANCE_M },
        (position) => {
          const fix = fixOf(position);
          lastFixRef.current = fix;
          onFix?.({ ...fix, at: new Date(position.timestamp || Date.now()).toISOString() });
          sendIfWorthIt();
        }
      );
      // Catches a move that came too soon after the last send, and the
      // once-a-minute "still sharing" while standing still.
      timerRef.current = setInterval(() => {
        const before = lastSentRef.current;
        sendIfWorthIt();
        if (before && lastFixRef.current === before.fix && Date.now() - before.at >= STILL_SHARING_EVERY_MS) {
          onFix?.({ ...before.fix, at: new Date().toISOString() });
        }
      }, SEND_MIN_GAP_MS);
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
  meta: { ...type.caption, fontWeight: '400', color: colors.textMuted, marginBottom: spacing.sm },
}));

export default LocationSharingToggle;
