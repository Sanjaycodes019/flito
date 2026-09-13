import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from './api';

const isWeb = Platform.OS === 'web';

// Uploads can be several megabytes on a slow mobile connection, well past the
// default request timeout.
const UPLOAD_TIMEOUT_MS = 60000;

// Picks up to `max` images. With `camera`, takes one photo on devices that
// have a camera app; the web falls back to choosing a file.
export const pickImages = async ({ max = 1, camera = false } = {}) => {
  if (max < 1) return [];
  const useCamera = camera && !isWeb;

  if (!isWeb) {
    const { granted } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      throw new Error(useCamera
        ? 'Allow camera access to take a photo'
        : 'Allow photo library access to add photos');
    }
  }

  const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 };
  const result = useCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync({
      ...options,
      allowsMultipleSelection: max > 1,
      selectionLimit: max,
    });

  if (result.canceled) return [];
  return result.assets.slice(0, max);
};

const mimeTypeOf = (asset) => asset.mimeType || (/\.png($|\?)/i.test(asset.uri) ? 'image/png' : 'image/jpeg');

// React Native and the browser build multipart bodies differently: native
// accepts a { uri, name, type } descriptor, the web needs the actual Blob.
const appendAsset = async (form, field, asset, index) => {
  const type = mimeTypeOf(asset);
  const name = asset.fileName || `photo-${Date.now()}-${index}.${type.split('/')[1] || 'jpg'}`;

  if (isWeb) {
    const blob = await (await fetch(asset.uri)).blob();
    form.append(field, blob, name);
  } else {
    form.append(field, { uri: asset.uri, name, type });
  }
};

export const uploadPhotos = async (path, assets, field = 'photos') => {
  const form = new FormData();
  // Sequential so photos keep the order they were picked in.
  for (let i = 0; i < assets.length; i += 1) {
    await appendAsset(form, field, assets[i], i);
  }

  const { data } = await api.post(path, form, {
    timeout: UPLOAD_TIMEOUT_MS,
    // The browser must set the multipart boundary itself.
    headers: isWeb ? undefined : { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
