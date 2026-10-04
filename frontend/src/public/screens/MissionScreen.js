import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import CtaBand from '../components/CtaBand';
import { Section, SectionHeader, FeatureCard, Paragraph, Columns, SiteCard, IconTile } from '../components/Blocks';
import { useContent } from '../content';
import useSiteStyle, { READING_WIDTH } from '../siteStyle';

// Why FLITO exists: the empty return trip, told as the story of a truck yard,
// who pays for it, what changes when the return is full, and what we promise.
const MissionScreen = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();

  return (
    <PublicLayout pageKey="mission">
      <PageHero
        eyebrow={t('site:mission.hero.eyebrow')}
        eyebrowIcon="mission"
        title={t('site:mission.hero.title')}
        lead={t('site:mission.hero.lead')}
      />

      <Section width={READING_WIDTH}>
        <SectionHeader eyebrow={t('site:mission.story.eyebrow')} eyebrowIcon="story" title={t('site:mission.story.title')} />
        <View style={styles.story}>
          {list('site:mission.story.paragraphs').map((p, index) => (
            <Paragraph key={p} large style={index === 0 ? styles.firstParagraph : null}>{p}</Paragraph>
          ))}
        </View>
        <View style={[styles.quote, site.isPhone && styles.quotePhone]}>
          <Icon name="quoteMark" size={iconSize.xxl} color={colors.primary} />
          <Text style={[styles.quoteText, { fontSize: site.isPhone ? 22 : 27, lineHeight: site.isPhone ? 32 : 40 }]}>{t('site:mission.quote')}</Text>
        </View>
      </Section>

      <Section tone="surface" eyebrow={t('site:mission.problems.eyebrow')} eyebrowIcon="emptyReturn" title={t('site:mission.problems.title')}>
        <Columns columns={site.isDesktop ? 3 : 1}>
          {list('site:mission.problems.items').map((item) => (
            <FeatureCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
          ))}
        </Columns>
      </Section>

      <Section eyebrow={t('site:mission.change.eyebrow')} eyebrowIcon="truckBooked" title={t('site:mission.change.title')}>
        <Columns columns={site.isPhone ? 1 : 2}>
          {list('site:mission.change.items').map((item, index) => (
            <SiteCard key={item.title} style={styles.change}>
              <IconTile icon={item.icon} tint={index % 2 ? 'teal' : 'amber'} />
              <View style={styles.changeText}>
                <Text style={styles.changeTitle}>{item.title}</Text>
                <Text style={styles.changeBody}>{item.body}</Text>
              </View>
            </SiteCard>
          ))}
        </Columns>
      </Section>

      <Section tone="dark" eyebrow={t('site:mission.commitments.eyebrow')} eyebrowIcon="handshake" title={t('site:mission.commitments.title')}>
        <View style={styles.commitments}>
          {list('site:mission.commitments.items').map((item, index) => (
            <View key={item} style={styles.commitment}>
              <Text style={styles.commitmentNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.commitmentText}>{item}</Text>
            </View>
          ))}
        </View>
      </Section>

      <CtaBand />
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  story: { gap: spacing.xl },
  firstParagraph: { color: colors.textPrimary },
  quote: {
    marginTop: spacing.huge,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryMuted,
    gap: spacing.sm,
  },
  quotePhone: { paddingHorizontal: spacing.lg },
  quoteText: { fontWeight: '700', color: colors.textPrimary },
  change: { flex: 1, flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  changeText: { flex: 1, minWidth: 0 },
  changeTitle: { ...type.h3, color: colors.textPrimary },
  changeBody: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
  commitments: { gap: 0 },
  commitment: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(244, 246, 248, 0.12)',
  },
  commitmentNumber: { fontSize: 22, lineHeight: 30, fontWeight: '800', color: colors.primary, width: 40 },
  commitmentText: { ...type.bodyLarge, fontSize: 19, lineHeight: 30, color: colors.textInverse, flex: 1 },
}));

export default MissionScreen;
