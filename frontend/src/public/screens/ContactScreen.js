import React from 'react';
import { View, Text, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../../utils/constants';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import SiteButton from '../components/SiteButton';
import { Section, SiteCard, IconTile, Columns } from '../components/Blocks';
import { useContent } from '../content';
import useOpenPage from '../useOpenPage';
import useSiteStyle from '../siteStyle';

const Channel = ({ icon, tint, title, body, action }) => (
  <SiteCard style={styles.channel}>
    <IconTile icon={icon} tint={tint} />
    <Text style={styles.channelTitle}>{title}</Text>
    <Text style={styles.channelBody}>{body}</Text>
    {action ? <View style={styles.channelAction}>{action}</View> : null}
  </SiteCard>
);

// Real ways to reach the team. Phone and email show only when they are set
// (EXPO_PUBLIC_SUPPORT_PHONE / EXPO_PUBLIC_SUPPORT_EMAIL), so the page never
// lists an address nobody reads; there is no form that would go nowhere.
const ContactScreen = () => {
  const { t, list } = useContent();
  const { i18n } = useTranslation();
  const site = useSiteStyle();
  const { openPage, signedIn } = useOpenPage();
  const subject = encodeURIComponent(t('site:contact.subjects.general'));

  const channels = [
    SUPPORT_PHONE && (
      <Channel
        key="phone"
        icon="phone"
        title={t('site:contact.channels.phone.title')}
        body={t('site:contact.channels.phone.body')}
        action={<SiteButton size="md" icon="phone" title={t('site:contact.channels.phone.button', { phone: SUPPORT_PHONE })} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})} />}
      />
    ),
    SUPPORT_EMAIL && (
      <Channel
        key="email"
        icon="email"
        tint="teal"
        title={t('site:contact.channels.email.title')}
        body={t('site:contact.channels.email.body')}
        action={<SiteButton size="md" icon="email" variant="outline" title={t('site:contact.channels.email.button', { email: SUPPORT_EMAIL })} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {})} />}
      />
    ),
    <Channel
      key="help"
      icon="help"
      title={t('site:contact.channels.help.title')}
      body={t('site:contact.channels.help.body')}
      action={<SiteButton size="md" variant="outline" iconRight="arrowRight" title={t('site:contact.channels.help.button')} onPress={() => openPage('help')} />}
    />,
    !signedIn && <Channel key="app" icon="devices" tint="teal" title={t('site:contact.channels.app.title')} body={t('site:contact.channels.app.body')} />,
  ].filter(Boolean);

  return (
    <PublicLayout pageKey="contact">
      <PageHero eyebrow={t('site:contact.hero.eyebrow')} eyebrowIcon="chat" title={t('site:contact.hero.title')} lead={t('site:contact.hero.lead')} />

      <Section>
        {!SUPPORT_PHONE && !SUPPORT_EMAIL ? (
          <View style={styles.notice}>
            <Icon name="info" size={iconSize.md} color={colors.infoText} />
            <Text style={styles.noticeText}>{t('site:contact.noDirect')}</Text>
          </View>
        ) : null}
        <Columns columns={site.isDesktop ? Math.min(channels.length, 3) : site.isTablet ? 2 : 1}>{channels}</Columns>
      </Section>

      <Section tone="surface" title={t('site:contact.topics.title')}>
        <Columns columns={site.isDesktop ? 3 : site.isTablet ? 2 : 1} gap={spacing.md}>
          {list('site:contact.topics.items').map((item) => (
            <View key={item.title} style={styles.topic}>
              <IconTile icon={item.icon} size={40} />
              <View style={styles.flexOne}>
                <Text style={styles.topicTitle}>{item.title}</Text>
                <Text style={styles.topicBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </Columns>

        <View style={[styles.footRow, !site.isPhone && styles.footRowSide]}>
          <View style={styles.flexOne}>
            <Text style={styles.topicTitle}>{t('site:contact.hours.title')}</Text>
            {list('site:contact.hours.lines').map((line) => <Text key={line} style={styles.topicBody}>{line}</Text>)}
          </View>
          <View style={[styles.emergency, styles.flexOne]}>
            <Icon name="emergency" size={iconSize.lg} color={colors.errorText} />
            <Text style={[styles.topicBody, styles.flexOne]} lang={i18n.language}>{t('site:contact.emergency')}</Text>
          </View>
        </View>
      </Section>
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  flexOne: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.infoMuted, marginBottom: spacing.xxl },
  noticeText: { ...type.body, color: colors.textPrimary, flex: 1 },
  channel: { flex: 1, gap: spacing.md },
  channelTitle: { ...type.h3, color: colors.textPrimary },
  channelBody: { ...type.body, color: colors.textSecondary, flex: 1 },
  channelAction: { marginTop: spacing.sm, alignItems: 'flex-start' },
  topic: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.background },
  topicTitle: { ...type.bodyMedium, color: colors.textPrimary },
  topicBody: { ...type.body, color: colors.textSecondary, marginTop: 2 },
  footRow: { gap: spacing.xl, marginTop: spacing.huge },
  footRowSide: { flexDirection: 'row' },
  emergency: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.errorMuted },
}));

export default ContactScreen;
