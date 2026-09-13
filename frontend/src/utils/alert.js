import { Alert, Platform } from 'react-native';
import { _getAlertBridge } from '../components/common/AlertHost';

const isWeb = Platform.OS === 'web';

// Every alert and confirmation routes through the branded <AlertHost/> modal
// mounted once at the app root, so dialogs look like FLITO everywhere
// instead of the OS-native alert box (Android/iOS) or window.confirm (web),
// which broke the "one consistent design language" rule. The OS-native
// fallback below only matters for the brief window before AlertHost mounts.

export const notify = (title, message, onDismiss) => {
  const bridge = _getAlertBridge();
  if (bridge) {
    bridge.notify(title, message, onDismiss);
    return;
  }
  if (isWeb) {
    window.alert(message ? `${title}\n\n${message}` : title);
    onDismiss?.();
    return;
  }
  Alert.alert(title, message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
};

export const confirmAction = ({
  title,
  message,
  confirmLabel = 'OK',
  destructive = false,
  onConfirm,
}) => {
  const bridge = _getAlertBridge();
  if (bridge) {
    bridge.confirm({ title, message, confirmLabel, destructive, onConfirm });
    return;
  }
  if (isWeb) {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};
