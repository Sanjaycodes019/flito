import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useBreakpoint from '../../hooks/useBreakpoint';
import { webInputReset } from '../../components/common/Input';

const Chip = ({ label, count, selected, onPress, roomy }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={[styles.chip, roomy && styles.chipRoomy, selected && styles.chipSelected]}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    {count != null ? (
      <View style={[styles.count, selected && styles.countSelected]}>
        <Text style={[styles.countText, selected && styles.countTextSelected]}>{count}</Text>
      </View>
    ) : null}
  </Pressable>
);

const SearchField = ({ value, onChange, placeholder, roomy }) => (
  <View style={[styles.search, roomy && styles.searchRoomy]}>
    <Icon name="search" size={iconSize.md} color={colors.textMuted} />
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel={placeholder}
      style={[styles.searchInput, webInputReset]}
    />
    {value ? (
      <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
        <Icon name="close" size={iconSize.sm} color={colors.textMuted} />
      </Pressable>
    ) : null}
  </View>
);

// The toolbar above every admin list: search, then one row per filter group.
// A group is { key, icon, labelKey, options: [{ value, labelKey }], allowAll,
// countKey }. With `countKey` (e.g. 'users.role') each chip shows how many
// records it holds, from the stats breakdown. "Clear" appears once anything
// narrows the list.
//
// On a phone, a page with several groups keeps the toolbar to one line: the
// search box plus a Filters button (with a count of what is applied) that opens
// the groups. A page with one group shows its chips in a single scrolling row.
const FilterBar = ({ search, onSearch, searchPlaceholder, groups = [], filters, onFilter, counts, dirty, onClear }) => {
  const { t } = useTranslation();
  const { isPhone } = useBreakpoint();
  const [open, setOpen] = useState(false);

  const collapsible = isPhone && groups.length > 1;
  const applied = groups.filter((group) => filters[group.key]).length;

  const countFor = (group, value) => {
    if (!group.countKey || !counts) return null;
    const table = group.countKey.split('.').reduce((node, part) => node?.[part], counts);
    if (!table) return null;
    return value === '' ? Object.values(table).reduce((sum, n) => sum + n, 0) : table[value] || 0;
  };

  const chips = (group) => (
    <>
      {group.allowAll !== false ? (
        <Chip roomy={isPhone} label={t('admin:filters.all')} count={countFor(group, '')} selected={!filters[group.key]} onPress={() => onFilter(group.key, '')} />
      ) : null}
      {group.options.map((option) => (
        <Chip
          key={option.value}
          roomy={isPhone}
          label={t(option.labelKey)}
          count={countFor(group, option.value)}
          selected={filters[group.key] === option.value}
          onPress={() => onFilter(group.key, option.value)}
        />
      ))}
    </>
  );

  const groupRow = (group) => (
    <View key={group.key} style={[styles.group, isPhone && styles.groupStacked]}>
      <View style={styles.groupLabelRow}>
        {group.icon ? <Icon name={group.icon} size={iconSize.xs} color={colors.textMuted} /> : null}
        <Text style={styles.groupLabel}>{t(group.labelKey)}</Text>
      </View>
      {isPhone ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>{chips(group)}</ScrollView>
      ) : (
        <View style={styles.chips}>{chips(group)}</View>
      )}
    </View>
  );

  return (
    <View style={styles.bar}>
      <View style={styles.topRow}>
        {onSearch ? (
          <View style={styles.searchWrap}>
            <SearchField value={search} onChange={onSearch} placeholder={searchPlaceholder} roomy={isPhone} />
          </View>
        ) : null}
        {collapsible ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={t('admin:filters.title')}
            style={[styles.filterButton, (open || applied > 0) && styles.filterButtonOn]}
          >
            <Icon name="filter" size={iconSize.md} color={open || applied > 0 ? colors.primaryText : colors.textSecondary} />
            {applied > 0 ? (
              <View style={styles.filterCount}><Text style={styles.filterCountText}>{applied}</Text></View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {!collapsible || open ? groups.map(groupRow) : null}

      {dirty ? (
        <Pressable onPress={onClear} accessibilityRole="button" style={styles.clear}>
          <Icon name="close" size={iconSize.xs} color={colors.textLink} />
          <Text style={styles.clearText}>{t('admin:filters.clear')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = themedStyles(() => ({
  bar: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchWrap: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchRoomy: { height: 48 },
  searchInput: { flex: 1, height: '100%', ...type.body, color: colors.textPrimary },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  filterButtonOn: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryText },
  filterCount: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primaryText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { fontSize: 11, fontWeight: '700', color: colors.textOnDark },
  group: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupStacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs },
  groupLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, width: 88 },
  groupLabel: { ...type.smallMedium, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, flex: 1 },
  chipScroll: { flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs + 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipRoomy: { minHeight: 40 },
  chipSelected: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryText },
  chipText: { ...type.small, color: colors.textSecondary },
  chipTextSelected: { color: colors.primaryText, fontWeight: '600' },
  count: { minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  countSelected: { backgroundColor: colors.primaryText },
  countText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  countTextSelected: { color: colors.textOnDark },
  clear: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingVertical: spacing.xs },
  clearText: { ...type.smallMedium, color: colors.textLink },
}));

export default FilterBar;
