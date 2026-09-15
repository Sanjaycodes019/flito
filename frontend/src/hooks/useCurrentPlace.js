import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { detectLocation } from '../services/locations';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

// Where the device is in Nepal's federal structure: asks for location access,
// reads the most precise fix available and looks it up on the server.
// `detect()` resolves to { place, coordinates, accuracy, areaName,
// protectedArea }, or to null after telling the user why it couldn't.
const useCurrentPlace = () => {
  const [detecting, setDetecting] = useState(false);

  const detect = useCallback(async () => {
    setDetecting(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error('Allow location access for this app, or choose the address from the lists.');

      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Highest });
      const result = await detectLocation({ lat: coords.latitude, lng: coords.longitude });

      if (!result.inNepal) {
        notify('Outside Nepal', 'Your current location is outside Nepal. Choose the address from the lists instead.');
        return null;
      }
      return {
        place: { provinceId: result.provinceId, districtId: result.districtId, localLevelId: result.localLevelId },
        coordinates: { lat: coords.latitude, lng: coords.longitude },
        accuracy: coords.accuracy,
        areaName: result.areaName || null,
        protectedArea: result.protectedArea || null,
      };
    } catch (error) {
      notify('Could not use your location', getErrorMessage(error));
      return null;
    } finally {
      setDetecting(false);
    }
  }, []);

  return { detect, detecting };
};

export default useCurrentPlace;
