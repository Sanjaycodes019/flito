import React, { useState } from 'react';
import { View, Text, Image, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import Button from '../../components/common/Button';
import QuickToggles from '../../components/common/QuickToggles';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';
import { PUBLIC_PAGES } from '../pages';
import useOpenPage from '../useOpenPage';
import useSiteStyle, { SITE_WIDTH, landmark } from '../siteStyle';

const LOGO = require('../../../assets/icon.png');
const NAV_PAGES = PUBLIC_PAGES.filter((page) => page.nav);

// The FLITO mark, linking to the landing page. The wordmark keeps the true
// brand amber: WCAG contrast minimums do not apply to logotype.
export const SiteBrand = ({ onPress, inverse = false, size = 36 }) => (
  <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel="FLITO" style={styles.brand} hitSlop={6}>
    <Image source={LOGO} style={{ width: size, height: size, borderRadius: radius.md }} resizeMode="contain" accessible={false} />
    <Text style={[styles.wordmark, inverse && styles.wordmarkInverse, size < 36 && styles.wordmarkSmall]}>FLITO</Text>
  </Pressable>
);

const NavLink = ({ label, active, onPress }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      aria-current={active ? 'page' : undefined}
      style={[styles.link, hovered && !active && styles.linkHovered]}
    >
      <Text style={[styles.linkText, active && styles.linkTextActive]}>{label}</Text>
      {active ? <View style={styles.linkBar} /> : null}
    </Pressable>
  );
};

// The full-height menu a phone or tablet opens from the navbar: every page,
// then the ways in.
const MenuSheet = ({ visible, onClose, pageKey }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const site = useSiteStyle();
  const { openPage, openAuth } = useOpenPage();
  const go = (fn) => { onClose(); fn(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.menuRoot}>
        <Pressable style={styles.menuBackdrop} onPress={onClose} accessibilityLabel={t('site:nav.closeMenu')} accessibilityRole="button" />
        <View style={[styles.menuSheet, site.windowWidth >= 600 && styles.menuSheetSide, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.menuHead}>
            <SiteBrand onPress={() => go(() => openAuth('Landing'))} />
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('site:nav.closeMenu')} style={styles.iconButton} hitSlop={8}>
              <Icon name="close" size={iconSize.lg} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.menuBody}>
            <Text style={styles.menuGroup}>{t('site:nav.explore')}</Text>
            {PUBLIC_PAGES.map((page) => {
              const active = page.key === pageKey;
              return (
                <Pressable
                  key={page.key}
                  onPress={() => go(() => openPage(page.key))}
                  accessibilityRole="link"
                  aria-current={active ? 'page' : undefined}
                  style={({ pressed }) => [styles.menuRow, (active || pressed) && styles.menuRowActive]}
                >
                  <View style={[styles.menuIcon, active && styles.menuIconActive]}>
                    <Icon name={page.icon} size={iconSize.md} color={active ? colors.primaryText : colors.textSecondary} />
                  </View>
                  <View style={styles.menuRowText}>
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{t(`site:pages.${page.key}.label`)}</Text>
                    <Text style={styles.menuHint} numberOfLines={1}>{t(`site:pages.${page.key}.hint`)}</Text>
                  </View>
                  <Icon name="forward" size={iconSize.md} color={colors.textMuted} />
                </Pressable>
              );
            })}

            <View style={styles.menuToggles}>
              <Text style={styles.menuGroup}>{t('site:nav.preferences')}</Text>
              <QuickToggles />
            </View>
          </ScrollView>

          <View style={styles.menuActions}>
            <Button title={t('site:nav.signUp')} icon="add" size="lg" onPress={() => go(() => openAuth('Signup'))} />
            <Button title={t('site:nav.logIn')} icon="login" variant="tertiary" onPress={() => go(() => openAuth('Login'))} />
            <Button title={t('site:nav.driverLogin')} icon="phone" variant="ghost" size="sm" onPress={() => go(() => openAuth('PinLogin'))} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// The public site's top bar. A laptop shows every link and both ways in; a
// phone or tablet keeps the mark, the language/theme pill and a menu button.
const PublicNavbar = ({ pageKey, elevated = false }) => {
  const { t } = useTranslation();
  const site = useSiteStyle();
  const { openPage, openAuth } = useOpenPage();
  const [menuOpen, setMenuOpen] = useState(false);
  const wide = site.isWideWindow;

  return (
    <View style={[styles.bar, elevated && styles.barElevated]} {...landmark('banner')}>
      <View style={[styles.inner, { maxWidth: SITE_WIDTH + site.gutter * 2, paddingHorizontal: site.gutter, height: wide ? 76 : 64 }]}>
        <SiteBrand onPress={() => openAuth('Landing')} />

        {wide ? (
          <>
            <View style={styles.links} {...landmark('navigation')}>
              {NAV_PAGES.map((page) => (
                <NavLink key={page.key} label={t(`site:pages.${page.key}.label`)} active={page.key === pageKey} onPress={() => openPage(page.key)} />
              ))}
            </View>
            <View style={styles.actions}>
              <QuickToggles />
              <Button title={t('site:nav.logIn')} variant="ghost" size="sm" onPress={() => openAuth('Login')} style={styles.flatButton} />
              <Button title={t('site:nav.signUp')} size="sm" onPress={() => openAuth('Signup')} style={styles.flatButton} />
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            {!site.isPhone || site.windowWidth >= 400 ? <QuickToggles /> : null}
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('site:nav.openMenu')}
              accessibilityState={{ expanded: menuOpen }}
              style={({ pressed }) => [styles.iconButton, styles.menuButton, pressed && styles.menuButtonPressed]}
              hitSlop={6}
            >
              <Icon name="menu" size={iconSize.lg} color={colors.textPrimary} />
            </Pressable>
          </View>
        )}
      </View>
      {!wide ? <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} pageKey={pageKey} /> : null}
    </View>
  );
};

const styles = themedStyles(() => ({
  bar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  barElevated: { ...shadow.level2, borderBottomColor: 'transparent' },
  inner: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },

  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.primary, letterSpacing: 1.2 },
  wordmarkSmall: { fontSize: 19 },
  wordmarkInverse: { color: colors.primary },

  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, justifyContent: 'center' },
  link: { height: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md },
  linkHovered: { backgroundColor: colors.surfaceMuted },
  linkText: { ...type.bodyMedium, fontSize: 16, color: colors.textSecondary },
  linkTextActive: { color: colors.textPrimary },
  linkBar: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 2, height: 3, borderRadius: 2, backgroundColor: colors.primary },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flatButton: { marginVertical: 0 },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  menuButton: { borderWidth: 1, borderColor: colors.border },
  menuButtonPressed: { backgroundColor: colors.surfaceMuted },

  // Menu sheet
  menuRoot: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  menuSheet: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  menuSheetSide: { flex: 0, width: 400, ...shadow.level3 },
  menuHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuBody: { paddingVertical: spacing.lg },
  menuGroup: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginLeft: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  menuRowActive: { backgroundColor: colors.primaryMuted },
  menuIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  menuIconActive: { backgroundColor: colors.surface },
  menuRowText: { flex: 1, minWidth: 0 },
  menuLabel: { ...type.bodyMedium, color: colors.textPrimary },
  menuLabelActive: { color: colors.primaryText },
  menuHint: { ...type.small, color: colors.textMuted },
  menuToggles: { marginTop: spacing.xl, alignItems: 'flex-start', gap: spacing.xs },
  menuActions: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
}));

export default PublicNavbar;
