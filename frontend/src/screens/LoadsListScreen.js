import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import RecordCard, { Fact, Pill, RouteLine } from '../components/common/RecordCard';
import { CardCell, cardGridProps, useCardColumns } from '../components/common/CardGrid';
import VerifiedBadge from '../components/common/VerifiedBadge';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Input from '../components/common/Input';
import useScreenLayout from '../hooks/useScreenLayout';
import { colors, spacing, themedStyles } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, formatKg, getErrorMessage } from '../utils/helpers';
import { dayLabel } from '../utils/nepalDate';
import { trucksBookedOf, trucksNeededOf } from '../utils/loadSlots';
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
  const columns = useCardColumns();

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
      key={`columns-${columns}`}
      {...cardGridProps(columns)}
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
        const needed = trucksNeededOf(item);
        const shipper = item.shipperId && typeof item.shipperId === 'object' ? item.shipperId : null;
        const shipperName = shipper ? shipper.companyName || [shipper.firstName, shipper.lastName].filter(Boolean).join(' ') : null;
        return (
          <CardCell columns={columns}>
            <RecordCard
              icon="load"
              title={item.goodsType}
              // Owners see who posted it; a shipper's own list shows when.
              subtitle={isShipper ? t('loads:loadsList.postedOn', { date: formatDate(item.createdAt) }) : shipperName}
              titleAddon={!isShipper && shipper?.verified ? <VerifiedBadge size={16} label={t('loads:common.verifiedOwner')} /> : null}
              badges={(
                <>
                  <StatusBadge status={item.status} />
                  {needed > 1 ? (
                    <Pill icon="truck" tone={trucksBookedOf(item) >= needed ? 'accent' : 'info'}>
                      {t('loads:truckSlots.booked', { booked: trucksBookedOf(item), needed })}
                    </Pill>
                  ) : null}
                  {item.budgetEstimate ? <Pill icon="price" tone="accent">{formatCurrency(item.budgetEstimate)}</Pill> : null}
                </>
              )}
              onPress={() => navigation.navigate('LoadDetail', { loadId: item._id })}
              accessibilityLabel={t('loads:loadsList.loadAccessibilityLabel', { goodsType: item.goodsType })}
            >
              <RouteLine
                from={item.pickupLocation?.label || item.pickupLocation?.address}
                to={item.dropoffLocation?.label || item.dropoffLocation?.address}
              />
              <Fact icon="weight" label={t('loads:common.weight')}>{item.weight ? formatKg(item.weight) : null}</Fact>
              <Fact icon="calendar" label={t('common:card.pickup')}>{item.pickupDay ? dayLabel(item.pickupDay) : null}</Fact>
              <Fact icon="quote" label={t('common:card.offers')}>{String(item.totalQuotes || 0)}</Fact>
              {!isShipper ? <Fact icon="time" label={t('common:card.posted')}>{formatDate(item.createdAt)}</Fact> : null}
            </RecordCard>
          </CardCell>
        );
      }}
    />
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  searchInput: { marginBottom: spacing.md },
  searchInputWide: { maxWidth: 440, marginBottom: spacing.lg },
}));

export default LoadsListScreen;
