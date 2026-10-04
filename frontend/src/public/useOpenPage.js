import { useCallback, useContext } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { PAGE_BY_KEY } from './pages';

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

  return { openPage, openAuth, signedIn };
};

export default useOpenPage;
