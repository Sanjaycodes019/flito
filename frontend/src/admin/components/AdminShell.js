import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SidebarFrame, SidebarNavItem } from '../../components/navigation/Sidebar';
import { colors } from '../../theme/tokens';
import useBreakpoint from '../../hooks/useBreakpoint';
import useAdminStats from '../useAdminStats';
import { ADMIN_SECTIONS } from '../sections';

const AdminSidebar = ({ active }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const stats = useAdminStats();

  return (
    <SidebarFrame
      tagIcon="admin"
      tag={t('admin:console.title')}
      group={t('admin:console.management')}
      current={active === 'home' || active === 'profile' ? active : null}
    >
      {ADMIN_SECTIONS.map((section) => (
        <SidebarNavItem
          key={section.key}
          icon={section.icon}
          label={t(section.labelKey)}
          active={section.key === active}
          badge={section.badgeStat && stats ? stats[section.badgeStat] : 0}
          onPress={() => section.key !== active && navigation.navigate(section.route)}
        />
      ))}
    </SidebarFrame>
  );
};

// The frame around every admin page. On a laptop it is the console: a
// full-height sidebar with the FLITO mark, the sections, and your account, and
// the page beside it. On a phone or tablet the bottom bar (AppTabBar) is the
// navigation and this adds nothing. Sections come from ADMIN_SECTIONS, so a new
// page shows up in both without touching this file.
const AdminShell = ({ active, children }) => {
  const { isDesktop } = useBreakpoint();

  if (!isDesktop) return <View style={styles.main}>{children}</View>;

  return (
    <View style={styles.root}>
      <AdminSidebar active={active} />
      <View style={styles.main}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  main: { flex: 1, backgroundColor: colors.background },
});

export default AdminShell;
