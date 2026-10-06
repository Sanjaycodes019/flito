import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapCanvas from './MapCanvas';
import { buildMapHtml } from './mapHtml';
import {
  decodePolyline, measureLine, locateOnLine, formatDistance, formatDuration, freshnessOf, formatAge,
} from './routeMath';
import { getCachedRoute, cacheRoute } from './routeCache';
import api from '../../services/api';
import useBreakpoint from '../../hooks/useBreakpoint';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';

// The truck counts as off the planned road this far from it (or twice its GPS
// error, if that is larger), and the route is then redrawn from where it is,
// at most every 90 s so the free routing server isn't hammered.
const OFF_ROUTE_M = 250;
const REROUTE_EVERY_MS = 90 * 1000;
// How often "updated 20 s ago" is refreshed.
const TICK_MS = 5000;
// Beyond this an arrival clock time means little, so only the duration shows.
const CLOCK_ETA_MAX_MIN = 12 * 60;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The trip map: the road route from pickup to drop-off, and while the truck
// is under way, where it is on that road, live. The page is built once and
// then fed by postMessage (route, stops, truck), so the viewer's pan and zoom
// survive every GPS ping.
//
// driverLocation: { lat, lng, heading?, speed?, accuracy?, updatedAt? }, the
// truck's last fix; shown only while `live` (the booking is in transit).
// height: the map's height before it's made full screen; by default it
// follows the window, so it suits a phone held either way, a tablet or a
// desktop.
const TrackingMap = ({ bookingId, pickup, dropoff, driverLocation, live = false, height }) => {
  const { t, i18n } = useTranslation();
  const { height: windowHeight, isPhone } = useBreakpoint();
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(null);
  const [ends, setEnds] = useState(null);
  const [follow, setFollow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const matchedMeters = useRef(0);
  const lastRerouteAt = useRef(0);
  const rerouting = useRef(false);

  const driver = live && driverLocation?.lat != null ? driverLocation : null;

  // The page is only rebuilt when the pinned pickup/dropoff change (or the
  // language does, so popup text follows it), never for anything live.
  const html = useMemo(
    () => buildMapHtml({
      pickup,
      dropoff,
      labels: {
        pickup: t('loads:common.pickup'),
        dropoff: t('loads:common.dropoff'),
        driver: t('loads:trackingMap.truck'),
        approximate: t('loads:trackingMap.approximate'),
        twoFingers: t('loads:trackingMap.twoFingers'),
        clickToZoom: t('loads:trackingMap.clickToZoom'),
      },
    }),
    [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, i18n.language] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // A rebuilt page has to say it's ready again before it can take commands.
  useEffect(() => setReady(false), [html]);

  const post = useCallback((message) => canvasRef.current?.postMessage(message), []);

  const showRoute = useCallback((found, fromTruck) => {
    if (!fromTruck) setEnds({ pickup: found.from, dropoff: found.to, approximate: found.approximate || {} });
    const line = decodePolyline(found.polyline);
    if (line.length > 1) {
      matchedMeters.current = 0;
      setRoute({ line, along: measureLine(line), minutes: found.minutes, fromTruck: !!found.fromTruck });
    }
  }, []);

  // The planned road comes from the phone's own cache when it can, so
  // opening a booking again costs no request at all.
  const loadRoute = useCallback(async (fromTruck = false) => {
    if (!bookingId) return;
    const cached = fromTruck ? null : await getCachedRoute(bookingId);
    if (cached) {
      showRoute(cached, false);
      return;
    }
    try {
      const { data } = await api.get(`/bookings/${bookingId}/route`, fromTruck ? { params: { from: 'truck' } } : undefined);
      const found = data?.route;
      if (!found) return;
      showRoute(found, fromTruck);
      if (!fromTruck && found.polyline) cacheRoute(bookingId, found);
    } catch {
      // The map still shows the stops and the truck without a road line.
    }
  }, [bookingId, showRoute]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  useEffect(() => {
    if (!driver) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [!!driver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where the truck is along the road, matched from where it was last time
  // so a hairpin bend doesn't throw it back onto the road below.
  const progress = useMemo(() => (
    route && driver ? locateOnLine(route.line, route.along, [driver.lat, driver.lng], matchedMeters.current) : null
  ), [route, driver?.lat, driver?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (progress && progress.offRouteMeters <= OFF_ROUTE_M) matchedMeters.current = progress.metersAlong;
  }, [progress]);

  const offRoute = !!progress && progress.offRouteMeters > Math.max(OFF_ROUTE_M, 2 * (driver?.accuracy || 0));
  useEffect(() => {
    if (!offRoute || rerouting.current || Date.now() - lastRerouteAt.current < REROUTE_EVERY_MS) return;
    lastRerouteAt.current = Date.now();
    rerouting.current = true;
    loadRoute(true).finally(() => { rerouting.current = false; });
  }, [offRoute, driver?.lat, driver?.lng, loadRoute]);

  const fresh = freshnessOf(driver?.updatedAt, now);

  // Everything the page shows is re-sent once it's ready, so a rebuilt page
  // (language change) catches up.
  const shownPickup = pickup || ends?.pickup || null;
  const shownDropoff = dropoff || ends?.dropoff || null;
  useEffect(() => {
    if (!ready || !ends) return;
    post({
      type: 'setStops',
      pickup: shownPickup,
      dropoff: shownDropoff,
      approximate: { pickup: !pickup && !!ends.approximate.pickup, dropoff: !dropoff && !!ends.approximate.dropoff },
    });
  }, [ready, ends]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    post(route ? { type: 'setRoute', line: route.line } : { type: 'clearRoute' });
  }, [ready, route, post]);

  useEffect(() => {
    if (!ready) return;
    if (!driver) {
      post({ type: 'clearDriver' });
      return;
    }
    post({
      type: 'setDriver',
      lat: driver.lat,
      lng: driver.lng,
      heading: driver.heading,
      accuracy: driver.accuracy,
      stale: fresh.state === 'stale',
    });
    post({ type: 'setProgress', index: progress && !offRoute ? progress.index : null, point: progress?.point });
  }, [ready, driver?.lat, driver?.lng, driver?.heading, driver?.accuracy, fresh.state === 'stale', progress, offRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) post({ type: 'follow', on: follow && !!driver });
  }, [ready, follow, !!driver, post]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full screen, the map takes every gesture; inside the page, a phone moves
  // it with two fingers so one finger still scrolls the page past it.
  useEffect(() => {
    if (ready) post({ type: 'gestures', mode: expanded ? 'greedy' : 'cooperative' });
  }, [ready, expanded, post]);

  const collapsedHeight = height ?? clamp(Math.round(windowHeight * (isPhone ? 0.4 : 0.45)), 240, 460);
  const mapHeight = expanded ? clamp(Math.round(windowHeight * 0.8), 320, 900) : collapsedHeight;

  if (!shownPickup && !shownDropoff) {
    return (
      <View style={[styles.mapBox, styles.empty, { height: collapsedHeight }]}>
        <Icon name="location" size={iconSize.lg} color={colors.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyText}>{t('loads:trackingMap.noLocationData')}</Text>
      </View>
    );
  }

  const total = route ? route.along[route.along.length - 1] : 0;
  const metersLeft = progress && !offRoute ? progress.metersLeft : null;
  const minutesLeft = metersLeft != null && route?.minutes && total ? (route.minutes * metersLeft) / total : null;
  const arrival = minutesLeft != null && minutesLeft <= CLOCK_ETA_MAX_MIN
    ? new Date(now + minutesLeft * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const speedKmh = driver?.speed != null && fresh.state !== 'stale' ? Math.round(driver.speed * 3.6) : null;
  const approximateStop = !!ends && ((!pickup && ends.approximate.pickup) || (!dropoff && ends.approximate.dropoff));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.mapBox, { height: mapHeight }]}>
        <MapCanvas
          ref={canvasRef}
          html={html}
          style={{ width: '100%', height: '100%' }}
          onMapMessage={(msg) => {
            if (msg.type === 'ready') setReady(true);
            else if (msg.type === 'userMoved') setFollow(false);
          }}
        />
        <View style={styles.mapButtons}>
          {driver && (
            <MapButton
              icon="navigate"
              label={t('loads:trackingMap.follow')}
              accessibilityLabel={t('loads:trackingMap.followAccessibilityLabel')}
              iconOnly={isPhone}
              on={follow}
              onPress={() => setFollow((on) => !on)}
            />
          )}
          {(driver || route) && (
            <MapButton
              icon="gps"
              label={t('loads:trackingMap.fit')}
              accessibilityLabel={t('loads:trackingMap.fitMapAccessibilityLabel')}
              iconOnly={isPhone}
              onPress={() => {
                setFollow(false);
                post({ type: 'fitAll' });
              }}
            />
          )}
          <MapButton
            icon={expanded ? 'collapse' : 'expand'}
            label={t(expanded ? 'loads:trackingMap.collapse' : 'loads:trackingMap.expand')}
            accessibilityLabel={t(expanded ? 'loads:trackingMap.collapseAccessibilityLabel' : 'loads:trackingMap.expandAccessibilityLabel')}
            iconOnly={isPhone}
            onPress={() => setExpanded((on) => !on)}
          />
        </View>
      </View>

      {driver ? (
        <View style={styles.panel}>
          <View style={styles.statusRow}>
            <View style={[styles.liveDot, fresh.state !== 'live' && (fresh.state === 'recent' ? styles.liveDotRecent : styles.liveDotStale)]} />
            <Text style={styles.statusText}>
              {fresh.state === 'live' ? t('loads:trackingMap.live') : ''}
              {fresh.seconds != null
                ? `${fresh.state === 'live' ? ' · ' : ''}${t(fresh.state === 'stale' ? 'loads:trackingMap.lastSeen' : 'loads:trackingMap.updatedAgo', { age: formatAge(fresh.seconds, t) })}`
                : ''}
            </Text>
            {speedKmh != null && <Text style={styles.chip}>{t('loads:trackingMap.speed', { value: speedKmh })}</Text>}
            {driver.accuracy != null && <Text style={styles.chip}>{t('loads:trackingMap.accuracy', { value: Math.round(driver.accuracy) })}</Text>}
          </View>
          {metersLeft != null && (
            <View style={styles.etaRow}>
              <Text style={styles.etaMain}>{t('loads:trackingMap.left', { distance: formatDistance(metersLeft, t) })}</Text>
              {minutesLeft != null && <Text style={styles.etaSub}>{t('loads:trackingMap.about', { duration: formatDuration(minutesLeft, t) })}</Text>}
              {arrival && <Text style={styles.etaSub}>{t('loads:trackingMap.arrives', { time: arrival })}</Text>}
            </View>
          )}
          {offRoute && <Text style={styles.note}>{t('loads:trackingMap.offRoute')}</Text>}
          {minutesLeft != null && <Text style={styles.note}>{t('loads:trackingMap.estimateNote')}</Text>}
        </View>
      ) : route?.minutes ? (
        <View style={styles.panel}>
          <Text style={styles.statusText}>
            {t('loads:trackingMap.roadRoute', { distance: formatDistance(total, t), duration: formatDuration(route.minutes, t) })}
          </Text>
        </View>
      ) : null}
      {approximateStop && <Text style={styles.note}>{t('loads:trackingMap.approximateNote')}</Text>}
    </View>
  );
};

// A button over the map: at least 44 px square so it's easy to hit with a
// finger, and only an icon on a phone, where three words won't fit.
const MapButton = ({ icon, label, accessibilityLabel, iconOnly, on = false, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.mapButton, iconOnly && styles.mapButtonSquare, on && styles.mapButtonOn, pressed && styles.mapButtonPressed]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    accessibilityLabel={accessibilityLabel}
    hitSlop={4}
  >
    <Icon name={icon} size={iconOnly ? iconSize.md : iconSize.sm} color={on ? colors.textOnPrimary : colors.textPrimary} style={iconOnly ? null : styles.mapButtonIcon} />
    {!iconOnly && <Text style={[styles.mapButtonText, on && styles.mapButtonTextOn]}>{label}</Text>}
  </Pressable>
);

const styles = themedStyles(() => ({
  wrapper: { marginVertical: spacing.sm },
  mapBox: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  empty: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  emptyIcon: { marginBottom: spacing.xs },
  emptyText: { color: colors.textMuted, ...type.small },
  mapButtons: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, flexDirection: 'row' },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginLeft: spacing.xs,
    ...shadow.level2,
  },
  mapButtonSquare: { paddingHorizontal: 0 },
  mapButtonOn: { backgroundColor: colors.primary },
  mapButtonPressed: { opacity: 0.8 },
  mapButtonIcon: { marginRight: 4 },
  mapButtonText: { ...type.smallMedium, fontSize: 14, color: colors.textPrimary },
  mapButtonTextOn: { color: colors.textOnPrimary },
  panel: { paddingTop: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: spacing.xs },
  liveDotRecent: { backgroundColor: colors.warning },
  liveDotStale: { backgroundColor: colors.textMuted },
  statusText: { ...type.small, color: colors.textSecondary, marginRight: spacing.sm },
  chip: {
    ...type.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginRight: spacing.xs,
    overflow: 'hidden',
  },
  etaRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: spacing.xs },
  etaMain: { ...type.h3, color: colors.textPrimary, marginRight: spacing.sm },
  etaSub: { ...type.small, color: colors.textSecondary, marginRight: spacing.sm },
  note: { ...type.caption, fontWeight: '400', color: colors.textMuted, marginTop: spacing.xs },
}));

export default TrackingMap;
