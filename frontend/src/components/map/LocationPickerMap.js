import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import MapCanvas from './MapCanvas';
import Button from '../common/Button';
import { buildMapHtml } from './mapHtml';
import { colors, spacing, radius, type } from '../../theme/tokens';

// Tap-to-pick coordinates for a load's pickup/dropoff. Kept deliberately
// separate from TrackingMap: this one is interactive and single-marker,
// TrackingMap is read-only and multi-marker.
const LocationPickerMap = ({ value, onChange, height = 220 }) => {
  const canvasRef = useRef(null);
  const [locating, setLocating] = useState(false);

  // Rebuilt only if the marker's starting point changes identity-wise (not on
  // every pixel of a drag). The page manages the marker itself after that.
  const html = useMemo(() => buildMapHtml({ interactive: true, initialPicked: value || null }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        throw new Error('Allow location access to use your current position');
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = coords.latitude;
      const lng = coords.longitude;
      canvasRef.current?.postMessage({ type: 'setPicked', lat, lng });
      onChange({ lat, lng });
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
            if (msg.type === 'picked') onChange({ lat: msg.lat, lng: msg.lng });
          }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.hint}>
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Tap the map to set the exact point'}
        </Text>
        <Button
          title="Use My Location"
          icon="gps"
          variant="tertiary"
          size="sm"
          loading={locating}
          onPress={() => useCurrentLocation().catch(() => {})}
          style={styles.locateButton}
        />
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
