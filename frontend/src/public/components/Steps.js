import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useSiteStyle from '../siteStyle';
import { useTone, useToneName } from './Blocks';

// Numbered steps. A laptop lays them side by side as cards joined by a line;
// narrower pages stack them as a timeline, number over a connecting rule.
export const StepList = ({ steps, columns }) => {
  const site = useSiteStyle();
  const tone = useTone();
  const dark = useToneName() === 'dark';
  const across = columns || (site.isDesktop ? Math.min(steps.length, 4) : site.isTablet && steps.length <= 4 ? 2 : 1);

  if (across === 1) {
    return (
      <View>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.timelineRow}>
            <View style={styles.rail}>
              <View style={[styles.number, dark && styles.numberDark]}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              {index < steps.length - 1 ? <View style={[styles.line, { backgroundColor: tone.cardBorder }]} /> : null}
            </View>
            <View style={styles.timelineBody}>
              <Text style={[styles.title, { color: tone.title }]}>{step.title}</Text>
              <Text style={[styles.body, { color: tone.body }]}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.grid, { marginHorizontal: -spacing.sm }]}>
      {steps.map((step, index) => (
        <View key={step.title} style={{ width: `${100 / across}%`, paddingHorizontal: spacing.sm, marginBottom: spacing.lg }}>
          <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.cardBorder }]}>
            <View style={styles.cardHead}>
              <View style={[styles.number, dark && styles.numberDark]}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              {step.icon ? <Icon name={step.icon} size={iconSize.lg} color={tone.accent} /> : null}
            </View>
            <Text style={[styles.title, { color: tone.title }]}>{step.title}</Text>
            <Text style={[styles.body, { color: tone.body }]}>{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

// A row of tabs over one panel, e.g. the steps for each kind of user.
export const SegmentTabs = ({ tabs, value, onChange, label }) => {
  const site = useSiteStyle();
  return (
    <View
      style={[styles.tabs, site.isPhone && styles.tabsFull]}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {tabs.map((tab) => (
        <Tab key={tab.key} tab={tab} active={tab.key === value} onPress={() => onChange(tab.key)} grow={site.isPhone} />
      ))}
    </View>
  );
};

const Tab = ({ tab, active, onPress, grow }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={[styles.tab, grow && styles.tabGrow, hovered && !active && styles.tabHovered, active && styles.tabActive]}
    >
      {tab.icon ? <Icon name={tab.icon} size={iconSize.md} color={active ? colors.textOnPrimary : colors.textSecondary} /> : null}
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
    </Pressable>
  );
};

const styles = themedStyles(() => ({
  timelineRow: { flexDirection: 'row', gap: spacing.lg },
  rail: { alignItems: 'center', width: 40 },
  line: { width: 2, flex: 1, marginVertical: spacing.xs, borderRadius: 1 },
  timelineBody: { flex: 1, paddingBottom: spacing.xxl, paddingTop: spacing.xs },
  number: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  numberDark: { backgroundColor: colors.primary },
  numberText: { fontSize: 17, fontWeight: '800', color: colors.textOnPrimary },
  title: { ...type.h3 },
  body: { ...type.body, marginTop: spacing.xs },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },

  tabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.xxl,
  },
  tabsFull: { alignSelf: 'stretch' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  tabGrow: { flex: 1, paddingHorizontal: spacing.xs, gap: spacing.xs },
  tabHovered: { backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...type.bodyMedium, fontSize: 16, color: colors.textSecondary, flexShrink: 1 },
  tabTextActive: { color: colors.textOnPrimary },
}));
