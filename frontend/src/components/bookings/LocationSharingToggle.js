import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import PulseDot from '../common/PulseDot';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
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

// How sure the phone is of where it is, from the radius of its GPS fix.
export const gpsQualityOf = (accuracy) => {
  if (accuracy == null) return null;
  if (accuracy <= 20) return 'good';
  if (accuracy <= 60) return 'fair';
  return 'poor';
};

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
  const [accuracy, setAccuracy] = useState(null);
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
          setAccuracy(fix.accuracy ?? null);
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

  const quality = sharing ? gpsQualityOf(accuracy) : null;
  const tone = { good: colors.successText, fair: colors.warningText, poor: colors.errorText }[quality];
  const toneBackground = { good: colors.successMuted, fair: colors.warningMuted, poor: colors.errorMuted }[quality];

  return (
    <Card>
      <View style={styles.titleRow}>
        <View style={[styles.titleIcon, sharing && styles.titleIconOn]}>
          <Icon name={sharing ? 'gps' : 'location'} size={iconSize.md} color={sharing ? colors.successText : colors.primaryText} />
        </View>
        <Text style={styles.title}>{t('bookings:locationSharing.title')}</Text>
        <View style={[styles.badge, sharing ? styles.badgeOn : styles.badgeOff]}>
          {sharing && <PulseDot color={colors.success} size={6} />}
          <Text style={[styles.badgeText, sharing && styles.badgeTextOn]}>
            {t(sharing ? 'bookings:locationSharing.on' : 'bookings:locationSharing.off')}
          </Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {sharing
          ? t('bookings:locationSharing.sharingHint')
          : t('bookings:locationSharing.notSharingHint')}
      </Text>
      {sharing && (lastSentAt || quality) && (
        <View style={styles.metaRow}>
          {lastSentAt && (
            <Text style={styles.meta}>{t('bookings:locationSharing.lastSent', { time: lastSentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) })}</Text>
          )}
          {quality && (
            <View style={[styles.quality, { backgroundColor: toneBackground }]}>
              <Icon name="gps" size={iconSize.xs} color={tone} style={styles.qualityIcon} />
              <Text style={[styles.qualityText, { color: tone }]}>
                {t(`bookings:locationSharing.gps.${quality}`, { meters: Math.round(accuracy) })}
              </Text>
            </View>
          )}
        </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
    marginRight: spacing.sm,
  },
  titleIconOn: { backgroundColor: colors.successMuted },
  title: { ...type.h3, color: colors.textPrimary, flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingLeft: spacing.xs, paddingRight: spacing.sm, minHeight: 24 },
  badgeOn: { backgroundColor: colors.successMuted },
  badgeOff: { backgroundColor: colors.surfaceMuted, paddingLeft: spacing.sm },
  badgeText: { ...type.caption, color: colors.textMuted },
  badgeTextOn: { color: colors.successText },
  hint: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  meta: { ...type.caption, fontWeight: '400', color: colors.textMuted },
  quality: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  qualityIcon: { marginRight: 4 },
  qualityText: { ...type.caption, fontWeight: '600' },
}));

export default LocationSharingToggle;
