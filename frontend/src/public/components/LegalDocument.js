import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import Disclosure from '../../components/common/Disclosure';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import useSiteStyle, { READING_WIDTH } from '../siteStyle';
import { usePageScroll } from './PublicLayout';
import { Container } from './Blocks';

const TOC_WIDTH = 280;
// The contents column stays in view while the text scrolls, and scrolls on
// its own when a long document's list is taller than the window. Web only:
// native has no sticky positioning, and a phone shows the contents as a
// dropdown. Raw CSS values, outside StyleSheet, which react-native-web
// forwards as they are.
const STICKY = Platform.OS === 'web'
  ? { position: 'sticky', top: 108, maxHeight: 'calc(100vh - 132px)', overflowY: 'auto', scrollbarWidth: 'thin' }
  : null;

const ContentsLink = ({ index, title, active, onPress }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      aria-current={active ? 'location' : undefined}
      style={[styles.tocLink, (hovered || active) && styles.tocLinkActive]}
    >
      <Text style={[styles.tocNumber, active && styles.tocActiveText]}>{index + 1}</Text>
      <Text style={[styles.tocText, active && styles.tocActiveText]}>{title}</Text>
    </Pressable>
  );
};

// Terms of Service and the Privacy Policy, from structured text: a "short
// version" summary, then numbered sections of paragraphs and lists. A laptop
// keeps a contents list beside the text that follows where you are.
//
// Each section: { id, title, body: [paragraphs], list: [items], after: [paragraphs] }
const LegalDocument = ({ summaryTitle, summary = [], sections }) => {
  const { t } = useTranslation();
  const site = useSiteStyle();
  const scroll = usePageScroll();
  const nodes = useRef({});
  const offsets = useRef([]);
  const [active, setActive] = useState(0);
  const side = site.isDesktop;

  // Where each section starts, re-measured whenever the layout settles.
  const remeasure = () => {
    sections.forEach((section, index) => {
      scroll.measure(nodes.current[section.id], (y) => { offsets.current[index] = y; });
    });
  };

  useEffect(() => {
    if (!side) return undefined;
    return scroll.subscribe((y) => {
      const line = y + scroll.clearance + 24;
      let current = 0;
      offsets.current.forEach((offset, index) => { if (offset != null && offset <= line) current = index; });
      setActive((previous) => (previous === current ? previous : current));
    });
  }, [scroll, side]);

  const jump = (section) => scroll.scrollToNode(nodes.current[section.id]);

  const contents = sections.map((section, index) => (
    <ContentsLink key={section.id} index={index} title={section.title} active={side && index === active} onPress={() => jump(section)} />
  ));

  const body = (
    <View style={styles.body} onLayout={remeasure}>
      {summary.length ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle} accessibilityRole="header" aria-level={2}>{summaryTitle}</Text>
          {summary.map((item) => (
            <View key={item.text} style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <Icon name={item.icon} size={iconSize.md} color={colors.primaryText} />
              </View>
              <Text style={styles.summaryText}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!side ? (
        <Disclosure title={t('site:legal.contents')} icon="list" style={styles.mobileToc}>
          <View style={styles.mobileTocList}>{contents}</View>
        </Disclosure>
      ) : null}

      {sections.map((section, index) => (
        <View
          key={section.id}
          ref={(node) => { nodes.current[section.id] = node; }}
          style={styles.section}
        >
          <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={2}>
            <Text style={styles.sectionNumber}>{`${index + 1}. `}</Text>
            {section.title}
          </Text>
          {(section.body || []).map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
          {section.list ? (
            <View style={styles.list}>
              {section.list.map((item) => (
                <View key={item} style={styles.listRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {(section.after || []).map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
        </View>
      ))}

      {Platform.OS === 'web' && typeof window !== 'undefined' && window.print ? (
        <Pressable onPress={() => window.print()} accessibilityRole="button" style={({ hovered }) => [styles.print, hovered && styles.printHovered]}>
          <Icon name="document" size={iconSize.md} color={colors.primaryText} />
          <Text style={styles.printText}>{t('site:legal.print')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Container style={{ paddingTop: site.isPhone ? spacing.xxl : 56, paddingBottom: site.sectionSpace }}>
      {side ? (
        <View style={styles.columns}>
          <View style={[styles.tocColumn, STICKY]}>
            <Text style={styles.tocTitle}>{t('site:legal.contents')}</Text>
            {contents}
          </View>
          {body}
        </View>
      ) : body}
    </Container>
  );
};

const styles = themedStyles(() => ({
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 64 },
  tocColumn: { width: TOC_WIDTH, gap: 2, paddingTop: spacing.xs },
  tocTitle: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginLeft: spacing.md },
  tocLink: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tocLinkActive: { backgroundColor: colors.primaryMuted, borderLeftColor: colors.primary },
  tocNumber: { ...type.smallMedium, color: colors.textMuted, width: 20 },
  tocText: { ...type.small, color: colors.textSecondary, flex: 1 },
  tocActiveText: { color: colors.textPrimary, fontWeight: '600' },
  mobileToc: { marginBottom: spacing.xxl },
  mobileTocList: { gap: 2, paddingBottom: spacing.sm },

  body: { flex: 1, maxWidth: READING_WIDTH, minWidth: 0 },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.xxl,
    gap: spacing.lg,
    marginBottom: spacing.huge,
  },
  summaryTitle: { ...type.h2, color: colors.textPrimary },
  summaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  summaryIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  summaryText: { ...type.body, color: colors.textSecondary, flex: 1, paddingTop: 5 },

  section: { marginBottom: spacing.huge },
  sectionTitle: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.md },
  sectionNumber: { color: colors.primaryText },
  paragraph: { ...type.bodyLarge, lineHeight: 30, color: colors.textSecondary, marginBottom: spacing.md },
  list: { gap: spacing.sm, marginBottom: spacing.md, paddingLeft: spacing.xs },
  listRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginTop: 12 },
  listText: { ...type.bodyLarge, lineHeight: 30, color: colors.textSecondary, flex: 1 },

  print: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  printHovered: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryText },
  printText: { ...type.smallMedium, color: colors.primaryText },
}));

export default LegalDocument;
