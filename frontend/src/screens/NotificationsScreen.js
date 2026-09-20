import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import Spinner from '../components/common/Spinner';
import useScreenLayout from '../hooks/useScreenLayout';
import useNotifications, { refreshNotifications, markNotificationsRead } from '../services/notifications';
import { routeForNotification } from '../services/pushNotifications';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
import { formatDate } from '../utils/helpers';

const ICON = { load: 'load', booking: 'truckDelivery', kyc: 'verified' };

const NotificationsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const token = useSelector((state) => state.auth.token);
  const { items, unreadCount, loaded } = useNotifications(token);
  const [refreshing, setRefreshing] = useState(false);
  const layout = useScreenLayout('narrow');

  useEffect(() => { refreshNotifications(); }, []);

  const open = (item) => {
    if (!item.read) markNotificationsRead([item.id]);
    const route = routeForNotification(item.data);
    if (route) navigation.navigate(...route);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  if (!loaded) return <Spinner />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[layout.contentStyle, styles.list]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={unreadCount > 0 ? (
        <Pressable onPress={() => markNotificationsRead()} accessibilityRole="button" style={styles.markAll}>
          <Text style={styles.markAllText}>{t('notifications:markAllRead')}</Text>
        </Pressable>
      ) : null}
      ListEmptyComponent={<EmptyState icon="bell" title={t('notifications:emptyTitle')} message={t('notifications:emptyMessage')} />}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} accessibilityRole="button">
          <Card style={[styles.card, !item.read && styles.unread]}>
            <View style={styles.iconWrap}>
              <Icon name={ICON[item.data?.type] || 'bell'} size={iconSize.md} color={item.read ? colors.textMuted : colors.primaryText} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
              {!!item.body && <Text style={styles.body}>{item.body}</Text>}
              <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </Card>
        </Pressable>
      )}
    />
  );
};

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  markAll: { alignSelf: 'flex-end', paddingVertical: spacing.sm, marginBottom: spacing.xs },
  markAllText: { ...type.smallMedium, color: colors.primaryText },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  unread: { backgroundColor: colors.primaryMuted },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...type.bodyMedium, color: colors.textPrimary },
  titleUnread: { fontWeight: '700' },
  body: { ...type.small, color: colors.textSecondary },
  time: { ...type.small, color: colors.textMuted, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error, marginTop: 6 },
});

export default NotificationsScreen;
