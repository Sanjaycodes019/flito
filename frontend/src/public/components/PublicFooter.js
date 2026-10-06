import React, { useState } from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { changeLanguage } from '../../i18n';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../../utils/constants';
import { FOOTER_GROUPS } from '../pages';
import { AUTHOR } from '../seo';
import useOpenPage from '../useOpenPage';
import useSiteStyle, { SITE_WIDTH, landmark } from '../siteStyle';
import { SiteBrand } from './PublicNavbar';

const FooterLink = ({ label, onPress, href, icon }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      href={href}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      style={styles.footerLink}
      hitSlop={4}
    >
      {icon ? <Icon name={icon} size={iconSize.sm} color={hovered ? colors.primary : colors.textInverseMuted} /> : null}
      <Text style={[styles.footerLinkText, hovered && styles.footerLinkHovered]}>{label}</Text>
    </Pressable>
  );
};

// The public site's footer, on the dark Deep Asphalt band: the brand and what
// FLITO is for, every page in four columns, real contact routes when they are
// configured, then the copyright line and a language switch, and last the
// maker's credit.
const PublicFooter = ({ onBackToTop }) => {
  const { t, i18n } = useTranslation();
  const site = useSiteStyle();
  const { pageLink, authLink } = useOpenPage();
  const year = new Date().getFullYear();
  const columns = site.isPhone ? 2 : 4;
  // The name is the link, wherever the language puts it in the sentence.
  const [creditBefore, creditAfter = ''] = t('site:footer.madeBy', { name: '\u0000' }).split('\u0000');

  const groups = FOOTER_GROUPS.map((group) => (
    <View key={group.key} style={[styles.group, { width: `${100 / columns}%` }]}>
      <Text style={styles.groupTitle} accessibilityRole="header" aria-level={2}>{t(`site:footer.groups.${group.key}`)}</Text>
      {(group.items || []).map((key) => (
        <FooterLink key={key} label={t(`site:pages.${key}.label`)} {...pageLink(key)} />
      ))}
      {(group.auth || []).map((item) => (
        <FooterLink key={item.key} label={t(`site:footer.auth.${item.key}`)} {...authLink(item.route, item.params)} />
      ))}
    </View>
  ));

  return (
    <View style={styles.footer} {...landmark('contentinfo')}>
      <View style={[styles.inner, { maxWidth: SITE_WIDTH + site.gutter * 2, paddingHorizontal: site.gutter }]}>
        <View style={[styles.top, site.isDesktop && styles.topWide]}>
          <View style={[styles.brandCol, site.isDesktop && styles.brandColWide]}>
            <SiteBrand {...authLink('Landing')} inverse />
            <Text style={styles.tagline}>{t('site:footer.tagline')}</Text>
            <Text style={styles.about}>{t('site:footer.about')}</Text>
            <View style={styles.made}>
              <Icon name="mountain" size={iconSize.sm} color={colors.accent} />
              <Text style={styles.madeText}>{t('site:footer.madeIn')}</Text>
            </View>
            {SUPPORT_EMAIL || SUPPORT_PHONE ? (
              <View style={styles.contact}>
                {SUPPORT_PHONE ? (
                  <FooterLink icon="phone" label={SUPPORT_PHONE} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})} />
                ) : null}
                {SUPPORT_EMAIL ? (
                  <FooterLink icon="email" label={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})} />
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={[styles.groups, site.isDesktop && styles.groupsWide]}>{groups}</View>
        </View>

        <View style={[styles.bottom, site.isPhone && styles.bottomStacked]}>
          <Text style={styles.copyright}>{t('site:footer.copyright', { year })}</Text>
          <View style={styles.bottomLinks}>
            <View style={styles.langSwitch} accessibilityRole="radiogroup" accessibilityLabel={t('common:language.label')}>
              <Icon name="language" size={iconSize.sm} color={colors.textInverseMuted} />
              {[{ lng: 'ne', label: 'नेपाली' }, { lng: 'en', label: 'English' }].map(({ lng, label }) => {
                const on = i18n.language === lng;
                return (
                  <Pressable
                    key={lng}
                    onPress={() => changeLanguage(lng)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.langOption, on && styles.langOptionOn]}
                  >
                    <Text style={[styles.langText, on && styles.langTextOn]} lang={lng}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {onBackToTop ? <FooterLink icon="arrowUp" label={t('site:footer.backToTop')} onPress={onBackToTop} /> : null}
          </View>
        </View>

        <Text style={styles.credit}>
          {creditBefore}
          <Text
            style={styles.creditLink}
            accessibilityRole="link"
            {...(Platform.OS === 'web'
              ? { href: AUTHOR.url, hrefAttrs: { target: '_blank', rel: 'noopener' } }
              : { onPress: () => Linking.openURL(AUTHOR.url).catch(() => {}) })}
          >
            {AUTHOR.name}
          </Text>
          {creditAfter}
        </Text>
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  footer: { backgroundColor: colors.surfaceDark, paddingTop: 64, paddingBottom: spacing.xxl },
  inner: { width: '100%', alignSelf: 'center' },
  top: { gap: spacing.huge },
  topWide: { flexDirection: 'row', gap: 64 },
  brandCol: { gap: spacing.md, maxWidth: 420 },
  brandColWide: { width: 340 },
  tagline: { ...type.caption, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.xs },
  about: { ...type.body, color: colors.textInverseMuted },
  made: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  madeText: { ...type.smallMedium, color: colors.textInverse },
  contact: { gap: spacing.xs, marginTop: spacing.xs },

  groups: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xxl },
  groupsWide: { flex: 1 },
  group: { gap: spacing.sm, paddingRight: spacing.lg },
  groupTitle: { ...type.caption, color: colors.textInverse, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32, alignSelf: 'flex-start' },
  footerLinkText: { ...type.body, fontSize: 16, color: colors.textInverseMuted },
  footerLinkHovered: { color: colors.primary, textDecorationLine: 'underline' },

  bottom: {
    marginTop: 56,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(244, 246, 248, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  bottomStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  copyright: { ...type.small, color: colors.textInverseMuted },
  bottomLinks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg },
  langSwitch: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  langOption: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  langOptionOn: { backgroundColor: 'rgba(255, 159, 0, 0.16)' },
  langText: { ...type.smallMedium, color: colors.textInverseMuted },
  langTextOn: { color: colors.primary },

  credit: { ...type.small, fontSize: 12, lineHeight: 17, color: colors.textInverseMuted, textAlign: 'center', marginTop: spacing.xl },
  creditLink: { color: colors.textInverse, textDecorationLine: 'underline' },
}));

export default PublicFooter;
