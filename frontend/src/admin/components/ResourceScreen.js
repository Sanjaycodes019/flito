import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useScreenLayout from '../../hooks/useScreenLayout';
import CardGrid, { useCardColumns } from '../../components/common/CardGrid';
import useAdminList from '../useAdminList';
import useAdminStats, { refreshAdminStats } from '../useAdminStats';
import FilterBar from './FilterBar';
import Pagination from './Pagination';


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

  // Cards per row, from the room the list really has (components/common/CardGrid).
  const columns = useCardColumns();

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
        <View style={list.loading && styles.dimmed}>
          <CardGrid columns={columns}>
            {list.items.map((item) => <React.Fragment key={item._id}>{renderItem(item, list)}</React.Fragment>)}
          </CardGrid>
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
  dimmed: { opacity: 0.55 },
}));

export default ResourceScreen;
