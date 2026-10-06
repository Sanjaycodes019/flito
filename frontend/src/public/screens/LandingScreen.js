import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import PublicLayout from '../components/PublicLayout';
import RouteArt from '../components/RouteArt';
import HeroPreview from '../components/HeroPreview';
import SiteButton from '../components/SiteButton';
import CtaBand from '../components/CtaBand';
import FaqList from '../components/FaqList';
import { StepList, SegmentTabs } from '../components/Steps';
import {
  Container, Eyebrow, Section, SectionHeader, FeatureCard, IconTile, SiteCard, CheckList, TextLink, Columns, useTone,
} from '../components/Blocks';
import { useContent } from '../content';
import useOpenPage from '../useOpenPage';
import useSiteStyle from '../siteStyle';

const ROLES = [
  { key: 'shipper', icon: 'shipper' },
  { key: 'owner', icon: 'owner' },
  { key: 'driver', icon: 'driver' },
];

// The questions the landing page answers before anyone has to go looking,
// picked from the help center by topic and position.
const FAQ_PICKS = [['offers', 3], ['account', 0], ['offers', 0], ['trips', 0], ['payments', 0]];

const Hero = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const { openAuth } = useOpenPage();
  const side = site.isDesktop;

  return (
    <View style={[styles.hero, { paddingTop: site.isPhone ? spacing.huge : 72, paddingBottom: site.isPhone ? spacing.xxl : 72 }]}>
      {/* Stacked, the hero is tall and narrow: filling it would blow the art
          up until a route pin sits on the buttons, so it stays a band along
          the bottom at its own size. */}
      {side ? <RouteArt /> : <View style={styles.heroArtBand}><RouteArt /></View>}
      <Container>
        <View style={[styles.heroRow, side && styles.heroRowSide]}>
          <View style={[styles.heroCopy, side && styles.heroCopySide]}>
            <Eyebrow icon="flag" label={t('site:landing.hero.eyebrow')} style={styles.heroEyebrow} />
            <Text style={[site.hero, styles.heroTitle]} accessibilityRole="header" aria-level={1}>
              {site.isPhone ? t('site:landing.hero.title').replace('\n', ' ') : t('site:landing.hero.title')}
            </Text>
            <Text style={[site.lead, styles.heroLead]}>{t('site:landing.hero.lead')}</Text>

            <View style={[styles.heroActions, site.isPhone && styles.heroActionsStacked]}>
              <SiteButton title={t('site:landing.hero.shipper')} icon="load" onPress={() => openAuth('Signup', { role: 'shipper' })} />
              <SiteButton title={t('site:landing.hero.owner')} icon="truck" variant="outline" onPress={() => openAuth('Signup', { role: 'owner' })} />
            </View>
            <TextLink label={t('site:landing.hero.driver')} icon="arrowRight" onPress={() => openAuth('PinLogin')} style={styles.driverLink} />

            <View style={styles.trustRow}>
              {list('site:landing.hero.trust').map((item) => (
                <View key={item} style={styles.trustItem}>
                  <Icon name="success" size={iconSize.sm} color={colors.accentText} />
                  <Text style={styles.trustText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.heroVisual, side && styles.heroVisualSide]}>
            <HeroPreview />
          </View>
        </View>
      </Container>
    </View>
  );
};

const Problem = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const side = site.isDesktop;
  return (
    <Section>
      <View style={[styles.split, side && styles.splitSide]}>
        <View style={side ? styles.splitText : null}>
          <SectionHeader
            eyebrow={t('site:landing.problem.eyebrow')}
            eyebrowIcon="emptyReturn"
            title={t('site:landing.problem.title')}
            lead={t('site:landing.problem.lead')}
          />
          <View style={styles.answer}>
            <Text style={styles.answerTitle}>{t('site:landing.problem.answerTitle')}</Text>
            <Text style={styles.answerBody}>{t('site:landing.problem.answer')}</Text>
          </View>
        </View>
        <View style={[styles.problemCards, side && styles.splitCards]}>
          {list('site:landing.problem.cards').map((card, index) => (
            <SiteCard key={card.title} style={styles.problemCard}>
              <IconTile icon={card.icon} tint={index === 2 ? 'teal' : 'amber'} />
              <View style={styles.problemText}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardBody}>{card.body}</Text>
              </View>
            </SiteCard>
          ))}
        </View>
      </View>
    </Section>
  );
};

const HowItWorks = () => {
  const { t, list } = useContent();
  const { openPage } = useOpenPage();
  const [role, setRole] = useState('shipper');
  return (
    <Section tone="surface" eyebrow={t('site:landing.how.eyebrow')} eyebrowIcon="guide" title={t('site:landing.how.title')} lead={t('site:landing.how.lead')}>
      <SegmentTabs
        label={t('site:landing.how.tabsLabel')}
        value={role}
        onChange={setRole}
        tabs={ROLES.map((r) => ({ key: r.key, icon: r.icon, label: t(`site:roles.${r.key}.label`) }))}
      />
      <StepList steps={list(`site:roles.${role}.steps`)} />
      <TextLink label={t('site:landing.how.seeGuide')} onPress={() => openPage('howItWorks')} style={styles.sectionLink} />
    </Section>
  );
};

