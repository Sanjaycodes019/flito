import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import MapCanvas from './MapCanvas';
import Button from '../common/Button';
import { buildMapHtml } from './mapHtml';
import { colors, spacing, radius, type } from '../../theme/tokens';

const samePoint = (a, b) => (!a && !b) || (a && b && a.lat === b.lat && a.lng === b.lng);

// Tap-to-pick coordinates for a load's pickup/dropoff. Kept deliberately
// separate from TrackingMap: this one is interactive and single-marker,
// TrackingMap is read-only and multi-marker.
const LocationPickerMap = ({ value, onChange, height = 220, showLocateButton = true }) => {
  const canvasRef = useRef(null);
  const [locating, setLocating] = useState(false);
  // The point the map itself last showed, so a pin the user just placed isn't
  // sent straight back into the map.
  const shown = useRef(value || null);

  // Rebuilt only if the marker's starting point changes identity-wise (not on
  // every pixel of a drag). The page manages the marker itself after that.
  const html = useMemo(() => buildMapHtml({ interactive: true, initialPicked: value || null }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // A point set from outside the map (a detected location, or cleared because
  // the address changed) moves or removes the pin.
  useEffect(() => {
    const next = value || null;
    if (samePoint(next, shown.current)) return;
    shown.current = next;
    canvasRef.current?.postMessage(next ? { type: 'setPicked', lat: next.lat, lng: next.lng } : { type: 'clearPicked' });
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        throw new Error('Allow location access to use your current position');
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onChange({ lat: coords.latitude, lng: coords.longitude });
    } catch (error) {
      // Surfaced inline rather than a full alert. This is a minor, recoverable step.
      setLocating(false);
      throw error;
    }
    setLocating(false);
  };

  return (
    <View>
      <View style={[styles.container, { height }]}>
        <MapCanvas
          ref={canvasRef}
          html={html}
          style={{ width: '100%', height: '100%' }}
          onMapMessage={(msg) => {
            if (msg.type !== 'picked') return;
            shown.current = { lat: msg.lat, lng: msg.lng };
            onChange({ lat: msg.lat, lng: msg.lng });
          }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.hint}>
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Tap the map to set the exact point'}
        </Text>
        {showLocateButton && (
          <Button
            title="Use My Location"
            icon="gps"
            variant="tertiary"
            size="sm"
            loading={locating}
            onPress={() => useCurrentLocation().catch(() => {})}
            style={styles.locateButton}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.sm },
  hint: { flex: 1, ...type.small, color: colors.textMuted, marginRight: spacing.sm },
  locateButton: { minWidth: 140 },
});

export default LocationPickerMap;
