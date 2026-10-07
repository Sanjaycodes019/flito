import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import CtaBand from '../components/CtaBand';
import { Section, SectionHeader, CheckList } from '../components/Blocks';
import { ShotRows, ShotViewer } from '../components/ShotGallery';
import { useContent } from '../content';
import useSiteStyle from '../siteStyle';
import { SHOTS } from '../gallery';

// Real screens of the app, by what they show: the trip on the map, the
// delivery and its invoice, finding trucks, the driver's job in Nepali, and
// fees and the admin console. Any screen opens full size, and the viewer steps
// through every screen on the page.
const GalleryScreen = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const [open, setOpen] = useState(null);
  const sections = list('site:gallery.sections').map((section) => ({
    ...section,
    shots: (section.shots || []).filter((key) => SHOTS[key]),
  }));
  const everyShot = sections.flatMap((section) => section.shots);

  return (
    <PublicLayout pageKey="gallery">
      <PageHero
        eyebrow={t('site:gallery.hero.eyebrow')}
        eyebrowIcon="gallery"
        title={t('site:gallery.hero.title')}
        lead={t('site:gallery.hero.lead')}
      >
        <View style={styles.note}>
          <Icon name="info" size={iconSize.sm} color={colors.textMuted} style={styles.noteIcon} />
          <Text style={styles.noteText}>{t('site:gallery.note')}</Text>
        </View>
      </PageHero>

      {sections.map((section, index) => (
        <Section key={section.key} tone={index % 2 ? 'surface' : 'plain'}>
          <View style={[styles.intro, site.isDesktop && styles.introSide]}>
            <SectionHeader
              eyebrow={section.eyebrow}
              eyebrowIcon={section.icon}
              title={section.title}
              lead={section.lead}
              style={[styles.header, site.isDesktop && styles.headerSide]}
            />
            {section.points?.length ? (
              <CheckList items={section.points} dense style={[styles.points, site.isDesktop && styles.pointsSide]} />
            ) : null}
          </View>
          <ShotRows keys={section.shots} onOpen={setOpen} />
        </Section>
      ))}

      <CtaBand />
      <ShotViewer keys={everyShot} current={open} onChange={setOpen} onClose={() => setOpen(null)} />
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    maxWidth: 680,
  },
  noteIcon: { marginTop: 2 },
  noteText: { ...type.small, color: colors.textSecondary, flex: 1 },
  intro: { marginBottom: spacing.xxl },
  introSide: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.huge },
  header: { marginBottom: spacing.lg },
  headerSide: { flex: 3, marginBottom: 0 },
  points: {},
  pointsSide: { flex: 2, paddingBottom: spacing.xs },
}));

export default GalleryScreen;
