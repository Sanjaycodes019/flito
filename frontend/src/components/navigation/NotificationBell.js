import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import useNotifications from '../../services/notifications';
import { colors, iconSize } from '../../theme/tokens';

// The header's notification bell, with the unread count (1, 2, 3 ... 99+) on
// top. Opens the feed.
const NotificationBell = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const token = useSelector((state) => state.auth.token);
  const { unreadCount } = useNotifications(token);

  return (
    <Pressable
      onPress={() => navigation.navigate('HomeTab', { screen: 'Notifications' })}
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? t('notifications:unread', { count: unreadCount }) : t('notifications:title')}
      hitSlop={6}
      style={styles.button}
    >
      <Icon name={unreadCount ? 'bellActive' : 'bell'} size={iconSize.lg} color={colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 13, fontWeight: '700', color: colors.textOnDark },
});

export default NotificationBell;
