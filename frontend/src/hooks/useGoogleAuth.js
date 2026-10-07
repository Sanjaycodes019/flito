// The Android version: Google's own account picker via Google Play
// services. The web version (useGoogleAuth.web.js) uses an OAuth popup,
// which can't work here: Google won't redirect a Web OAuth client back to
// the app's flito:// scheme.
//
// Passing the Web client id as webClientId makes Google issue the ID token
// for that client, the same audience the backend already checks, so the
// server needs no Android-specific setup. Google only does this for an app
// it recognises, though: the Google Cloud project also needs an Android
// OAuth client for com.flito.app with the signing key's SHA-1. Without it
// every sign-in fails with DEVELOPER_ERROR. See README.
import { GOOGLE_CLIENT_ID as CLIENT_ID } from '../utils/constants';

// Google's codes for "the user closed the picker" and "this app isn't
// registered in Google Cloud" (DEVELOPER_ERROR).
const SIGN_IN_CANCELLED = '12501';
const DEVELOPER_ERROR = '10';

export const isGoogleConfigured = () => Boolean(CLIENT_ID);

// Required on first use rather than imported: Expo Go doesn't include this
// native module, and importing it there would crash the login screen
// instead of just disabling the Google button.
let googleSignin = null;
const loadGoogleSignin = () => {
  if (!googleSignin) {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: CLIENT_ID });
    googleSignin = GoogleSignin;
  }
  return googleSignin;
};

// Same contract as the web version: `onResult(idToken)` on success, or
// `onResult(null, message)` on failure, `onResult(null)` on cancel, and
// `onResult(null, 'not_configured')` when Google can't be used at all.
export const useGoogleAuth = (onResult) => {
  const promptGoogleSignIn = async () => {
    if (!isGoogleConfigured()) {
      onResult(null, 'not_configured');
      return;
    }

    let GoogleSignin;
    try {
      GoogleSignin = loadGoogleSignin();
    } catch (err) {
      console.log('[google-auth] native module unavailable:', err?.message);
      onResult(null, 'not_configured');
      return;
    }

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Forget the last account first, so the picker always opens and
      // someone with two Google accounts can choose instead of being
      // signed in silently with whichever they used before.
      await GoogleSignin.signOut().catch(() => {});
      const { idToken } = await GoogleSignin.signIn();
      if (idToken) {
        onResult(idToken);
      } else {
        onResult(null, 'Google did not return a sign-in token. Please try again.');
      }
    } catch (err) {
      if (err?.code === SIGN_IN_CANCELLED) {
        onResult(null);
      } else if (err?.code === DEVELOPER_ERROR) {
        console.log('[google-auth] DEVELOPER_ERROR: no Android OAuth client for this package and SHA-1');
        onResult(null, 'not_configured');
      } else {
        console.log('[google-auth] failed:', err?.code, err?.message);
        onResult(null, err?.message || 'Could not open Google sign-in. Please try again.');
      }
    }
  };

  return { promptGoogleSignIn, ready: true };
};
