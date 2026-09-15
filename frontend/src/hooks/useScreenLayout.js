import useBreakpoint from './useBreakpoint';
import { spacing } from '../theme/tokens';

// Widths of the centered content column, by what the page holds.
export const CONTENT_WIDTH = {
  narrow: 720, // forms and single records
  medium: 960, // pages that go side by side on wide screens
  wide: 1200, // dashboards and card grids
};

const resolveWidth = (width) => (typeof width === 'number' ? width : CONTENT_WIDTH[width] || CONTENT_WIDTH.medium);

// Page gutters and a centered, capped content column that grow with the
// screen, so a page reads as a phone layout on phones and as a laid-out web
// page on a laptop instead of stretching edge to edge.
//
// `width` applies below desktop and `desktopWidth` from desktop up, so a
// detail page can stay a readable single column on a tablet and widen into
// two columns on a laptop. Pass `contentStyle` as a ScrollView or FlatList
// contentContainerStyle.
const useScreenLayout = (width = 'medium', desktopWidth = width) => {
  const breakpoint = useBreakpoint();
  const gutter = breakpoint.isDesktop ? spacing.xxxl : breakpoint.isTablet ? spacing.xxl : spacing.lg;
  const maxWidth = resolveWidth(breakpoint.isDesktop ? desktopWidth : width);

  return {
    ...breakpoint,
    gutter,
    contentStyle: {
      paddingHorizontal: gutter,
      paddingVertical: breakpoint.isPhone ? spacing.lg : spacing.xxl,
      width: '100%',
      maxWidth: maxWidth + gutter * 2,
      alignSelf: 'center',
    },
  };
};

export default useScreenLayout;
