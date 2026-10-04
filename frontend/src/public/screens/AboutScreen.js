import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import CtaBand from '../components/CtaBand';
import SiteButton from '../components/SiteButton';
import {
  Section, SectionHeader, FeatureCard, IconTile, SiteCard, CheckList, Paragraph, Heading, Columns,
} from '../components/Blocks';
import { useContent } from '../content';
import useOpenPage from '../useOpenPage';
import useSiteStyle from '../siteStyle';

const ROLE_KEYS = [
  { key: 'shipper', icon: 'shipper' },
  { key: 'owner', icon: 'owner' },
  { key: 'driver', icon: 'driver' },
];

// Who FLITO is: what the platform does (and doesn't), who it serves, what we
// value, and an honest note on what works today and what is still to come.
const AboutScreen = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const { openPage } = useOpenPage();
  const side = site.isDesktop;

  return (
    <PublicLayout pageKey="about">
      <PageHero
        eyebrow={t('site:about.hero.eyebrow')}
        eyebrowIcon="flag"
        title={t('site:about.hero.title')}
        lead={t('site:about.hero.lead')}
      />

      <Section>
        <View style={[styles.split, side && styles.splitSide]}>
          <View style={styles.flexTwo}>
            <Heading level={2}>{t('site:about.what.title')}</Heading>
            <View style={styles.paragraphs}>
              {list('site:about.what.body').map((p) => <Paragraph key={p} large>{p}</Paragraph>)}
            </View>
          </View>
          <SiteCard style={[styles.nameCard, side && styles.flexOne]}>
            <IconTile icon="idea" tint="teal" />
            <Text style={styles.nameTitle}>{t('site:about.name.title')}</Text>
            <View style={styles.acronym}>
              {['F', 'L', 'I', 'T', 'O'].map((letter) => (
                <View key={letter} style={styles.letter}><Text style={styles.letterText}>{letter}</Text></View>
              ))}
            </View>
            <Text style={styles.nameBody}>{t('site:about.name.body')}</Text>
          </SiteCard>
        </View>
      </Section>

      <Section tone="surface" eyebrow={t('site:about.who.eyebrow')} eyebrowIcon="people" title={t('site:about.who.title')}>
        <Columns columns={site.isDesktop ? 3 : 1}>
          {ROLE_KEYS.map((role) => (
            <FeatureCard
              key={role.key}
              icon={role.icon}
              title={t(`site:roles.${role.key}.label`)}
              body={t(`site:about.roles.${role.key}`)}
            />
          ))}
        </Columns>
      </Section>

      <Section eyebrow={t('site:about.values.eyebrow')} eyebrowIcon="care" title={t('site:about.values.title')}>
        <Columns columns={site.isDesktop ? 4 : site.isTablet ? 2 : 1}>
          {list('site:about.values.items').map((value, index) => (
            <FeatureCard key={value.title} icon={value.icon} tint={index % 2 ? 'teal' : 'amber'} title={value.title} body={value.body} />
          ))}
        </Columns>
      </Section>

      <Section tone="dark">
        <SectionHeader
          eyebrow={t('site:about.status.eyebrow')}
          eyebrowIcon="road"
          title={t('site:about.status.title')}
          lead={t('site:about.status.lead')}
        />
        <View style={[styles.statusCols, !site.isPhone && styles.statusColsSide]}>
          <SiteCard style={styles.flexOne}>
            <Text style={styles.statusTitle}>{t('site:about.status.nowTitle')}</Text>
            <CheckList items={list('site:about.status.now')} dense />
          </SiteCard>
          <SiteCard style={styles.flexOne}>
            <Text style={styles.statusTitle}>{t('site:about.status.nextTitle')}</Text>
            <CheckList items={list('site:about.status.next')} icon="timer" tint="amber" dense />
          </SiteCard>
        </View>
        <View style={[styles.links, site.isPhone && styles.linksStacked]}>
          <SiteButton title={t('site:about.links.mission')} icon="mission" onPress={() => openPage('mission')} />
          <SiteButton title={t('site:about.links.contact')} icon="chat" variant="outlineLight" onPress={() => openPage('contact')} />
        </View>
      </Section>

      <CtaBand />
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  split: { gap: spacing.xxl },
  splitSide: { flexDirection: 'row', alignItems: 'flex-start', gap: 64 },
  flexOne: { flex: 1 },
  flexTwo: { flex: 1.6 },
  paragraphs: { gap: spacing.lg, marginTop: spacing.lg },
  nameCard: { gap: spacing.md },
  nameTitle: { ...type.h3, color: colors.textPrimary },
  acronym: { flexDirection: 'row', gap: spacing.xs },
  letter: { width: 40, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 22, fontWeight: '800', color: colors.textOnPrimary },
  nameBody: { ...type.body, color: colors.textSecondary },
  statusCols: { gap: spacing.lg },
  statusColsSide: { flexDirection: 'row' },
  statusTitle: { ...type.h3, color: colors.textInverse, marginBottom: spacing.lg },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.huge },
  linksStacked: { flexDirection: 'column', alignItems: 'stretch' },
}));

export default AboutScreen;
