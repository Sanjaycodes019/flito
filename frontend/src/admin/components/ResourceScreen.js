import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useScreenLayout from '../../hooks/useScreenLayout';
import useAdminList from '../useAdminList';
import useAdminStats, { refreshAdminStats } from '../useAdminStats';
import FilterBar from './FilterBar';
import Pagination from './Pagination';

// Cards per row, from the room the list actually has (the window minus the
// sidebar on a laptop): one on a phone, two once there is room for two cards
// side by side, three on a wide screen.
const SIDEBAR_WIDTH = 248;
const columnsFor = (contentWidth) => (contentWidth >= 1180 ? 3 : contentWidth >= 640 ? 2 : 1);

// The page every admin list section is built from. A section supplies what is
// specific to it (endpoint, filters, how one record looks); this supplies the
// rest: header, toolbar, loading and empty states, the responsive grid,
// pull-to-refresh and numbered pagination.
//
//   <ResourceScreen
//     page="users"                       // admin:pages.users.{title,subtitle,search,emptyTitle,emptyMessage}
//     endpoint="/admin/users" itemsKey="users"
//     filterGroups={[...]} emptyIcon="people"
//     renderItem={(user, list) => <UserCard user={user} list={list} />}
//   />
const ResourceScreen = ({
  page,
  endpoint,
  itemsKey,
  filterGroups,
  initialFilters,
  searchable = true,
  emptyIcon = 'empty',
  renderItem,
}) => {
  const { t } = useTranslation();
  const layout = useScreenLayout('wide');
  const list = useAdminList(endpoint, itemsKey, { initialFilters });
  const stats = useAdminStats({ passive: true });
  const [refreshing, setRefreshing] = useState(false);

  const contentWidth = layout.width - (layout.isDesktop ? SIDEBAR_WIDTH : 0) - layout.gutter * 2;
  const columns = columnsFor(Math.min(contentWidth, 1200));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([list.refresh(), refreshAdminStats()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.iconTile}>
          <Icon name={emptyIcon} size={iconSize.lg} color={colors.primaryText} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, layout.isPhone && styles.titlePhone]} accessibilityRole="header">{t(`admin:pages.${page}.title`)}</Text>
          <Text style={styles.subtitle}>{t(`admin:pages.${page}.subtitle`)}</Text>
        </View>
        {layout.isPhone ? (
          <Pressable
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={t('admin:common.refresh')}
            style={[styles.refreshIcon, refreshing && styles.dimmed]}
          >
            <Icon name="refresh" size={iconSize.md} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Button title={t('admin:common.refresh')} icon="refresh" variant="ghost" size="sm" onPress={onRefresh} loading={refreshing} />
        )}
      </View>

      <FilterBar
        search={list.search}
        onSearch={searchable ? list.setSearch : undefined}
        searchPlaceholder={t(`admin:pages.${page}.search`)}
        groups={filterGroups}
        filters={list.filters}
        onFilter={list.setFilter}
        counts={stats?.breakdown}
        dirty={list.dirty}
        onClear={list.clear}
      />

      {list.loading && !list.items.length ? (
        <View style={styles.loading}><Spinner /></View>
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={list.dirty ? t('admin:pages.noMatchesTitle') : t(`admin:pages.${page}.emptyTitle`)}
          message={list.dirty ? t('admin:pages.noMatchesMessage') : t(`admin:pages.${page}.emptyMessage`)}
          actionLabel={list.dirty ? t('admin:filters.clear') : undefined}
          onAction={list.clear}
        />
      ) : (
        <View style={[styles.grid, list.loading && styles.dimmed]}>
          {list.items.map((item) => (
            <View key={item._id} style={[styles.cell, { width: `${100 / columns}%` }]}>
              {renderItem(item, list)}
            </View>
          ))}
        </View>
      )}

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        pageSize={list.pageSize}
        loading={list.loading}
        onChange={list.goTo}
        onPageSize={list.setPageSize}
      />
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconTile: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { ...type.h1, color: colors.textPrimary },
  titlePhone: { ...type.h2 },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  loading: { minHeight: 240 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm },
  dimmed: { opacity: 0.55 },
  cell: { paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
}));

export default ResourceScreen;
