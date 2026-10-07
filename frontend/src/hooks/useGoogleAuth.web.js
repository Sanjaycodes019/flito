import { useEffect, useMemo } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Required once per app so the browser tab/sheet opened for the OAuth
// screen actually resolves back to `response` instead of hanging.
WebBrowser.maybeCompleteAuthSession();

// A Web application OAuth client works for both native (via this redirect)
// and web. See README for the exact Google Cloud Console setup steps.
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};

export const isGoogleConfigured = () => Boolean(CLIENT_ID);

// `onResult(idToken)` is called with a Google ID token on success, or with
// `null` (and a message logged) on failure or cancellation. Screens pass
// this straight to authService.googleAuth().
export const useGoogleAuth = (onResult) => {
  const redirectUri = useMemo(() => AuthSession.makeRedirectUri({ scheme: 'flito' }), []);
  const nonce = useMemo(() => Crypto.randomUUID(), []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID || 'not-configured',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      // expo-auth-session adds a PKCE code_challenge by default. PKCE belongs
      // to the authorization-code flow; on an ID-token request Google rejects
      // it outright ("Error 400: invalid_request"). The nonce below is this
      // flow's replay protection instead.
      usePKCE: false,
      extraParams: { nonce },
    },
    GOOGLE_DISCOVERY
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success' && response.params?.id_token) {
      onResult(response.params.id_token);
    } else if (response.type === 'error') {
      console.log('[google-auth] failed:', response.error?.message);
      onResult(null, response.error?.message);
    }
    // A user-dismissed prompt (response.type === 'dismiss'/'cancel') is not
    // an error worth surfacing, it is just "changed their mind".
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  const promptGoogleSignIn = async () => {
    if (!isGoogleConfigured()) {
      onResult(null, 'not_configured');
      return;
    }
    try {
      const result = await promptAsync();
      // success and error arrive through the effect above. Anything else
      // (the user closed the popup, or it never opened) must still call
      // back, or the screen's button would spin forever.
      if (result?.type !== 'success' && result?.type !== 'error') onResult(null);
    } catch (err) {
      // e.g. the browser blocked the popup outright.
      onResult(null, err?.message || 'Could not open Google sign-in. Allow popups for this site and try again.');
    }
  };

  return { promptGoogleSignIn, ready: Boolean(request) };
};
