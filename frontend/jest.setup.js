// Global mocks for native modules no test in this project should ever touch
// for real. Every test that renders a screen imports these transitively
// (through services/uploads.js, services/socket.js, or the map/signature
// components), so they're mocked once here instead of per test file.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));

// Fixes the app's language to English for tests regardless of the host
// machine's locale, matching every test's English text assertions. See
// jest.setupAfterEnv.js for where i18next itself is initialized.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'flito://redirect'),
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  ResponseType: { IdToken: 'id_token' },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-nonce' }));

// react-native-svg has no meaningful behavior to exercise under Jest (it's
// only used for the static Google "G" mark); a stub avoids loading its
// native view registration.
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Svg: View, Path: View };
});

// @expo/vector-icons pulls in expo-font/expo-asset, which reach for native
// module globals that don't exist under plain Jest (no real Expo runtime).
// Screens only need an icon to render as *something* identifiable; a plain
// stub avoids loading that machinery at all.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const IconStub = ({ name, ...props }) =>
    require('react').createElement(Text, { ...props, testID: `icon-${name}` }, null);
  return new Proxy({}, { get: () => IconStub });
});

// react-native-webview is only used inside MapCanvas.native.js; jest-expo
// resolves to the .native variant by default, same as it would on Android.
jest.mock('react-native-webview', () => {
  const { forwardRef } = require('react');
  const { View } = require('react-native');
  return { WebView: forwardRef((props, ref) => require('react').createElement(View, { ref, testID: 'webview' })) };
});

// No test in this project asserts on real-time socket delivery (that's
// covered by the backend's push/socket tests and the manual browser
// verification). Screens just need `socketService.on/off` to be safe no-ops.
jest.mock('./src/services/socket', () => ({
  __esModule: true,
  default: { connect: jest.fn(), on: jest.fn(), off: jest.fn(), emit: jest.fn(), disconnect: jest.fn() },
}));

// useFocusEffect calls useNavigation() internally, which throws outside a
// real NavigationContainer. Tests render one screen in isolation, not a
// full navigator. Approximating "runs the effect on mount" is enough for
// what these tests check (initial load behavior, not re-focus behavior).
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback) => require('react').useEffect(callback, []), // eslint-disable-line react-hooks/exhaustive-deps
  // Components that call useNavigation() directly (e.g. VerificationPrompt)
  // need this even in tests that don't care where it goes.
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// Alert/confirm dialogs would otherwise hang a test waiting for a tap that
// never comes; run the confirming action immediately instead.
jest.mock('./src/utils/alert', () => ({
  // Real notify() calls onDismiss once the user dismisses the alert
  // (synchronously on web); approximated here as "call it immediately" so
  // screens that navigate after a success alert can be tested.
  notify: jest.fn((title, message, onDismiss) => onDismiss?.()),
  confirmAction: jest.fn(({ onConfirm }) => onConfirm?.()),
}));
