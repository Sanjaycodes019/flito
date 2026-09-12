import { Alert, Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// react-native-web does not implement Alert: the dialog never appears and any
// onPress callback attached to a button never fires. That silently swallowed
// error messages and broke every confirm-then-act flow (logout, cancel,
// navigate-after-success) on the web build, so route through the browser's
// own dialogs there and the native Alert on Android/iOS.

export const notify = (title, message, onDismiss) => {
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
  if (isWeb) {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};
