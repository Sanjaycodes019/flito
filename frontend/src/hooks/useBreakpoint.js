import { useWindowDimensions } from 'react-native';
import { breakpoints } from '../theme/tokens';

// The one place screens ask "how much room is there". Re-renders on window
// resize and device rotation, since useWindowDimensions does.
const useBreakpoint = () => {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isPhone: width < breakpoints.tablet,
    isTablet: width >= breakpoints.tablet && width < breakpoints.desktop,
    isDesktop: width >= breakpoints.desktop,
  };
};

export default useBreakpoint;
