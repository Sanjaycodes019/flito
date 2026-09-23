import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapCanvas from './MapCanvas';
import { buildMapHtml } from './mapHtml';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';

// Read-only map: static pickup/dropoff pins plus a driver marker that moves
// live as `driverLocation` changes, without reloading the page (so the user's
// pan/zoom isn't reset on every GPS ping).
const TrackingMap = ({ pickup, dropoff, driverLocation, height = 260 }) => {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const sentDriverLocation = useRef(null);

  // The page is only rebuilt when the static pickup/dropoff points change (or
  // the language does, so the popup text follows it), never for driver
  // movement, which goes through postMessage instead.
  const html = useMemo(
    () => buildMapHtml({ pickup, dropoff, labels: { pickup: t('loads:common.pickup'), dropoff: t('loads:common.dropoff') } }),
    [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, i18n.language] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pushDriverLocation = (loc) => {
    if (!canvasRef.current) return;
    if (loc) canvasRef.current.postMessage({ type: 'setDriver', lat: loc.lat, lng: loc.lng });
    else canvasRef.current.postMessage({ type: 'clearDriver' });
    sentDriverLocation.current = loc ? `${loc.lat},${loc.lng}` : null;
  };

  const key = driverLocation ? `${driverLocation.lat},${driverLocation.lng}` : null;
  if (ready && key !== sentDriverLocation.current) {
    pushDriverLocation(driverLocation);
  }

  if (!pickup && !dropoff) {
    return (
      <View style={[styles.container, styles.empty, { height }]}>
        <Icon name="location" size={iconSize.lg} color={colors.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyText}>{t('loads:trackingMap.noLocationData')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapCanvas
        ref={canvasRef}
        html={html}
        style={{ width: '100%', height: '100%' }}
        onMapMessage={(msg) => {
          if (msg.type === 'ready') {
            setReady(true);
            if (driverLocation) pushDriverLocation(driverLocation);
          }
        }}
      />
      {driverLocation && (
        <Pressable
          style={styles.recenterButton}
          onPress={() => canvasRef.current?.postMessage({ type: 'fitAll' })}
          accessibilityRole="button"
          accessibilityLabel={t('loads:trackingMap.fitMapAccessibilityLabel')}
        >
          <Icon name="gps" size={iconSize.xs} color={colors.textPrimary} style={styles.recenterIcon} />
          <Text style={styles.recenterText}>{t('loads:trackingMap.fit')}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  container: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginVertical: spacing.sm },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { marginBottom: spacing.xs },
  emptyText: { color: colors.textMuted, ...type.small },
  recenterButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    ...shadow.level2,
  },
  recenterIcon: { marginRight: 4 },
  recenterText: { ...type.smallMedium, fontSize: 14, color: colors.textPrimary },
}));

export default TrackingMap;
