import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapCanvas from './MapCanvas';
import { buildMapHtml } from './mapHtml';
import { FLITO_COLORS } from '../../utils/colors';

// Read-only map: static pickup/dropoff pins plus a driver marker that moves
// live as `driverLocation` changes, without reloading the page (so the user's
// pan/zoom isn't reset on every GPS ping).
const TrackingMap = ({ pickup, dropoff, driverLocation, height = 260 }) => {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const sentDriverLocation = useRef(null);

  // The page is only rebuilt when the static pickup/dropoff points change —
  // never for driver movement, which goes through postMessage instead.
  const html = useMemo(() => buildMapHtml({ pickup, dropoff }), [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

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
        <Text style={styles.emptyText}>No location data for this load</Text>
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
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => canvasRef.current?.postMessage({ type: 'fitAll' })}
          accessibilityLabel="Fit map to all markers"
        >
          <Text style={styles.recenterText}>Fit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#EEE', marginVertical: 8 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: FLITO_COLORS.textMuted, fontSize: 13 },
  recenterButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: FLITO_COLORS.bgLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  recenterText: { fontSize: 12, fontWeight: '700', color: FLITO_COLORS.secondary },
});

export default TrackingMap;
