import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the component tree (the push notification tap handler in
// App.js) navigate without needing a `navigation` prop. It isn't rendered
// inside any screen.
export const navigationRef = createNavigationContainerRef();

// Nested tab/stack navigation (see HomeStackNavigator/ProfileStackNavigator)
// needs the { screen, params } shape, not a flat route name.
export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
};
