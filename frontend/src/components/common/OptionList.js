import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Card from './Card';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../../theme/tokens';

const Option = ({ option, selected, first, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={() => onSelect(option.value)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}
      style={({ pressed }) => [styles.row, !first && styles.divider, (hovered || pressed) && styles.active]}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{option.label}</Text>
        {!!option.description && <Text style={styles.description}>{option.description}</Text>}
      </View>
      <Icon name={selected ? 'radioOn' : 'radioOff'} size={iconSize.lg} color={selected ? colors.primaryText : colors.textMuted} />
    </Pressable>
  );
};

// A titled group of mutually exclusive choices, the settings pattern for
// language, calendar and theme: the current choice is filled in and tapping
// another applies it straight away.
const OptionList = ({ title, hint, options, value, onChange }) => (
  <View style={styles.section}>
    <Text style={styles.title} accessibilityRole="header">{title}</Text>
    {!!hint && <Text style={styles.hint}>{hint}</Text>}
    <Card style={styles.card}>
      {options.map((option, index) => (
        <Option key={option.value} option={option} first={index === 0} selected={option.value === value} onSelect={onChange} />
      ))}
    </Card>
  </View>
);

const styles = themedStyles(() => ({
  section: { marginBottom: spacing.xl },
  title: { ...type.h3, color: colors.textPrimary, paddingHorizontal: spacing.xs },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs, paddingHorizontal: spacing.xs },
  card: { padding: 0, marginVertical: spacing.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  active: { backgroundColor: colors.surfaceMuted },
  text: { flex: 1, minWidth: 0 },
  label: { ...type.bodyMedium, color: colors.textPrimary },
  description: { ...type.small, color: colors.textMuted, marginTop: 1 },
}));

export default OptionList;
