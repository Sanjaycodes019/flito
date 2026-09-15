import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../theme/tokens';

// Lays its children out in equal-width columns that wrap onto new rows.
// Cells in one row stretch to the tallest, so a child that fills its cell
// (flex: 1) lines up top and bottom with its neighbours.
const Grid = ({ columns = 1, gap = spacing.lg, children, style }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;

  return (
    <View style={[styles.grid, { marginHorizontal: -gap / 2, marginBottom: -gap }, style]}>
      {items.map((child) => (
        <View key={child.key} style={{ width: `${100 / columns}%`, paddingHorizontal: gap / 2, marginBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});

export default Grid;
