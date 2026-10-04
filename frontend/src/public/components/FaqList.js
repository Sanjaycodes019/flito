import React from 'react';
import { View, Text } from 'react-native';
import Disclosure from '../../components/common/Disclosure';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';

// Questions that open to show their answer. An answer may be one paragraph or
// several (an array).
const FaqList = ({ items, defaultOpenFirst = false }) => (
  <View style={styles.list}>
    {items.map((item, index) => (
      <Disclosure key={item.q} title={item.q} defaultOpen={defaultOpenFirst && index === 0} style={styles.item}>
        {[].concat(item.a).map((paragraph) => (
          <Text key={paragraph} style={styles.answer}>{paragraph}</Text>
        ))}
      </Disclosure>
    ))}
  </View>
);

const styles = themedStyles(() => ({
  list: { gap: spacing.md },
  item: { borderRadius: 14 },
  answer: { ...type.body, color: colors.textSecondary, marginBottom: spacing.md },
}));

export default FaqList;
