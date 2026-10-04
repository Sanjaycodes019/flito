import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, iconSize, type, themedStyles } from '../../theme/tokens';
import useSiteStyle from '../siteStyle';
import { Container, Eyebrow } from './Blocks';
import RouteArt from './RouteArt';

// The top of an inner page: eyebrow, the page's one h1, a lead paragraph,
// optional facts (last updated, reading time) and actions, over the route art.
const PageHero = ({ eyebrow, eyebrowIcon, title, lead, meta = [], actions, children }) => {
  const site = useSiteStyle();
  return (
    <View style={[styles.band, { paddingTop: site.isPhone ? spacing.huge : 88, paddingBottom: site.isPhone ? spacing.huge : 80 }]}>
      <RouteArt style={site.isPhone ? styles.artPhone : null} />
      <Container>
        <View style={styles.copy}>
          {eyebrow ? <Eyebrow icon={eyebrowIcon} label={eyebrow} style={styles.eyebrow} /> : null}
          <Text style={[site.hero, styles.title]} accessibilityRole="header" aria-level={1}>{title}</Text>
          {lead ? <Text style={[site.lead, styles.lead]}>{lead}</Text> : null}
          {meta.length ? (
            <View style={styles.meta}>
              {meta.map((item) => (
                <View key={item.label} style={styles.metaItem}>
                  <Icon name={item.icon} size={iconSize.sm} color={colors.textMuted} />
                  <Text style={styles.metaText}>{item.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {actions ? <View style={[styles.actions, site.isPhone && styles.actionsStacked]}>{actions}</View> : null}
          {children}
        </View>
      </Container>
    </View>
  );
};

const styles = themedStyles(() => ({
  band: { backgroundColor: colors.surface, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.divider },
  artPhone: { opacity: 0.6 },
  copy: { maxWidth: 780 },
  eyebrow: { marginBottom: spacing.lg },
  title: { color: colors.textPrimary },
  lead: { color: colors.textSecondary, marginTop: spacing.lg, maxWidth: 680 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xl },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.small, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xxl },
  actionsStacked: { flexDirection: 'column', alignItems: 'stretch' },
}));

export default PageHero;
