import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import MapCanvas from './MapCanvas';
import { buildMapHtml } from './mapHtml';
import {
  decodePolyline, measureLine, locateOnLine, bearingBetween, formatDistance, formatDuration, freshnessOf, formatAge,
} from './routeMath';
import { getCachedRoute, cacheRoute } from './routeCache';
import PulseDot from '../common/PulseDot';
import api from '../../services/api';
import useBreakpoint from '../../hooks/useBreakpoint';
import { useTheme } from '../../theme/ThemeProvider';
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
// Full screen, a window at least this wide shows the trip in a card floating
// over the map; a narrower one in a sheet under it.
const FLOATING_CARD_MIN_WIDTH = 600;
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The trip map: the road from pickup to drop-off, and while the truck is under
// way, where it is on that road, live, with what is left of the trip below.
// The page is built once and then fed by postMessage (route, stops, truck), so
// the viewer's pan and zoom survive every GPS ping.
//
// pickupName / dropoffName: short names for the stops ("Basantapur,
// Kathmandu"), shown beside their pins and under the progress bar.
// driverLocation: { lat, lng, heading?, speed?, accuracy?, updatedAt? }, the
// truck's last fix; shown only while `live` (the booking is in transit).
// delivered: the trip is over, so the progress bar is full.
// height: the map's height in the page; by default it follows the window, so
// it suits a phone held either way, a tablet or a desktop.
const TrackingMap = ({
  bookingId, pickup, dropoff, pickupName, dropoffName, driverLocation, live = false, delivered = false, height,
}) => {
  const { t, i18n } = useTranslation();
  const { scheme } = useTheme();
  const { width: windowWidth, height: windowHeight, isPhone } = useBreakpoint();
  const insets = useContext(SafeAreaInsetsContext) || NO_INSETS;
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(null);
  const [plannedMeters, setPlannedMeters] = useState(null);
  const [ends, setEnds] = useState(null);
  const [follow, setFollow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const matchedMeters = useRef(0);
  const lastRerouteAt = useRef(0);
  const rerouting = useRef(false);

  const driver = live && driverLocation?.lat != null ? driverLocation : null;

  // The page is only rebuilt when the pinned pickup/dropoff change, or the
  // language or theme does, never for anything live.
  const html = useMemo(
    () => buildMapHtml({
      pickup,
      dropoff,
      theme: scheme,
      zoomControl: false,
      labels: {
        pickup: t('loads:common.pickup'),
        dropoff: t('loads:common.dropoff'),
        driver: t('loads:trackingMap.truck'),
        approximate: t('loads:trackingMap.approximate'),
        twoFingers: t('loads:trackingMap.twoFingers'),
        clickToZoom: t('loads:trackingMap.clickToZoom'),
      },
    }),
    [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, i18n.language, scheme] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // A new page (rebuilt, or opened full screen) has to say it's ready again
  // before it can take commands.
  useEffect(() => setReady(false), [html, expanded]);

  const post = useCallback((message) => canvasRef.current?.postMessage(message), []);

  const showRoute = useCallback((found, fromTruck) => {
    if (!fromTruck) setEnds({ pickup: found.from, dropoff: found.to, approximate: found.approximate || {} });
    const line = decodePolyline(found.polyline);
    if (line.length > 1) {
      const along = measureLine(line);
      matchedMeters.current = 0;
      if (!fromTruck) setPlannedMeters(along[along.length - 1]);
      setRoute({ line, along, minutes: found.minutes, fromTruck: !!found.fromTruck });
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
  const onRoad = !!progress && !offRoute;
  const total = route ? route.along[route.along.length - 1] : 0;
  const metersLeft = onRoad ? progress.metersLeft : null;
  const minutesLeft = metersLeft != null && route?.minutes && total ? (route.minutes * metersLeft) / total : null;
  const arrival = minutesLeft != null && minutesLeft <= CLOCK_ETA_MAX_MIN
    ? new Date(now + minutesLeft * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  // A phone that doesn't report a heading still gets its truck pointing down
  // the road it is on.
  const heading = driver?.heading ?? (onRoad ? bearingBetween(route.line[progress.index], route.line[progress.index + 1]) : undefined);

  // Everything the page shows is re-sent once it's ready, so a new page
  // (rebuilt, or opened full screen) catches up.
  const shownPickup = pickup || ends?.pickup || null;
  const shownDropoff = dropoff || ends?.dropoff || null;
  useEffect(() => {
    if (!ready || (!shownPickup && !shownDropoff)) return;
    post({
      type: 'setStops',
      pickup: shownPickup,
      dropoff: shownDropoff,
      names: { pickup: pickupName || null, dropoff: dropoffName || null },
      approximate: { pickup: !pickup && !!ends?.approximate?.pickup, dropoff: !dropoff && !!ends?.approximate?.dropoff },
    });
  }, [ready, ends, pickupName, dropoffName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    post(route ? { type: 'setRoute', line: route.line } : { type: 'clearRoute' });
  }, [ready, route, post]);

  const truckLabel = minutesLeft != null ? formatDuration(minutesLeft, t) : null;
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
      heading,
      accuracy: driver.accuracy,
      stale: fresh.state === 'stale',
      label: truckLabel,
    });
    post({ type: 'setProgress', index: onRoad ? progress.index : null, point: progress?.point });
  }, [ready, driver?.lat, driver?.lng, heading, driver?.accuracy, fresh.state === 'stale', truckLabel, progress, onRoad]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) post({ type: 'follow', on: follow && !!driver });
  }, [ready, follow, !!driver, post]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full screen, the map takes every gesture; inside the page, a phone moves
  // it with two fingers so one finger still scrolls the page past it.
  useEffect(() => {
    if (ready) post({ type: 'gestures', mode: expanded ? 'greedy' : 'cooperative' });
  }, [ready, expanded, post]);

  // Full screen on a wide window the trip card floats over the top left of
  // the map, so "show the whole trip" keeps the route out from under it: to
  // its right on a landscape screen, below it on a portrait one.
  const floatingCard = expanded && windowWidth >= FLOATING_CARD_MIN_WIDTH;
  const cardWidth = Math.min(380, windowWidth - spacing.md * 2);
  const cardTop = insets.top + spacing.md + 44;
  useEffect(() => {
    if (!ready) return;
    // 72 px at the sides keeps a stop's name, centred over its pin, on the map.
    let topLeft = [72, 84];
    if (floatingCard) topLeft = windowWidth > windowHeight ? [cardWidth + 72, 84] : [72, cardTop + cardHeight + 64];
    post({ type: 'setPadding', topLeft, bottomRight: [72, 28] });
  }, [ready, floatingCard, cardWidth, cardTop, cardHeight, windowWidth, windowHeight, post]);

  const inlineHeight = height ?? clamp(Math.round(windowHeight * (isPhone ? 0.42 : 0.48)), 240, 480);

  if (!shownPickup && !shownDropoff) {
    return (
      <View style={[styles.mapBox, styles.empty, { height: inlineHeight }]}>
        <Icon name="location" size={iconSize.lg} color={colors.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyText}>{t('loads:trackingMap.noLocationData')}</Text>
      </View>
    );
  }

  // What the panel says, from the most to the least that is known.
  const summary = (() => {
    if (driver && metersLeft != null) {
      return {
        headline: arrival ? t('loads:trackingMap.arrives', { time: arrival }) : t('loads:trackingMap.toGo', { duration: formatDuration(minutesLeft, t) }),
        detail: minutesLeft != null
          ? t('loads:trackingMap.remaining', { duration: formatDuration(minutesLeft, t), distance: formatDistance(metersLeft, t) })
          : t('loads:trackingMap.distanceLeft', { distance: formatDistance(metersLeft, t) }),
        fraction: plannedMeters ? 1 - metersLeft / plannedMeters : progress.fraction,
        estimate: minutesLeft != null,
      };
    }
    if (driver && offRoute) return { headline: t('loads:trackingMap.offRouteTitle'), detail: t('loads:trackingMap.offRoute'), fraction: null };
    if (driver) return { headline: t('loads:trackingMap.whereTruckIs'), detail: null, fraction: null };
    if (route) {
      if (delivered) {
        return { headline: t('loads:trackingMap.delivered'), detail: t('loads:trackingMap.byRoad', { distance: formatDistance(total, t) }), fraction: 1 };
      }
      return {
        headline: t('loads:trackingMap.byRoad', { distance: formatDistance(total, t) }),
        detail: route.minutes ? t('loads:trackingMap.byTruck', { duration: formatDuration(route.minutes, t) }) : null,
        fraction: 0,
        estimate: !!route.minutes,
      };
    }
    return null;
  })();

  const speedKmh = driver?.speed != null && fresh.state !== 'stale' ? Math.round(driver.speed * 3.6) : null;
  const approximateStop = !!ends && ((!pickup && ends.approximate.pickup) || (!dropoff && ends.approximate.dropoff));
  const statusText = !driver || fresh.seconds == null ? null
    : fresh.state === 'live' ? t('loads:trackingMap.liveAgo', { age: formatAge(fresh.seconds, t) })
      : t(fresh.state === 'stale' ? 'loads:trackingMap.lastSeen' : 'loads:trackingMap.updatedAgo', { age: formatAge(fresh.seconds, t) });
  const statusColor = fresh.state === 'live' ? colors.success : fresh.state === 'recent' ? colors.warning : colors.textMuted;
  // A mouse has no pinch: wherever there is one, the map gets + and - buttons.
  const showZoom = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

  const panel = summary || driver ? (
    <TripPanel
      t={t}
      summary={summary}
      pickupName={pickupName || t('loads:common.pickup')}
      dropoffName={dropoffName || t('loads:common.dropoff')}
      live={!!driver}
      speedKmh={speedKmh}
      accuracy={driver?.accuracy}
      approximateStop={approximateStop}
    />
  ) : null;

  const stage = (fullScreen) => (
    <>
      <MapCanvas
        ref={canvasRef}
        html={html}
        style={{ width: '100%', height: '100%' }}
        onMapMessage={(msg) => {
          if (msg.type === 'ready') setReady(true);
          else if (msg.type === 'userMoved') setFollow(false);
        }}
      />
      {statusText && (
        <View style={[styles.statusPill, fullScreen && { top: insets.top + spacing.md, left: insets.left + spacing.md }]} pointerEvents="none">
          <PulseDot color={statusColor} size={7} pulsing={fresh.state === 'live'} />
          <Text style={styles.statusText} numberOfLines={1}>{statusText}</Text>
        </View>
      )}
      <View style={[styles.topRight, fullScreen && { top: insets.top + spacing.md, right: insets.right + spacing.md }]}>
        <MapButton
          icon={fullScreen ? 'close' : 'expand'}
          accessibilityLabel={t(fullScreen ? 'loads:trackingMap.collapseAccessibilityLabel' : 'loads:trackingMap.expandAccessibilityLabel')}
          onPress={() => setExpanded(!fullScreen)}
        />
      </View>
      <View style={[styles.controls, fullScreen && { right: insets.right + spacing.md }]}>
        {showZoom && (
          <View style={styles.zoomGroup}>
            <MapButton icon="add" grouped accessibilityLabel={t('loads:trackingMap.zoomIn')} onPress={() => post({ type: 'zoomIn' })} />
            <View style={styles.zoomDivider} />
            <MapButton icon="remove" grouped accessibilityLabel={t('loads:trackingMap.zoomOut')} onPress={() => post({ type: 'zoomOut' })} />
          </View>
        )}
        {driver && (
          <MapButton
            icon="navigate"
            on={follow}
            accessibilityLabel={t('loads:trackingMap.followAccessibilityLabel')}
            onPress={() => setFollow((on) => !on)}
          />
        )}
        {(driver || route) && (
          <MapButton
            icon="area"
            accessibilityLabel={t('loads:trackingMap.fitMapAccessibilityLabel')}
            onPress={() => {
              setFollow(false);
              post({ type: 'fitAll' });
            }}
          />
        )}
      </View>
    </>
  );

  return (
    <View style={styles.wrapper}>
      {expanded ? (
        <Pressable
          style={[styles.mapBox, styles.placeholder, { height: inlineHeight }]}
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel={t('loads:trackingMap.fullScreenOpen')}
        >
          <Icon name="area" size={iconSize.lg} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>{t('loads:trackingMap.fullScreenOpen')}</Text>
        </Pressable>
      ) : (
        <View style={[styles.mapBox, { height: inlineHeight }]}>{stage(false)}</View>
      )}
      {panel && <View style={styles.inlinePanel}>{panel}</View>}

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
      >
        <View style={styles.fullScreen}>
          {floatingCard ? (
            <>
              <View style={StyleSheet.absoluteFill}>{stage(true)}</View>
              {panel && (
                <View
                  style={[styles.floatingCard, { top: cardTop, left: insets.left + spacing.md, width: cardWidth }]}
                  onLayout={(event) => setCardHeight(Math.round(event.nativeEvent.layout.height))}
                >
                  {panel}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.fullScreenMap}>{stage(true)}</View>
              {panel && (
                <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
                  <View style={styles.sheetHandle} />
                  {panel}
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

// What is left of the trip: when it gets there, how far and how long, a bar
// from pickup to drop-off with the truck on it, and the truck's speed and GPS
// accuracy while it is moving.
const TripPanel = ({ t, summary, pickupName, dropoffName, live, speedKmh, accuracy, approximateStop }) => {
  const percent = summary?.fraction != null ? Math.round(clamp(summary.fraction, 0, 1) * 100) : null;
  return (
    <View>
      {summary && (
        <>
          <Text style={styles.headline}>{summary.headline}</Text>
          {!!summary.detail && <Text style={styles.detail}>{summary.detail}</Text>}
        </>
      )}
      {percent != null && (
        <View style={styles.progress}>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel={t('loads:trackingMap.progressAccessibilityLabel', { percent })}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
          >
            <View style={[styles.trackDone, { width: `${percent}%` }]} />
            <View style={[styles.trackEnd, styles.trackStart]} />
            <View style={[styles.trackEnd, styles.trackFinish, percent >= 100 && styles.trackFinishDone]} />
            {live && (
              <View style={[styles.truckBadge, { left: `${percent}%` }]}>
                <Icon name="truckDelivery" size={iconSize.sm} color={colors.textOnPrimary} />
              </View>
            )}
          </View>
          <View style={styles.endsRow}>
            <Text style={[styles.endName, styles.endNameStart]} numberOfLines={1}>{pickupName}</Text>
            <Text style={[styles.endName, styles.endNameFinish]} numberOfLines={1}>{dropoffName}</Text>
          </View>
        </View>
      )}
      {live && (speedKmh != null || accuracy != null) && (
        <View style={styles.chips}>
          {speedKmh != null && (
            <View style={styles.chip}>
              <Icon name="speedometer" size={iconSize.xs} color={colors.textSecondary} style={styles.chipIcon} />
              <Text style={styles.chipText}>{t('loads:trackingMap.speed', { value: speedKmh })}</Text>
            </View>
          )}
          {accuracy != null && (
            <View style={styles.chip}>
              <Icon name="gps" size={iconSize.xs} color={colors.textSecondary} style={styles.chipIcon} />
              <Text style={styles.chipText}>{t('loads:trackingMap.gpsAccuracy', { value: Math.round(accuracy) })}</Text>
            </View>
          )}
        </View>
      )}
      {summary?.estimate && <Text style={styles.note}>{t('loads:trackingMap.estimateNote')}</Text>}
      {approximateStop && <Text style={styles.note}>{t('loads:trackingMap.approximateNote')}</Text>}
    </View>
  );
};

// A round button floating over the map, at least 44 px so it is easy to hit
// with a finger. `grouped` buttons share one rounded box (zoom in and out).
const MapButton = ({ icon, accessibilityLabel, on = false, grouped = false, onPress }) => (
  <Pressable
    style={({ pressed, hovered }) => [
      grouped ? styles.groupedButton : styles.mapButton,
      on && styles.mapButtonOn,
      (pressed || hovered) && !on && styles.mapButtonActive,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    accessibilityLabel={accessibilityLabel}
    hitSlop={4}
  >
    <Icon name={icon} size={iconSize.md} color={on ? colors.textOnPrimary : colors.textPrimary} />
  </Pressable>
);

const BUTTON = 44;

const styles = themedStyles(() => ({
  wrapper: { marginVertical: spacing.sm },
  mapBox: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  empty: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  emptyIcon: { marginBottom: spacing.xs },
  emptyText: { color: colors.textMuted, ...type.small, textAlign: 'center', paddingHorizontal: spacing.md },

  statusPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    maxWidth: '70%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingLeft: 2,
    paddingRight: spacing.sm,
    minHeight: 30,
    ...shadow.level2,
  },
  statusText: { ...type.caption, color: colors.textPrimary },
  topRight: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  controls: { position: 'absolute', right: spacing.sm, bottom: spacing.lg, alignItems: 'flex-end', gap: spacing.sm },
  mapButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.level2,
  },
  mapButtonOn: { backgroundColor: colors.primary },
  mapButtonActive: { backgroundColor: colors.surfaceMuted },
  zoomGroup: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, ...shadow.level2 },
  groupedButton: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  zoomDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  inlinePanel: { paddingTop: spacing.md },
  fullScreen: { flex: 1, backgroundColor: colors.surface },
  fullScreenMap: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadow.level3,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  floatingCard: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.level3,
  },

  headline: { ...type.h2, color: colors.textPrimary },
  detail: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  progress: { marginTop: spacing.md },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, marginHorizontal: 7, justifyContent: 'center' },
  trackDone: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.accent },
  trackEnd: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: colors.surface },
  trackStart: { left: -7, borderColor: colors.accent },
  trackFinish: { right: -7, borderColor: colors.error },
  trackFinishDone: { backgroundColor: colors.error },
  truckBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    ...shadow.level2,
  },
  endsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.md },
  endName: { ...type.caption, fontWeight: '600', color: colors.textSecondary, flexShrink: 1 },
  endNameStart: { textAlign: 'left' },
  endNameFinish: { textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipIcon: { marginRight: 4 },
  chipText: { ...type.caption, fontWeight: '600', color: colors.textSecondary },
  note: { ...type.caption, fontWeight: '400', color: colors.textMuted, marginTop: spacing.sm },
}));

export default TrackingMap;
