import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import useScreenLayout from '../../hooks/useScreenLayout';
import api from '../../services/api';
import { formatDate } from '../../utils/helpers';
import useAdminStats, { refreshAdminStats } from '../useAdminStats';
import { displayName } from '../format';

// Headline numbers. `stat` is a key of GET /admin/stats, `to` the section it
// opens, `hintStat` a second number shown under the label. Add a tile by
// adding a row.
const TILES = [
  { stat: 'userCount', icon: 'people', labelKey: 'admin:stats.users', to: 'AdminUsers' },
  { stat: 'loadCount', icon: 'load', labelKey: 'admin:stats.loads', hintStat: 'openLoads', hintKey: 'admin:dashboard.openLoads', to: 'AdminLoads' },
  { stat: 'bookingCount', icon: 'truckDelivery', labelKey: 'admin:stats.bookings', hintStat: 'activeBookings', hintKey: 'admin:dashboard.activeBookings', to: 'AdminBookings' },
  { stat: 'truckCount', icon: 'truck', labelKey: 'admin:stats.trucks', to: 'AdminTrucks' },
];

// Work waiting for an admin, shown only while there is some.
const ATTENTION = [
  { stat: 'pendingKyc', icon: 'verified', titleKey: 'admin:dashboard.kycWaiting', to: 'AdminKyc' },
  { stat: 'pendingTrucks', icon: 'truck', titleKey: 'admin:dashboard.trucksWaiting', to: 'AdminTrucks' },
];

// Bar charts from GET /admin/stats `breakdown`: where records stand. `path` is
// [resource, filter] in the breakdown; `labelKey` turns a value into text.
const BREAKDOWNS = [
  { key: 'roles', titleKey: 'admin:dashboard.usersByRole', icon: 'people', path: ['users', 'role'], labelKey: (v) => `admin:roles.${v}`, to: 'AdminUsers' },
  { key: 'loads', titleKey: 'admin:dashboard.loadsByStatus', icon: 'load', path: ['loads', 'status'], labelKey: (v) => `common:status.${v}`, to: 'AdminLoads' },
  { key: 'bookings', titleKey: 'admin:dashboard.bookingsByStatus', icon: 'truckDelivery', path: ['bookings', 'status'], labelKey: (v) => `common:status.${v}`, to: 'AdminBookings' },
  { key: 'trucks', titleKey: 'admin:dashboard.trucksByVerification', icon: 'truck', path: ['trucks', 'status'], labelKey: (v) => `common:status.${v}`, to: 'AdminTrucks' },
];

const greetingKey = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'admin:dashboard.morning' : hour < 18 ? 'admin:dashboard.afternoon' : 'admin:dashboard.evening';
};

const SectionTitle = ({ children, action }) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {action}
  </View>
);

const StatTile = ({ tile, stats, onOpen, t }) => (
  <Card containerStyle={styles.tile} style={styles.tileInner} onPress={onOpen} accessibilityLabel={t(tile.labelKey)}>
    <View style={styles.tileTop}>
      <View style={styles.iconWrap}>
        <Icon name={tile.icon} size={iconSize.md} color={colors.primaryText} />
      </View>
      <Icon name="forward" size={iconSize.sm} color={colors.textMuted} />
    </View>
    <Text style={styles.value}>{stats[tile.stat] ?? '-'}</Text>
    <Text style={styles.label}>{t(tile.labelKey)}</Text>
    {tile.hintStat && stats[tile.hintStat] != null ? (
      <Text style={styles.hint}>{t(tile.hintKey, { count: stats[tile.hintStat] })}</Text>
    ) : null}
  </Card>
);

