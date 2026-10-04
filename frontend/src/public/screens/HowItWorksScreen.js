import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Icon from '../../theme/icons';
import StatusBadge from '../../components/common/StatusBadge';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import CtaBand from '../components/CtaBand';
import { StepList, SegmentTabs } from '../components/Steps';
import { Section, SiteCard, CheckList, IconTile, Columns } from '../components/Blocks';
import { useContent } from '../content';
import useSiteStyle from '../siteStyle';

const ROLES = [
  { key: 'shipper', icon: 'shipper' },
  { key: 'owner', icon: 'owner' },
  { key: 'driver', icon: 'driver' },
];

// The full guide: each role's steps and what they need, a booking's statuses
// in the order they happen, how prices are agreed, and when a booking can be
// cancelled. All of it mirrors the app's real rules (see backend kycPolicy,
// expiry and bookingsController).
const HowItWorksScreen = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const route = useRoute();
  const initial = ROLES.some((r) => r.key === route.params?.role) ? route.params.role : 'shipper';
  const [role, setRole] = useState(initial);
  const side = site.isDesktop;
  const lifecycle = list('site:howItWorks.lifecycle.items');

  return (
    <PublicLayout pageKey="howItWorks">
      <PageHero eyebrow={t('site:howItWorks.hero.eyebrow')} eyebrowIcon="guide" title={t('site:howItWorks.hero.title')} lead={t('site:howItWorks.hero.lead')} />

      <Section>
        <SegmentTabs
          label={t('site:landing.how.tabsLabel')}
          value={role}
          onChange={setRole}
          tabs={ROLES.map((r) => ({ key: r.key, icon: r.icon, label: t(`site:roles.${r.key}.label`) }))}
        />
        <View style={[styles.roleRow, side && styles.roleRowSide]}>
          <View style={styles.steps}>
            <Text style={styles.roleTagline}>{t(`site:roles.${role}.tagline`)}</Text>
            <StepList steps={list(`site:roles.${role}.steps`)} columns={1} />
          </View>
          <SiteCard style={[styles.needs, side && styles.needsSide]}>
            <View style={styles.needsHead}>
              <IconTile icon="checklist" tint="teal" size={40} />
              <Text style={styles.needsTitle}>{t('site:howItWorks.needTitle')}</Text>
            </View>
            <CheckList items={list(`site:howItWorks.needs.${role}`)} dense />
          </SiteCard>
        </View>
      </Section>

      <Section tone="surface" eyebrow={t('site:howItWorks.lifecycle.eyebrow')} eyebrowIcon="history" title={t('site:howItWorks.lifecycle.title')} lead={t('site:howItWorks.lifecycle.lead')}>
        <View style={[styles.track, side && styles.trackSide]}>
          {lifecycle.map((item, index) => {
            const last = index === lifecycle.length - 1;
            const cancelled = item.status === 'cancelled';
            return (
              <View key={item.status} style={[styles.stage, side && styles.stageSide, cancelled && styles.stageCancelled]}>
                <View style={[styles.stageHead, side && styles.stageHeadSide]}>
                  <StatusBadge status={item.status} />
                  {side && !last && lifecycle[index + 1]?.status !== 'cancelled' ? (
                    <Icon name="forward" size={iconSize.md} color={colors.textMuted} style={styles.stageArrow} />
                  ) : null}
                </View>
                <Text style={styles.stageBody}>{item.body}</Text>
              </View>
            );
          })}
        </View>
      </Section>

      <Section eyebrow={t('site:howItWorks.offers.eyebrow')} eyebrowIcon="price" title={t('site:howItWorks.offers.title')} lead={t('site:howItWorks.offers.lead')}>
        <Columns columns={site.isDesktop ? 4 : site.isTablet ? 2 : 1}>
          {list('site:howItWorks.offers.points').map((point, index) => (
            <SiteCard key={point.title} style={styles.point}>
              <View style={styles.pointHead}>
                <IconTile icon={point.icon} tint={index % 2 ? 'teal' : 'amber'} size={44} />
                <Text style={styles.pointNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointBody}>{point.body}</Text>
            </SiteCard>
          ))}
        </Columns>

        <View style={styles.cancel}>
          <Icon name="warning" size={iconSize.lg} color={colors.warningText} />
          <View style={styles.cancelText}>
            <Text style={styles.cancelTitle}>{t('site:howItWorks.cancel.title')}</Text>
            <Text style={styles.cancelBody}>{t('site:howItWorks.cancel.body')}</Text>
          </View>
        </View>
      </Section>

      <CtaBand />
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  roleRow: { gap: spacing.xxl },
  roleRowSide: { flexDirection: 'row', alignItems: 'flex-start', gap: 64 },
  steps: { flex: 1 },
  roleTagline: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.xxl },
  needs: { gap: spacing.lg },
  needsSide: { width: 380 },
  needsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  needsTitle: { ...type.h3, color: colors.textPrimary },

  track: { gap: spacing.md },
  trackSide: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  stage: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stageSide: { flex: 1 },
  stageCancelled: { borderStyle: 'dashed', borderColor: colors.border },
  stageHead: { flexDirection: 'row', alignItems: 'center' },
  stageHeadSide: { justifyContent: 'space-between' },
  stageArrow: { marginRight: -spacing.xs },
  stageBody: { ...type.body, color: colors.textSecondary },

  point: { flex: 1, gap: spacing.sm },
  pointHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  pointNumber: { fontSize: 40, lineHeight: 44, fontWeight: '800', color: colors.primaryMuted },
  pointTitle: { ...type.h3, color: colors.textPrimary },
  pointBody: { ...type.body, color: colors.textSecondary },

  cancel: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
    marginTop: spacing.xxxl,
    padding: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.warningMuted,
  },
  cancelText: { flex: 1 },
  cancelTitle: { ...type.h3, color: colors.textPrimary },
  cancelBody: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
}));

export default HowItWorksScreen;
