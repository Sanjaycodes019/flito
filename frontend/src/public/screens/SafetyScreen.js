import React, { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Icon from '../../theme/icons';
import { colors, palettes, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import CtaBand from '../components/CtaBand';
import SiteButton from '../components/SiteButton';
import { SegmentTabs } from '../components/Steps';
import { Section, SectionHeader, FeatureCard, CheckList, SiteCard, Columns } from '../components/Blocks';
import { useContent } from '../content';
import useOpenPage from '../useOpenPage';
import useSiteStyle from '../siteStyle';

const ROLES = [
  { key: 'shipper', icon: 'shipper' },
  { key: 'owner', icon: 'owner' },
  { key: 'driver', icon: 'driver' },
];

// The Nepali page writes the numbers in Devanagari; a phone dials ASCII digits.
const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const toDialable = (number) => String(number).replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));

const EmergencyNumber = ({ item, callLabel }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={() => Linking.openURL(`tel:${toDialable(item.number)}`).catch(() => {})}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityLabel={`${item.label}, ${callLabel}`}
      style={[styles.emergency, hovered && styles.emergencyHovered]}
    >
      <View style={styles.emergencyIcon}>
        <Icon name={item.icon} size={iconSize.lg} color={colors.errorText} />
      </View>
      <View style={styles.flexOne}>
        <Text style={styles.emergencyNumber}>{item.number}</Text>
        <Text style={styles.emergencyLabel}>{item.label}</Text>
      </View>
      <Icon name="phone" size={iconSize.md} color={colors.errorText} />
    </Pressable>
  );
};

// What FLITO checks and records so strangers can trust each other with goods
// and trucks, how to keep an account safe, good practice for each role, what
// may never be carried, and who to call when something goes wrong.
const SafetyScreen = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const { openPage } = useOpenPage();
  const [role, setRole] = useState('shipper');
  const side = site.isDesktop;

  return (
    <PublicLayout pageKey="safety">
      <PageHero eyebrow={t('site:safety.hero.eyebrow')} eyebrowIcon="verified" title={t('site:safety.hero.title')} lead={t('site:safety.hero.lead')} />

      <Section>
        <Columns columns={site.isDesktop ? 3 : site.isTablet ? 2 : 1}>
          {list('site:safety.pillars').map((pillar, index) => (
            <FeatureCard key={pillar.title} icon={pillar.icon} tint={index % 2 ? 'teal' : 'amber'} title={pillar.title} body={pillar.body} />
          ))}
        </Columns>
      </Section>

      <Section tone="dark">
        <View style={[styles.split, side && styles.splitSide]}>
          <View style={styles.flexOne}>
            <SectionHeader eyebrow={t('site:safety.account.eyebrow')} eyebrowIcon="lock" title={t('site:safety.account.title')} style={styles.tightHeader} />
            <CheckList items={list('site:safety.account.points')} icon="lockCheck" />
          </View>
          <View style={styles.flexOne}>
            <SectionHeader eyebrow={t('site:safety.prohibited.eyebrow')} eyebrowIcon="prohibited" title={t('site:safety.prohibited.title')} lead={t('site:safety.prohibited.lead')} style={styles.tightHeader} />
            <View style={styles.banned}>
              {list('site:safety.prohibited.items').map((item) => (
                <View key={item} style={styles.bannedRow}>
                  <Icon name="prohibited" size={iconSize.md} color={palettes.dark.errorText} />
                  <Text style={styles.bannedText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Section>

      <Section eyebrow={t('site:safety.tips.eyebrow')} eyebrowIcon="idea" title={t('site:safety.tips.title')}>
        <SegmentTabs
          label={t('site:landing.how.tabsLabel')}
          value={role}
          onChange={setRole}
          tabs={ROLES.map((r) => ({ key: r.key, icon: r.icon, label: t(`site:roles.${r.key}.label`) }))}
        />
        <SiteCard>
          <CheckList items={list(`site:safety.tips.${role}`)} />
        </SiteCard>
      </Section>

      <Section tone="surface">
        <View style={[styles.split, side && styles.splitSide]}>
          <View style={styles.flexOne}>
            <SectionHeader title={t('site:safety.emergency.title')} lead={t('site:safety.emergency.lead')} style={styles.tightHeader} />
            <Columns columns={site.isPhone ? 1 : 2} gap={spacing.md}>
              {list('site:safety.emergency.numbers').map((item) => (
                <EmergencyNumber key={item.label} item={item} callLabel={t('site:safety.emergency.call', { number: item.number })} />
              ))}
            </Columns>
          </View>
          <SiteCard style={[styles.report, side && styles.reportSide]}>
            <Icon name="report" size={iconSize.xl} color={colors.primaryText} />
            <Text style={styles.reportTitle}>{t('site:safety.report.title')}</Text>
            <Text style={styles.reportBody}>{t('site:safety.report.body')}</Text>
            <SiteButton title={t('site:safety.report.button')} icon="chat" size="md" onPress={() => openPage('contact')} style={styles.reportButton} />
          </SiteCard>
        </View>
      </Section>

      <CtaBand />
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  flexOne: { flex: 1, minWidth: 0 },
  split: { gap: spacing.huge },
  splitSide: { flexDirection: 'row', alignItems: 'flex-start', gap: 64 },
  tightHeader: { marginBottom: spacing.xxl },
  banned: { gap: spacing.md },
  bannedRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  bannedText: { ...type.bodyLarge, color: colors.textInverse, flex: 1 },

  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  emergencyHovered: { borderColor: colors.errorText, backgroundColor: colors.errorMuted },
  emergencyIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.errorMuted, alignItems: 'center', justifyContent: 'center' },
  emergencyNumber: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.textPrimary },
  emergencyLabel: { ...type.small, color: colors.textSecondary },

  report: { gap: spacing.md },
  reportSide: { width: 380 },
  reportTitle: { ...type.h2, color: colors.textPrimary },
  reportBody: { ...type.body, color: colors.textSecondary },
  reportButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
}));

export default SafetyScreen;
