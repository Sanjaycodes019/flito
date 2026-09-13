import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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

// Picks one image or PDF — for documents such as a citizenship card scan.
export const pickDocument = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets[0];
};

const mimeTypeOf = (asset) => {
  if (asset.mimeType) return asset.mimeType;
  if (/\.pdf($|\?)/i.test(asset.uri) || /\.pdf$/i.test(asset.name || '')) return 'application/pdf';
  if (/\.png($|\?)/i.test(asset.uri)) return 'image/png';
  return 'image/jpeg';
};

// React Native and the browser build multipart bodies differently: native
// accepts a { uri, name, type } descriptor, the web needs the actual Blob.
const appendAsset = async (form, field, asset, index) => {
  const type = mimeTypeOf(asset);
  const extension = type === 'application/pdf' ? 'pdf' : (type.split('/')[1] || 'jpg');
  const name = asset.fileName || asset.name || `file-${Date.now()}-${index}.${extension}`;

  if (isWeb) {
    const blob = asset.file || await (await fetch(asset.uri)).blob();
    form.append(field, blob, name);
  } else {
    form.append(field, { uri: asset.uri, name, type });
  }
};

// Sends `assets` as multipart `field`, plus any plain `fields` (for example a
// document type). Plain fields go first so the server sees them before files.
export const uploadFiles = async (path, assets, { field = 'photos', fields = {} } = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));

  // Sequential so files keep the order they were picked in.
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

export const uploadPhotos = (path, assets, field = 'photos') => uploadFiles(path, assets, { field });