const BreakdownCard = ({ spec, stats, t, onOpen }) => {
  const data = spec.path.reduce((node, part) => node?.[part], stats.breakdown) || {};
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  const max = rows.length ? rows[0][1] : 0;

  return (
    <Card style={styles.panel}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.panelHead}>
        <Icon name={spec.icon} size={iconSize.sm} color={colors.primaryText} />
        <Text style={styles.panelTitle}>{t(spec.titleKey)}</Text>
        <Text style={styles.panelTotal}>{total}</Text>
      </Pressable>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{t('admin:dashboard.noData')}</Text>
      ) : rows.map(([value, count]) => (
        <View key={value} style={styles.barRow}>
          <View style={styles.barText}>
            <Text style={styles.barLabel} numberOfLines={1}>{t(spec.labelKey(value), value)}</Text>
            <Text style={styles.barCount}>{count}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.max(4, (count / max) * 100)}%` }]} />
          </View>
        </View>
      ))}
    </Card>
  );
};

// What an admin sees first: what needs them, the headline numbers, where
// everything stands, and who joined last. Every block links into the section
// it summarises.
const DashboardScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const layout = useScreenLayout('wide');
  const stats = useAdminStats({ passive: true });
  const firstName = useSelector((state) => state.auth.user?.firstName);
  const [refreshing, setRefreshing] = useState(false);
  const [newest, setNewest] = useState(null);

  const loadNewest = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/users', { params: { limit: 5 } });
      setNewest(data.users);
    } catch {
      setNewest([]);
    }
  }, []);

  useEffect(() => { loadNewest(); }, [loadNewest]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAdminStats(), loadNewest()]);
    setRefreshing(false);
  };

  const waiting = stats ? ATTENTION.filter((item) => stats[item.stat] > 0) : [];
  const wide = layout.isDesktop || layout.isTablet;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.greeting}>{t(greetingKey())}{firstName ? `, ${firstName}` : ''}</Text>
          <Text style={styles.subtitle}>{t('admin:dashboard.subtitle')}</Text>
        </View>
        {!layout.isPhone ? (
          <Button title={t('admin:common.refresh')} icon="refresh" variant="ghost" size="sm" onPress={onRefresh} loading={refreshing} />
        ) : null}
      </View>

      {!stats ? (
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <>
          <SectionTitle>{t('admin:dashboard.needsAttention')}</SectionTitle>
          {waiting.length === 0 ? (
            <Card style={styles.clear}>
              <View style={[styles.iconWrap, styles.iconWrapOk]}>
                <Icon name="success" size={iconSize.md} color={colors.successText} />
              </View>
              <View style={styles.clearText}>
                <Text style={styles.clearTitle}>{t('admin:dashboard.allClearTitle')}</Text>
                <Text style={styles.clearBody}>{t('admin:dashboard.allClear')}</Text>
              </View>
            </Card>
          ) : (
            <View style={styles.attentionGrid}>
              {waiting.map((item) => (
                <Card key={item.stat} style={styles.attention} containerStyle={styles.attentionCell}>
                  <View style={styles.attentionMain}>
                    <View style={[styles.iconWrap, styles.iconWrapWarn]}>
                      <Icon name={item.icon} size={iconSize.md} color={colors.warningText} />
                    </View>
                    <Text style={styles.attentionTitle}>{t(item.titleKey, { count: stats[item.stat] })}</Text>
                  </View>
                  <Button title={t('admin:dashboard.review')} size="sm" icon="forward" iconPosition="right" onPress={() => navigation.navigate(item.to)} />
                </Card>
              ))}
            </View>
          )}

          <SectionTitle>{t('admin:dashboard.platform')}</SectionTitle>
          <View style={styles.tiles}>
            {TILES.map((tile) => (
              <StatTile key={tile.stat} tile={tile} stats={stats} t={t} onOpen={() => navigation.navigate(tile.to)} />
            ))}
          </View>

          <SectionTitle>{t('admin:dashboard.whereThingsStand')}</SectionTitle>
          <View style={styles.panels}>
            {BREAKDOWNS.map((spec) => (
              <View key={spec.key} style={wide ? styles.panelCellWide : styles.panelCell}>
                <BreakdownCard spec={spec} stats={stats} t={t} onOpen={() => navigation.navigate(spec.to)} />
              </View>
            ))}
          </View>

          <SectionTitle
            action={<Button title={t('admin:dashboard.viewAll')} size="sm" variant="ghost" onPress={() => navigation.navigate('AdminUsers')} />}
          >
            {t('admin:dashboard.newestUsers')}
          </SectionTitle>
          <Card style={styles.list}>
            {newest === null ? (
              <View style={styles.listLoading}><Spinner /></View>
            ) : newest.length === 0 ? (
              <Text style={styles.empty}>{t('admin:dashboard.noData')}</Text>
            ) : newest.map((user, index) => (
              <View key={user._id} style={[styles.userRow, index > 0 && styles.userRowRule]}>
                <Avatar role={user.role} size={36} />
                <View style={styles.userText}>
                  <Text style={styles.userName} numberOfLines={1}>{displayName(user) || user.email}</Text>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    {[t(`admin:roles.${user.role}`, user.role), formatDate(user.createdAt)].join(' · ')}
                  </Text>
                </View>
                <StatusBadge status={user.status} />
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1 },
  greeting: { ...type.h1, color: colors.textPrimary },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xxs },
  loading: { minHeight: 240 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  iconWrapWarn: { backgroundColor: colors.warningMuted },
  iconWrapOk: { backgroundColor: colors.successMuted },

  attentionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  attentionCell: { flexGrow: 1, flexBasis: 300 },
  attention: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warningText },
  attentionMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  attentionTitle: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  clearText: { flex: 1 },
  clearTitle: { ...type.bodyMedium, color: colors.textPrimary },
  clearBody: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: 150 },
  tileInner: { paddingVertical: spacing.lg },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { ...type.display, color: colors.textPrimary, marginTop: spacing.md },
  label: { ...type.smallMedium, color: colors.textSecondary },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },

  panels: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm },
  panelCell: { width: '100%', paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  panelCellWide: { width: '50%', paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  panel: { flex: 1 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  panelTitle: { ...type.bodyMedium, color: colors.textPrimary, flex: 1 },
  panelTotal: { ...type.h3, color: colors.textPrimary },
  barRow: { marginTop: spacing.sm },
  barText: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxs },
  barLabel: { ...type.small, color: colors.textSecondary, flexShrink: 1 },
  barCount: { ...type.smallMedium, color: colors.textPrimary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  empty: { ...type.small, color: colors.textMuted },

  list: { paddingVertical: spacing.xs },
  listLoading: { minHeight: 80 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  userRowRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  userText: { flex: 1, minWidth: 0 },
  userName: { ...type.bodyMedium, color: colors.textPrimary },
  userMeta: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
});

export default DashboardScreen;
