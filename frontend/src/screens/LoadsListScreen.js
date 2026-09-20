import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Input from '../components/common/Input';
import useScreenLayout from '../hooks/useScreenLayout';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, formatKg, getErrorMessage } from '../utils/helpers';
import { dayLabel } from '../utils/nepalDate';
import api from '../services/api';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError } from '../redux/slices/loadsSlice';

const LoadsListScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { items: loads, isLoading, error } = useSelector((state) => state.loads);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const layout = useScreenLayout('wide');
  const columns = layout.isPhone ? 1 : layout.isDesktop ? 3 : 2;

  const isShipper = user?.role === ROLES.SHIPPER;

  const load = useCallback(async () => {
    dispatch(fetchLoadsStart());
    try {
      // Owners get the server's default browse: every load still taking offers.
      const q = isShipper ? '?mine=true' : '';
      const { data } = await api.get(`/loads${q}`);
      dispatch(fetchLoadsSuccess(data.loads));
    } catch (error) {
      dispatch(fetchLoadsError(getErrorMessage(error)));
    }
  }, [dispatch, isShipper]);

  useEffect(() => {
    navigation.setOptions({ title: isShipper ? t('loads:loadsList.myLoadsTitle') : t('loads:loadsList.availableLoadsTitle') });
    load();
  }, [load, navigation, isShipper, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Filtered in memory over the page already fetched (the server caps a
  // browse response at 100 loads), rather than a new search API.
  const filteredLoads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return loads;
    return loads.filter((item) => [item.goodsType, item.pickupLocation?.address, item.dropoffLocation?.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle));
  }, [loads, query]);

  const isFiltering = query.trim().length > 0;

  if (isLoading && !refreshing && loads.length === 0) return <Spinner />;

  if (error && loads.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="offline" tone="error" title={t('loads:loadsList.couldNotLoadThisTitle')} message={error} actionLabel={t('loads:common.tryAgain')} onAction={load} />
      </View>
    );
  }

  return (
    <FlatList
      // A mounted list can't change its column count, so a new count remounts it.
      key={`columns-${columns}`}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
      style={styles.container}
      contentContainerStyle={[styles.content, layout.contentStyle]}
      data={filteredLoads}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        loads.length > 0 && (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('loads:loadsList.searchPlaceholder')}
            icon="search"
            containerStyle={[styles.searchInput, !layout.isPhone && styles.searchInputWide]}
          />
        )
      }
      ListEmptyComponent={
        <EmptyState
          icon={isFiltering ? 'search' : 'load'}
          title={isFiltering ? t('loads:loadsList.noMatchesTitle') : isShipper ? t('loads:loadsList.noLoadsYetTitle') : t('loads:loadsList.noOpenLoadsTitle')}
          message={
            isFiltering
              ? t('loads:loadsList.noMatchesMessage')
              : isShipper
                ? t('loads:loadsList.noLoadsYetMessage')
                : t('loads:loadsList.noOpenLoadsMessage')
          }
          actionLabel={isFiltering ? t('loads:loadsList.clearSearchButton') : undefined}
          onAction={isFiltering ? () => setQuery('') : undefined}
        />
      }
      renderItem={({ item }) => {
        const offers = item.totalQuotes || 0;
        return (
          <View style={columns > 1 ? [styles.cell, { width: `${100 / columns}%` }] : null}>
            <Card
              style={[styles.card, columns > 1 && styles.cardInGrid]}
              containerStyle={columns > 1 ? styles.fill : undefined}
              onPress={() => navigation.navigate('LoadDetail', { loadId: item._id })}
              accessibilityLabel={t('loads:loadsList.loadAccessibilityLabel', { goodsType: item.goodsType })}
            >
              <View style={styles.row}>
                <Text style={styles.goodsType} numberOfLines={1}>{item.goodsType}</Text>
                <StatusBadge status={item.status} />
              </View>
              <View style={styles.routeRow}>
                <Icon name="pickup" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.route} numberOfLines={1}>{item.pickupLocation?.label || item.pickupLocation?.address}</Text>
                <Icon name="forward" size={iconSize.xs} color={colors.textMuted} />
                <Icon name="dropoff" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.route} numberOfLines={1}>{item.dropoffLocation?.label || item.dropoffLocation?.address}</Text>
              </View>
              {(item.weight || item.pickupDay) ? (
                <View style={styles.factsRow}>
                  {item.weight ? (
                    <View style={styles.metaRow}>
                      <Icon name="weight" size={iconSize.xs} color={colors.textMuted} />
                      <Text style={styles.meta}>{formatKg(item.weight)}</Text>
                    </View>
                  ) : null}
                  {item.pickupDay ? (
                    <View style={styles.metaRow}>
                      <Icon name="calendar" size={iconSize.xs} color={colors.textMuted} />
                      <Text style={styles.meta}>{t('loads:truckMatches.pickupOn', { day: dayLabel(item.pickupDay) })}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.rowBottom}>
                <View style={styles.metaRow}>
                  <Icon name="quote" size={iconSize.xs} color={colors.textMuted} />
                  <Text style={styles.meta}>{t('loads:loadsList.offersCount', { count: offers })}</Text>
                </View>
                {item.budgetEstimate ? <Text style={styles.budget}>{formatCurrency(item.budgetEstimate)}</Text> : null}
              </View>
              <Text style={styles.date}>{t('loads:loadsList.postedOn', { date: formatDate(item.createdAt) })}</Text>
            </Card>
          </View>
        );
      }}
    />
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  searchInput: { marginBottom: spacing.sm },
  searchInputWide: { maxWidth: 440, marginBottom: spacing.md },
  card: { marginVertical: spacing.xs },
  // Grid layout: each cell carries half the gutter on both sides.
  columnRow: { marginHorizontal: -spacing.sm },
  cell: { paddingHorizontal: spacing.sm },
  cardInGrid: { flex: 1, marginVertical: spacing.sm },
  fill: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, flexWrap: 'wrap' },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.sm },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goodsType: { ...type.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  route: { ...type.small, color: colors.textMuted },
  meta: { ...type.small, color: colors.textMuted },
  budget: { ...type.bodyMedium, color: colors.primaryText },
  date: { ...type.small, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
}));

export default LoadsListScreen;
