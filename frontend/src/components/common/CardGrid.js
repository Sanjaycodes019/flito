import React from 'react';
import { View } from 'react-native';
import { spacing, themedStyles } from '../../theme/tokens';
import useScreenLayout, { CONTENT_WIDTH } from '../../hooks/useScreenLayout';
import { SIDEBAR_WIDTH } from '../navigation/Sidebar';

// How many record cards fit side by side, from the room the list really has:
// the window, less the sidebar on a laptop and the page gutters. A card needs
// about 300px to keep its facts on one line and its footer buttons two to a
// row, so a column is only added once each card gets that.
export const columnsForWidth = (width) => (width >= 1000 ? 3 : width >= 660 ? 2 : 1);

export const useCardColumns = (maxWidth = CONTENT_WIDTH.wide) => {
  const layout = useScreenLayout('wide');
  const width = Math.min(layout.width - (layout.isDesktop ? SIDEBAR_WIDTH : 0) - layout.gutter * 2, maxWidth);
  return columnsForWidth(width);
};

// The same grid for a FlatList: pass these to it, and wrap each item in
// <CardCell columns={columns}>. A mounted FlatList can't change its column
// count, so give it key={`columns-${columns}`} too, to remount it when the
// count changes.
export const cardGridProps = (columns) => ({
  numColumns: columns,
  columnWrapperStyle: columns > 1 ? styles.row : undefined,
});

// One card's slot: an equal share of the row, half the gutter on each side,
// and the card stretched to the row's height so footers line up.
export const CardCell = ({ columns, children }) => (
  <View style={[styles.cell, columns > 1 && styles.cellInGrid, columns > 1 && { width: `${100 / columns}%` }]}>
    {children}
  </View>
);

// A grid of cards outside a FlatList (a ScrollView page).
const CardGrid = ({ columns, children }) => (
  <View style={[styles.grid, columns > 1 && styles.row]}>
    {React.Children.toArray(children).filter(Boolean).map((child) => (
      <CardCell key={child.key} columns={columns}>{child}</CardCell>
    ))}
  </View>
);

const styles = themedStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { marginHorizontal: -spacing.sm },
  cell: { width: '100%', paddingBottom: spacing.lg, minWidth: 0 },
  cellInGrid: { paddingHorizontal: spacing.sm },
}));

export default CardGrid;
