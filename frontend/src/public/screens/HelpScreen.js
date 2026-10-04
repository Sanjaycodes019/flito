import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Icon from '../../theme/icons';
import { webInputReset } from '../../components/common/Input';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';
import PublicLayout, { usePageScroll } from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import FaqList from '../components/FaqList';
import SiteButton from '../components/SiteButton';
import { Container, IconTile } from '../components/Blocks';
import { useContent } from '../content';
import useOpenPage from '../useOpenPage';
import useSiteStyle from '../siteStyle';

// Case- and accent-blind enough for both scripts: Devanagari has no case, and
// lower-casing leaves it as it is.
const matches = (item, query) => {
  const text = `${item.q} ${[].concat(item.a).join(' ')}`.toLowerCase();
  return query.split(/\s+/).filter(Boolean).every((word) => text.includes(word));
};

const TopicChip = ({ label, icon, active, onPress }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={[styles.chip, hovered && !active && styles.chipHovered, active && styles.chipActive]}
    >
      {icon ? <Icon name={icon} size={iconSize.sm} color={active ? colors.textOnPrimary : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
};

// Every common question, grouped by topic, with a search that looks through
// questions and answers in the language being shown. /help?topic=offers opens
// on one topic.
const HelpScreen = () => {
  const { t, list } = useContent();
  const site = useSiteStyle();
  const route = useRoute();
  const scroll = usePageScroll();
  const { openPage } = useOpenPage();
  const resultsRef = useRef(null);
  const topics = list('site:help.topics');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState(() => (topics.some((tp) => tp.key === route.params?.topic) ? route.params.topic : 'all'));
  const [focused, setFocused] = useState(false);

  const trimmed = query.trim().toLowerCase();
  // A search looks through every topic; otherwise the chosen topic, or all.
  const groups = topics
    .filter((tp) => topic === 'all' || trimmed || tp.key === topic)
    .map((tp) => ({ ...tp, items: trimmed ? tp.items.filter((item) => matches(item, trimmed)) : tp.items }))
    .filter((tp) => tp.items.length);
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);

  const chooseTopic = (key) => {
    setTopic(key);
    setQuery('');
    scroll.scrollToNode(resultsRef.current);
  };

  return (
    <PublicLayout pageKey="help">
      <PageHero eyebrow={t('site:help.hero.eyebrow')} eyebrowIcon="help" title={t('site:help.hero.title')} lead={t('site:help.hero.lead')}>
        <View style={[styles.search, focused && styles.searchFocused]}>
          <Icon name="search" size={iconSize.lg} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('site:help.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('site:help.searchLabel')}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, webInputReset]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common:actions.clear')} hitSlop={8} style={styles.clear}>
              <Icon name="close" size={iconSize.md} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </PageHero>

      <Container style={{ paddingTop: site.isPhone ? spacing.xxl : 48, paddingBottom: site.sectionSpace }}>
        <View style={styles.chips} accessibilityRole="tablist">
          <TopicChip label={t('site:help.all')} icon="list" active={topic === 'all' && !trimmed} onPress={() => chooseTopic('all')} />
          {topics.map((tp) => (
            <TopicChip key={tp.key} label={tp.title} icon={tp.icon} active={topic === tp.key && !trimmed} onPress={() => chooseTopic(tp.key)} />
          ))}
        </View>

        <View ref={resultsRef} style={[styles.body, site.isDesktop && styles.bodySide]}>
          <View style={styles.results}>
            <Text style={styles.count} accessibilityLiveRegion="polite" aria-live="polite">
              {t('site:help.results', { count })}
            </Text>
            {groups.length ? groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <View style={styles.groupHead}>
                  <IconTile icon={group.icon} size={40} />
                  <Text style={styles.groupTitle} accessibilityRole="header" aria-level={2}>{group.title}</Text>
                </View>
                <FaqList items={group.items} defaultOpenFirst={Boolean(trimmed)} />
              </View>
            )) : (
              <View style={styles.empty}>
                <Icon name="empty" size={iconSize.xxl} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('site:help.noResults', { query: query.trim() })}</Text>
              </View>
            )}
          </View>

          <View style={[styles.aside, site.isDesktop && styles.asideSide]}>
            <View style={styles.stillNeed}>
              <IconTile icon="chat" tint="dark" />
              <Text style={styles.stillTitle}>{t('site:help.stillNeed.title')}</Text>
              <Text style={styles.stillBody}>{t('site:help.stillNeed.body')}</Text>
              <SiteButton title={t('site:help.stillNeed.button')} variant="dark" size="md" iconRight="arrowRight" onPress={() => openPage('contact')} />
            </View>
          </View>
        </View>
      </Container>
    </PublicLayout>
  );
};

const styles = themedStyles(() => ({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 60,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    maxWidth: 640,
    ...shadow.level1,
  },
  searchFocused: { borderColor: colors.focusRing, borderWidth: 2 },
  searchInput: { flex: 1, height: '100%', ...type.bodyLarge, color: colors.textPrimary },
  clear: { padding: spacing.xs },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xxxl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipHovered: { borderColor: colors.primaryText },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.smallMedium, color: colors.textSecondary },
  chipTextActive: { color: colors.textOnPrimary },

  body: { gap: spacing.huge },
  bodySide: { flexDirection: 'row', alignItems: 'flex-start', gap: 56 },
  results: { flex: 1, minWidth: 0, gap: spacing.huge },
  count: { ...type.smallMedium, color: colors.textMuted, marginBottom: -spacing.xl },
  group: { gap: spacing.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupTitle: { ...type.h2, color: colors.textPrimary },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.huge },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 420 },

  aside: { width: '100%' },
  asideSide: { width: 340 },
  stillNeed: {
    gap: spacing.md,
    padding: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  stillTitle: { ...type.h2, color: colors.textOnPrimary },
  stillBody: { ...type.body, color: 'rgba(30, 36, 43, 0.82)', marginBottom: spacing.sm },
}));

export default HelpScreen;
