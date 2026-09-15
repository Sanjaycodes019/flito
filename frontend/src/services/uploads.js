import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from './api';
import { _getCameraBridge } from '../components/common/CameraCaptureHost';

const isWeb = Platform.OS === 'web';

// Uploads can be several megabytes on a slow mobile connection, well past the
// default request timeout.
const UPLOAD_TIMEOUT_MS = 60000;

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

// ── Web file input ─────────────────────────────────────────────────────────

// expo's web pickers only listen for a file being chosen, so closing the
// dialog without choosing one left their promise pending forever and the
// button that opened it spinning. This opens the browser's own file input and
// settles on cancel as well.
const openWebFileInput = ({ accept, multiple = false, capture }) => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  if (capture) input.setAttribute('capture', capture);
  input.style.display = 'none';
  document.body.appendChild(input);

  let settled = false;
  let onWindowFocus;
  const settle = (files) => {
    if (settled) return;
    settled = true;
    window.removeEventListener('focus', onWindowFocus);
    input.remove();
    resolve(files);
  };

  // Browsers without the input "cancel" event: the page regains focus when the
  // dialog closes, and a chosen file's "change" arrives just after that.
  onWindowFocus = () => setTimeout(() => settle([]), 1000);

  input.addEventListener('change', () => settle(Array.from(input.files || [])));
  input.addEventListener('cancel', () => settle([]));
  window.addEventListener('focus', onWindowFocus, { once: true });
  // Called synchronously from the tap that asked for it, as browsers require.
  input.click();
});

const webAsset = (file) => ({
  uri: URL.createObjectURL(file),
  file,
  fileName: file.name,
  name: file.name,
  mimeType: file.type || undefined,
  fileSize: file.size,
  size: file.size,
});

// A phone or tablet browser, whose file input can open the camera directly.
const isTouchBrowser = () => (
  isWeb && typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
);

// ── Pickers ────────────────────────────────────────────────────────────────

// Picks up to `max` existing images from the photo library (a file chooser on
// the web). With `square`, a single photo (a profile photo) opens the phone's
// square crop step first.
export const pickImages = async ({ max = 1, square = false } = {}) => {
  if (max < 1) return [];

  if (isWeb) {
    const files = await openWebFileInput({ accept: IMAGE_TYPES, multiple: max > 1 });
    return files.slice(0, max).map(webAsset);
  }

  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) throw new Error('Allow photo library access to add photos');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    ...(square && max === 1 ? { allowsEditing: true, aspect: [1, 1] } : {}),
  });
  if (result.canceled) return [];
  return result.assets.slice(0, max);
};

// Takes one photo now. The app opens the phone's camera; a phone browser's file
// input opens its camera directly; a laptop browser, where that hint does
// nothing, opens FLITO's webcam window (CameraCaptureHost). `facing` is
// 'environment' (the back camera, for cargo and documents) or 'user' (the
// front camera, for a profile photo).
export const takePhoto = async ({ square = false, facing = 'environment' } = {}) => {
  if (!isWeb) {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Allow camera access to take a photo');

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      cameraType: facing === 'user' ? ImagePicker.CameraType?.front : ImagePicker.CameraType?.back,
      ...(square ? { allowsEditing: true, aspect: [1, 1] } : {}),
    });
    return result.canceled ? [] : result.assets.slice(0, 1);
  }

  if (isTouchBrowser()) {
    const files = await openWebFileInput({ accept: 'image/*', capture: facing });
    return files.slice(0, 1).map(webAsset);
  }

  const bridge = _getCameraBridge();
  if (!bridge) throw new Error('The camera is not available right now. Choose a photo instead.');
  const asset = await bridge.open({ square, facing });
  return asset ? [asset] : [];
};

// Picks one image or PDF, for documents such as a citizenship card scan.
export const pickDocument = async () => {
  if (isWeb) {
    const [file] = await openWebFileInput({ accept: `${IMAGE_TYPES},application/pdf` });
    return file ? webAsset(file) : null;
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets[0];
};

// ── Uploading ──────────────────────────────────────────────────────────────

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

// Turns a canvas `data:` URI (e.g. a drawn signature) into an asset
// `uploadFiles` can send. On web, `fetch()` reads a data: URI directly. No
// special handling needed. On native, React Native's multipart FormData only
// accepts a real `file://`/`content://` uri, not `data:`, so the bytes are
// written to a temp file first and that file's uri is used instead.
export const assetFromDataUrl = async (dataUrl, { fileName = 'signature.png', mimeType = 'image/png' } = {}) => {
  if (isWeb) return { uri: dataUrl, mimeType, fileName };

  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const fileUri = `${FileSystem.cacheDirectory}${Date.now()}-${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri: fileUri, mimeType, fileName };
};
