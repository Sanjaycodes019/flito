import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Spinner from '../../../components/common/Spinner';
import EmptyState from '../../../components/common/EmptyState';
import Button from '../../../components/common/Button';
import Icon from '../../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../../theme/tokens';
import useScreenLayout from '../../../hooks/useScreenLayout';
import { SIDEBAR_WIDTH } from '../../../components/navigation/Sidebar';
import { ADMIN_RECORDS } from '../../records';
import { refreshAdminStats } from '../../useAdminStats';

// The side column (status and actions) sits beside the details once the page
// has this much room; below it, it comes first, above the details, so the
// actions are never at the bottom of a long phone page.
const TWO_COLUMNS_FROM = 900;
const SIDE_WIDTH = 360;

// The way back to the record's list, on a laptop where there is no native
// header: "‹ Users / Bikash Thapa".
const Breadcrumb = ({ kind, current }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const record = ADMIN_RECORDS[kind];
  const label = t(record.listLabelKey);

  return (
    <View style={styles.crumbs} accessibilityRole="navigation">
      <Pressable
        onPress={() => navigation.navigate(record.listRoute)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="link"
        accessibilityLabel={t('admin:detail.backTo', { section: label })}
        style={[styles.crumbLink, hovered && styles.crumbLinkHovered]}
      >
        <Icon name="back" size={iconSize.sm} color={colors.primaryText} />
        <Text style={styles.crumbLinkText}>{label}</Text>
      </Pressable>
      {current ? (
        <>
          <Text style={styles.crumbSep}>/</Text>
          <Text style={styles.crumbCurrent} numberOfLines={1}>{current}</Text>
        </>
      ) : null}
    </View>
  );
};

// Placeholder blocks the shape of the page while it loads, so it doesn't
// jump when the record arrives.
const Skeleton = ({ twoColumns }) => (
  <View accessibilityLabel="Loading" accessible>
    <View style={[styles.skeleton, styles.skeletonHero]} />
    <View style={twoColumns ? styles.columns : null}>
      <View style={twoColumns ? styles.main : null}>
        <View style={[styles.skeleton, styles.skeletonBlock]} />
        <View style={[styles.skeleton, styles.skeletonBlock]} />
      </View>
      {twoColumns ? <View style={styles.side}><View style={[styles.skeleton, styles.skeletonBlock]} /></View> : null}
    </View>
    <Spinner />
  </View>
);

// The frame of every admin record page (a user, truck, booking or load):
// breadcrumb, a hero card, then the details beside a side column of status
// and actions on a wide screen, stacked on a narrow one. Handles loading,
// not found, errors and pull-to-refresh, so each record page only lays out
// its own content.
//
//   <DetailPage kind="user" record={record} title={name}
//     hero={<Hero .../>} side={<>...actions</>}>
//     ...detail panels
//   </DetailPage>
const DetailPage = ({ kind, record, title, hero, side, children }) => {
  const { t } = useTranslation();
  const layout = useScreenLayout('medium', 'wide');
  const [refreshing, setRefreshing] = useState(false);
  const contentWidth = Math.min(layout.width - (layout.isDesktop ? SIDEBAR_WIDTH : 0) - layout.gutter * 2, 1200);
  const twoColumns = contentWidth >= TWO_COLUMNS_FROM;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([record.refresh(), refreshAdminStats()]);
    setRefreshing(false);
  };

  let body;
  if (record.loading && !record.data) {
    body = <Skeleton twoColumns={twoColumns} />;
  } else if (record.error && !record.data) {
    body = record.error.notFound ? (
      <EmptyState icon="search" title={t('admin:detail.notFoundTitle')} message={t('admin:detail.notFoundMessage')} />
    ) : (
      <EmptyState icon="offline" tone="error" title={t('admin:detail.loadErrorTitle')} message={record.error.message} actionLabel={t('admin:common.retry')} onAction={record.refresh} />
    );
  } else {
    body = (
      <>
        {hero}
        {twoColumns ? (
          <View style={styles.columns}>
            <View style={styles.main}>{children}</View>
            <View style={styles.side}>{side}</View>
          </View>
        ) : (
          <View>
            {side}
            {children}
          </View>
        )}
      </>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {layout.isDesktop ? (
        <View style={styles.topBar}>
          <Breadcrumb kind={kind} current={record.data ? title : null} />
          {record.data ? (
            <Button title={t('admin:common.refresh')} icon="refresh" variant="ghost" size="sm" onPress={onRefresh} loading={refreshing} />
          ) : null}
        </View>
      ) : null}
      {body}
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.lg },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, minWidth: 0 },
  crumbLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, marginLeft: -spacing.sm, borderRadius: radius.md },
  crumbLinkHovered: { backgroundColor: colors.primaryMuted },
  crumbLinkText: { ...type.smallMedium, color: colors.primaryText },
  crumbSep: { ...type.small, color: colors.textMuted },
  crumbCurrent: { ...type.smallMedium, color: colors.textSecondary, flexShrink: 1 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  main: { flex: 1, minWidth: 0 },
  side: { width: SIDE_WIDTH, flexShrink: 0 },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, marginBottom: spacing.lg },
  skeletonHero: { height: 160 },
  skeletonBlock: { height: 220 },
}));

export default DetailPage;
