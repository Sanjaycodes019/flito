import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Spinner from '../../../components/common/Spinner';
import Icon from '../../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../../theme/tokens';
import useAdminList from '../../useAdminList';
import { Panel, Muted } from './DetailParts';

const PAGE_SIZE = 5;

const PagerButton = ({ icon, label, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    style={({ pressed }) => [styles.pagerButton, disabled && styles.pagerDisabled, pressed && styles.pagerPressed]}
  >
    <Icon name={icon} size={iconSize.sm} color={colors.textSecondary} />
  </Pressable>
);

// The records that belong to this one (a user's bookings, an owner's trucks),
// five at a time, through the same paginated admin list endpoint as the
// section's own page, narrowed by `filters` (e.g. { userId }). However many
// there are, the page only ever holds five.
//
//   <RelatedList icon="truckDelivery" title="Bookings" endpoint="/admin/bookings"
//     itemsKey="bookings" filters={{ userId }} emptyText="No bookings yet"
//     renderRow={(booking, first) => <RecordRow first={first} ... />} />
const RelatedList = ({ icon, title, endpoint, itemsKey, filters, renderRow, emptyText }) => {
  const { t } = useTranslation();
  // Stable for the life of the panel, so the list loads once per record.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFilters = useMemo(() => filters, [JSON.stringify(filters)]);
  const list = useAdminList(endpoint, itemsKey, { pageSize: PAGE_SIZE, initialFilters });

  const from = (list.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(list.total, list.page * PAGE_SIZE);

  return (
    <Panel icon={icon} title={title} count={list.loading && !list.items.length ? null : list.total}>
      {list.loading && !list.items.length ? (
        <View style={styles.loading}><Spinner /></View>
      ) : list.items.length === 0 ? (
        <Muted>{emptyText}</Muted>
      ) : (
        <View style={list.loading && styles.dimmed}>
          {list.items.map((item, index) => (
            <React.Fragment key={item._id}>{renderRow(item, index === 0)}</React.Fragment>
          ))}
        </View>
      )}

      {list.totalPages > 1 ? (
        <View style={styles.pager}>
          <Text style={styles.pagerText}>{t('admin:pagination.showing', { from, to, total: list.total })}</Text>
          <View style={styles.pagerButtons}>
            <PagerButton icon="back" label={t('admin:pagination.previous')} disabled={list.page <= 1 || list.loading} onPress={() => list.goTo(list.page - 1)} />
            <PagerButton icon="forward" label={t('admin:pagination.next')} disabled={list.page >= list.totalPages || list.loading} onPress={() => list.goTo(list.page + 1)} />
          </View>
        </View>
      ) : null}
    </Panel>
  );
};

const styles = themedStyles(() => ({
  loading: { minHeight: 96 },
  dimmed: { opacity: 0.55 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  pagerText: { ...type.small, color: colors.textMuted, flexShrink: 1 },
  pagerButtons: { flexDirection: 'row', gap: spacing.xs },
  pagerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerDisabled: { opacity: 0.4 },
  pagerPressed: { backgroundColor: colors.surfaceMuted },
}));

export default RelatedList;