const Features = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const columns = site.isDesktop ? 4 : site.isTablet ? 2 : 1;
  return (
    <Section eyebrow={t('site:landing.features.eyebrow')} eyebrowIcon="sparkle" title={t('site:landing.features.title')} lead={t('site:landing.features.lead')} align="center">
      <Columns columns={columns}>
        {list('site:landing.features.items').map((item, index) => (
          <FeatureCard key={item.title} icon={item.icon} tint={index % 3 === 1 ? 'teal' : 'amber'} title={item.title} body={item.body} />
        ))}
      </Columns>
    </Section>
  );
};

const Fact = ({ value, label }) => {
  const tone = useTone();
  const site = useSiteStyle();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factValue, { color: colors.primary, fontSize: site.isPhone ? 32 : 44, lineHeight: site.isPhone ? 40 : 52 }]}>{value}</Text>
      <Text style={[styles.factLabel, { color: tone.body }]}>{label}</Text>
    </View>
  );
};

const BuiltForNepal = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  return (
    <Section tone="dark" style={styles.clip} eyebrow={t('site:landing.nepal.eyebrow')} eyebrowIcon="mountain" title={t('site:landing.nepal.title')} lead={t('site:landing.nepal.lead')}>
      <View style={styles.darkArt}><RouteArt variant="dark" /></View>
      <Columns columns={site.isPhone ? 2 : 4} gap={spacing.xl}>
        {list('site:landing.nepal.facts').map((fact) => <Fact key={fact.label} value={fact.value} label={fact.label} />)}
      </Columns>
      <View style={[styles.nepalLists, site.isDesktop && styles.nepalListsSide]}>
        <View style={[styles.nepalCol, site.isDesktop && styles.nepalColSide]}>
          <Text style={styles.darkSubhead}>{t('site:landing.nepal.routesTitle')}</Text>
          <CheckList items={list('site:landing.nepal.routes')} icon="road" dense />
        </View>
        <View style={[styles.nepalCol, site.isDesktop && styles.nepalColSide]}>
          <Text style={styles.darkSubhead}>{t('site:landing.nepal.hubsTitle')}</Text>
          <View style={styles.hubs}>
            {list('site:landing.nepal.hubs').map((hub) => (
              <View key={hub} style={styles.hub}>
                <Icon name="pickup" size={iconSize.sm} color={colors.primary} />
                <Text style={styles.hubText}>{hub}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Section>
  );
};

const Stories = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  return (
    <Section tone="surface" eyebrow={t('site:landing.stories.eyebrow')} eyebrowIcon="story" title={t('site:landing.stories.title')} lead={t('site:landing.stories.lead')}>
      <Columns columns={site.isDesktop ? 3 : 1}>
        {list('site:landing.stories.items').map((story) => (
          <SiteCard key={story.title} style={styles.story}>
            <View style={styles.storyHead}>
              <IconTile icon={story.icon} size={40} />
              <Icon name="quoteMark" size={iconSize.xl} color={colors.primaryMuted} />
            </View>
            <Text style={styles.storyTag}>{story.tag}</Text>
            <Text style={styles.cardTitle}>{story.title}</Text>
            <Text style={styles.cardBody}>{story.body}</Text>
          </SiteCard>
        ))}
      </Columns>
      <View style={styles.storyNote}>
        <Icon name="info" size={iconSize.sm} color={colors.textMuted} />
        <Text style={styles.storyNoteText}>{t('site:landing.stories.note')}</Text>
      </View>
    </Section>
  );
};

// A drawing of a verified profile, beside the trust points.
const VerifiedMock = () => {
  const { t } = useContent();
  const rows = [
    { icon: 'idCard', label: t('kyc:idTypes.citizenship', 'Citizenship') },
    { icon: 'document', label: t('kyc:documents.pan', 'PAN') },
    { icon: 'truck', label: t('trucks:documents.bluebook', 'Bluebook') },
  ];
  return (
    <SiteCard style={styles.mock}>
      <View style={styles.mockHead}>
        <View style={styles.mockAvatar}><Icon name="owner" size={iconSize.lg} color={colors.textSecondary} /></View>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{t('site:roles.owner.label')}</Text>
          <View style={styles.mockStars}>
            {[0, 1, 2, 3, 4].map((i) => <Icon key={i} name={i < 4 ? 'star' : 'starOutline'} size={iconSize.sm} color={colors.primary} />)}
          </View>
        </View>
        <View style={styles.badge}>
          <Icon name="verified" size={iconSize.sm} color={colors.accentText} />
          <Text style={styles.badgeText}>{t('profile:rows.verified')}</Text>
        </View>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.mockRow}>
          <Icon name={row.icon} size={iconSize.md} color={colors.textSecondary} />
          <Text style={styles.mockRowText}>{row.label}</Text>
          <Icon name="success" size={iconSize.md} color={colors.accentText} />
        </View>
      ))}
    </SiteCard>
  );
};

