import { useCallback, useContext } from 'react';
import { Platform } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { PAGE_BY_KEY, AUTH_PATHS } from './pages';

// On the web a link is a real <a href>, so search engines can follow it and
// it opens in a new tab like any other; a plain click still moves within the
// app. Spread the result onto a Pressable or Text. Elsewhere it is just onPress.
export const linkTo = (href, go) => {
  if (Platform.OS !== 'web' || !href) return { onPress: go };
  return {
    href,
    onPress: (event) => {
      // Ctrl, Cmd or Shift with a click is the browser's: a new tab or window.
      if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey) return;
      event?.preventDefault?.();
      go();
    },
  };
};

// The address of an information page, or of a way in ("/signup?role=owner").
export const pageHref = (key) => (PAGE_BY_KEY[key] ? `/${PAGE_BY_KEY[key].path}` : null);
export const authHref = (route, params) => {
  if (AUTH_PATHS[route] === undefined) return null;
  const query = Object.entries(params || {}).map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('&');
  return `/${AUTH_PATHS[route]}${query ? `?${query}` : ''}`;
};

// Opens an information page from anywhere. Signed out the pages sit in the
// Auth stack; signed in they live in the Profile stack, opened on top of it
// (`initial: false`) so the back arrow leads to the profile, not nowhere.
//
// Read from NavigationContext rather than useNavigation so a component using
// this (the auth pages' link row) still renders outside a navigator, as it
// does in the screen tests; the links then do nothing.
const useOpenPage = () => {
  const navigation = useContext(NavigationContext);
  const signedIn = Boolean(useSelector((state) => state.auth.token));

  const openPage = useCallback((key) => {
    const page = PAGE_BY_KEY[key];
    if (!navigation || !page) return;
    if (signedIn) navigation.navigate('Profile', { screen: page.route, initial: false });
    else navigation.navigate(page.route);
  }, [navigation, signedIn]);

  // Log in, Sign Up and the landing page exist only while signed out.
  const openAuth = useCallback((route, params) => {
    if (!navigation || signedIn) return;
    navigation.navigate(route, params);
  }, [navigation, signedIn]);

  // The same, as link props (see linkTo).
  const pageLink = useCallback((key) => linkTo(pageHref(key), () => openPage(key)), [openPage]);
  const authLink = useCallback(
    (route, params) => linkTo(signedIn ? null : authHref(route, params), () => openAuth(route, params)),
    [openAuth, signedIn],
  );

  return { openPage, openAuth, pageLink, authLink, signedIn };
};

export default useOpenPage;
