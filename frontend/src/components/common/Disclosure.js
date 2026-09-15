import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

// A row that opens to show more, so the optional parts of a form stay out of
// the way until someone wants them. Pass `open` and `onToggle` to control it,
// or leave both off and it manages itself from `defaultOpen`. `bordered`
// draws its own box; turn it off inside a card that already frames it.
const Disclosure = ({
  title,
  hint,
  icon,
  badge,
  open,
  onToggle,
  defaultOpen = false,
  bordered = true,
  accessibilityLabel,
  children,
  style,
}) => {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);
  const isOpen = open ?? ownOpen;

  const toggle = () => (onToggle ? onToggle(!isOpen) : setOwnOpen(!isOpen));

  return (
    <View style={[bordered && styles.box, style]}>
      <Pressable
        onPress={toggle}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={accessibilityLabel || title}
        style={[styles.header, bordered && styles.headerBordered, bordered && hovered && styles.headerHovered]}
      >
        {icon ? (
          <View style={bordered ? styles.iconPlain : styles.iconTinted}>
            <Icon name={icon} size={iconSize.md} color={bordered ? colors.textMuted : colors.primaryText} />
          </View>
        ) : null}
        <View style={styles.text}>
          <Text style={bordered ? styles.title : styles.titleLarge}>{title}</Text>
          {hint ? <Text style={styles.hint} numberOfLines={2}>{hint}</Text> : null}
        </View>
        {badge}
        <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={iconSize.md} color={colors.textMuted} />
      </Pressable>

      {isOpen && <View style={[styles.body, bordered && styles.bodyBordered]}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  headerBordered: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  headerHovered: { backgroundColor: colors.surfaceMuted },
  iconPlain: { width: 24, alignItems: 'center' },
  iconTinted: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.bodyMedium, color: colors.textPrimary },
  titleLarge: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  body: { paddingTop: spacing.lg },
  bodyBordered: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});

export default Disclosure;