const Trust = () => {
  const { t, list } = useContent();
  const { openPage } = useOpenPage();
  const site = useSiteStyle();
  const side = site.isDesktop;
  return (
    <Section>
      <View style={[styles.split, side && styles.splitSide]}>
        <View style={side ? styles.splitText : null}>
          <SectionHeader eyebrow={t('site:landing.trust.eyebrow')} eyebrowIcon="verified" title={t('site:landing.trust.title')} lead={t('site:landing.trust.lead')} style={styles.headerTight} />
          <CheckList items={list('site:landing.trust.points')} />
          <TextLink label={t('site:landing.trust.link')} onPress={() => openPage('safety')} style={styles.sectionLink} />
        </View>
        <View style={[side ? styles.splitCards : styles.mockStacked]}>
          <VerifiedMock />
        </View>
      </View>
    </Section>
  );
};

const Faq = () => {
  const { t, list } = useContent();
  const { openPage } = useOpenPage();
  const topics = list('site:help.topics');
  const items = FAQ_PICKS
    .map(([key, index]) => topics.find((topic) => topic.key === key)?.items?.[index])
    .filter(Boolean);
  return (
    <Section tone="surface" eyebrow={t('site:landing.faq.eyebrow')} eyebrowIcon="faq" title={t('site:landing.faq.title')} align="center" width={820}>
      <FaqList items={items} defaultOpenFirst />
      <TextLink label={t('site:landing.faq.link')} onPress={() => openPage('help')} style={[styles.sectionLink, styles.centreLink]} />
    </Section>
  );
};

// The public front door at /, for visitors who are not signed in. Signed in,
// / is the dashboard instead (HomeScreen).
const LandingScreen = () => {
  const { t } = useContent();
  return (
    <PublicLayout pageKey="landing">
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <BuiltForNepal />
      <Stories />
      <Trust />
      <Faq />
      <CtaBand title={t('site:landing.cta.title')} lead={t('site:landing.cta.lead')} />
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  flexOne: { flex: 1, minWidth: 0 },
  // The background art runs past the band's edges; clipping it keeps the page
  // from scrolling sideways.
  clip: { overflow: 'hidden' },
  hero: { backgroundColor: colors.surface, overflow: 'hidden' },
  heroArtBand: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 420 },
  heroRow: { gap: spacing.xxl },
  heroRowSide: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  heroCopy: { maxWidth: 720 },
  heroCopySide: { flex: 1.15 },
  heroEyebrow: { marginBottom: spacing.xl },
  heroTitle: { color: colors.textPrimary },
  heroLead: { color: colors.textSecondary, marginTop: spacing.xl, maxWidth: 620 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xxxl },
  heroActionsStacked: { flexDirection: 'column', alignItems: 'stretch' },
  driverLink: { marginTop: spacing.lg },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xxl },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  trustText: { ...type.smallMedium, color: colors.textSecondary },
  heroVisual: { width: '100%' },
  heroVisualSide: { flex: 1, width: undefined },

  split: { gap: spacing.xxl },
  splitSide: { flexDirection: 'row', alignItems: 'flex-start', gap: 64 },
  splitText: { flex: 1 },
  splitCards: { flex: 1, paddingTop: spacing.sm },
  headerTight: { marginBottom: spacing.xxl },
  answer: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.xs,
  },
  answerTitle: { ...type.h3, color: colors.textPrimary },
  answerBody: { ...type.bodyLarge, color: colors.textSecondary, marginTop: spacing.xs },
  problemCards: { gap: spacing.lg },
  problemCard: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  problemText: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.h3, color: colors.textPrimary },
  cardBody: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },

  sectionLink: { marginTop: spacing.xxl },
  centreLink: { alignSelf: 'center' },

  darkArt: { position: 'absolute', top: -200, right: -40, width: 900, height: 420, opacity: 0.5 },
  fact: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: 2, borderTopColor: 'rgba(255, 159, 0, 0.4)' },
  factValue: { fontWeight: '800', letterSpacing: -0.5 },
  factLabel: { ...type.body },
  nepalLists: { marginTop: 56, gap: spacing.huge },
  nepalListsSide: { flexDirection: 'row', gap: 64 },
  nepalCol: { gap: spacing.lg },
  // Only side by side: stacked, flex's zero basis lets a column shrink below
  // its content, so the next heading runs over it.
  nepalColSide: { flex: 1 },
  darkSubhead: { ...type.h3, color: colors.textInverse },
  hubs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(244, 246, 248, 0.16)',
    backgroundColor: 'rgba(244, 246, 248, 0.04)',
  },
  hubText: { ...type.bodyMedium, color: colors.textInverse },

  story: { flex: 1, gap: spacing.sm },
  storyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  storyTag: { ...type.caption, color: colors.primaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
  storyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  storyNoteText: { ...type.small, color: colors.textMuted, flex: 1 },

  mock: { gap: spacing.md, maxWidth: 460, width: '100%', alignSelf: 'center' },
  mockStacked: { marginTop: spacing.md },
  mockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  mockAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  mockStars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentMuted },
  badgeText: { ...type.caption, color: colors.accentText },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  mockRowText: { ...type.bodyMedium, color: colors.textPrimary, flex: 1 },
}));

export default LandingScreen;
