import React, { createContext, useContext, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles, themed } from '../../theme/tokens';
import useSiteStyle, { SITE_WIDTH } from '../siteStyle';

// The small set of pieces every public page is built from: a centred content
// column, full-width bands ("sections") in one of four brand tones, their
// headings, icon tiles, cards, lists and links. Pages compose these instead of
// styling their own, so the whole site reads as one product in both themes.

// Each band's palette. `dark` is Deep Asphalt (Midnight Cabin in dark mode) and
// `brand` is Freight Amber, so nothing outside the brand palette is introduced.
const TONES = themed(() => ({
  plain: {
    background: colors.background,
    title: colors.textPrimary,
    body: colors.textSecondary,
    accent: colors.primaryText,
    accentBg: colors.primaryMuted,
    card: colors.surface,
    cardBorder: colors.border,
  },
  surface: {
    background: colors.surface,
    title: colors.textPrimary,
    body: colors.textSecondary,
    accent: colors.primaryText,
    accentBg: colors.primaryMuted,
    card: colors.background,
    cardBorder: colors.divider,
  },
  dark: {
    background: colors.surfaceDark,
    title: colors.textInverse,
    body: colors.textInverseMuted,
    // True brand amber reads at ~8:1 on Deep Asphalt, so it is safe as text here.
    accent: colors.primary,
    accentBg: 'rgba(255, 159, 0, 0.16)',
    card: 'rgba(244, 246, 248, 0.05)',
    cardBorder: 'rgba(244, 246, 248, 0.12)',
  },
  brand: {
    background: colors.primary,
    title: colors.textOnPrimary,
    body: 'rgba(30, 36, 43, 0.82)', // tint of FLITO_COLORS.secondary
    accent: colors.textOnPrimary,
    accentBg: 'rgba(30, 36, 43, 0.1)',
    card: 'rgba(255, 255, 255, 0.35)',
    cardBorder: 'rgba(30, 36, 43, 0.12)',
  },
}));

const ToneContext = createContext('plain');

// The palette of the band a component sits in.
export const useTone = () => TONES[useContext(ToneContext)] || TONES.plain;
export const useToneName = () => useContext(ToneContext);

export const Container = ({ children, width = SITE_WIDTH, style }) => {
  const site = useSiteStyle();
  return (
    <View style={[styles.container, { maxWidth: width + site.gutter * 2, paddingHorizontal: site.gutter }, style]}>
      {children}
    </View>
  );
};

export const Eyebrow = ({ icon, label, style }) => {
  const tone = useTone();
  return (
    <View style={[styles.eyebrow, { backgroundColor: tone.accentBg }, style]}>
      {icon ? <Icon name={icon} size={iconSize.xs} color={tone.accent} /> : null}
      <Text style={[styles.eyebrowText, { color: tone.accent }]}>{label}</Text>
    </View>
  );
};

// A heading, its lead paragraph and an optional eyebrow above it.
export const SectionHeader = ({ eyebrow, eyebrowIcon, title, lead, align = 'left', width = 720, level = 2, style }) => {
  const site = useSiteStyle();
  const tone = useTone();
  const centred = align === 'center';
  return (
    <View style={[{ maxWidth: width }, centred && styles.centred, { marginBottom: site.isPhone ? spacing.xxl : 48 }, style]}>
      {eyebrow ? <Eyebrow icon={eyebrowIcon} label={eyebrow} style={[styles.headerEyebrow, centred && styles.headerEyebrowCentred]} /> : null}
      {title ? (
        <Text
          style={[level === 1 ? site.hero : site.title, { color: tone.title }, centred && styles.textCentre]}
          accessibilityRole="header"
          aria-level={level}
        >
          {title}
        </Text>
      ) : null}
      {lead ? <Text style={[site.lead, styles.lead, { color: tone.body }, centred && styles.textCentre]}>{lead}</Text> : null}
    </View>
  );
};

// A full-width band. `space` overrides the vertical padding; `width` the column.
// `backdrop` is decoration drawn across the whole band, behind the content.
export const Section = ({
  tone = 'plain',
  eyebrow,
  eyebrowIcon,
  title,
  lead,
  align,
  headerWidth,
  width,
  space,
  children,
  style,
  innerStyle,
  onLayout,
  backdrop,
}) => {
  const site = useSiteStyle();
  const palette = TONES[tone] || TONES.plain;
  const pad = space ?? site.sectionSpace;
  return (
    <ToneContext.Provider value={tone}>
      <View style={[{ backgroundColor: palette.background, paddingVertical: pad }, backdrop && styles.clipped, style]} onLayout={onLayout}>
        {backdrop}
        <Container width={width} style={innerStyle}>
          {eyebrow || title || lead ? (
            <SectionHeader eyebrow={eyebrow} eyebrowIcon={eyebrowIcon} title={title} lead={lead} align={align} width={headerWidth} />
          ) : null}
          {children}
        </Container>
      </View>
    </ToneContext.Provider>
  );
};

const TILE_TINTS = themed(() => ({
  amber: { background: colors.primaryMuted, icon: colors.primaryText },
  teal: { background: colors.accentMuted, icon: colors.accentText },
  solid: { background: colors.primary, icon: colors.textOnPrimary },
  dark: { background: colors.secondary, icon: colors.primary },
}));

export const IconTile = ({ icon, tint = 'amber', size = 48, style }) => {
  const palette = TILE_TINTS[tint] || TILE_TINTS.amber;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size >= 48 ? radius.lg : radius.md, backgroundColor: palette.background }, style]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={palette.icon} />
    </View>
  );
};

// A bordered card in the band's own card colour. `onPress` makes it a link;
// `hoverable` gives a plain card the same lift under a mouse, without making
// it something to tab to or tap.
export const SiteCard = ({ children, onPress, accessibilityLabel, style, padded = true, hoverable = false }) => {
  const tone = useTone();
  const [hovered, setHovered] = useState(false);
  const base = [
    styles.card,
    padded && styles.cardPadded,
    { backgroundColor: tone.card, borderColor: hovered ? colors.primaryText : tone.cardBorder },
    hovered && [shadow.level2, styles.cardLifted],
    style,
  ];
  if (!onPress) {
    const hover = hoverable ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : null;
    return <View style={base} {...hover}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.cardPressed]}
    >
      {children}
    </Pressable>
  );
};

// Icon, title and a short paragraph, the most common card on the site.
export const FeatureCard = ({ icon, tint, title, body, children, onPress, style }) => {
  const tone = useTone();
  return (
    <SiteCard onPress={onPress} accessibilityLabel={title} style={[styles.feature, style]} hoverable>
      {icon ? <IconTile icon={icon} tint={tint} /> : null}
      <Text style={[styles.featureTitle, { color: tone.title }]}>{title}</Text>
      {body ? <Text style={[styles.featureBody, { color: tone.body }]}>{body}</Text> : null}
      {children}
    </SiteCard>
  );
};

// Body copy in the band's colour.
export const Paragraph = ({ children, style, large = false }) => {
  const tone = useTone();
  const site = useSiteStyle();
  return <Text style={[large ? site.lead : styles.paragraph, { color: tone.body }, style]}>{children}</Text>;
};

export const Heading = ({ children, level = 3, style }) => {
  const tone = useTone();
  const site = useSiteStyle();
  const size = level <= 2 ? site.title : level === 3 ? site.subtitle : type.h3;
  return (
    <Text style={[size, { color: tone.title }, style]} accessibilityRole="header" aria-level={level}>
      {children}
    </Text>
  );
};

// A list with a check (or a given icon) before each line.
export const CheckList = ({ items, icon = 'success', tint = 'teal', style, dense = false }) => {
  const tone = useTone();
  const toneName = useToneName();
  // Velocity Teal itself is bright enough on the dark band, its darkened tone on
  // light ones; on the amber band neither reads, so the band's own ink is used.
  const iconColor = tint === 'amber' || toneName === 'brand' ? tone.accent : toneName === 'dark' ? colors.accent : colors.accentText;
  return (
    <View style={[styles.checkList, dense && styles.checkListDense, style]}>
      {items.map((item) => (
        <View key={typeof item === 'string' ? item : item.text} style={styles.checkRow}>
          <Icon name={typeof item === 'string' ? icon : item.icon || icon} size={iconSize.md} color={iconColor} style={styles.checkIcon} />
          <Text style={[styles.checkText, dense && styles.checkTextDense, { color: tone.body }]}>
            {typeof item === 'string' ? item : item.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

// An inline text link: underlined on hover, in the band's accent colour.
export const TextLink = ({ label, onPress, icon = 'arrowRight', style, textStyle }) => {
  const tone = useTone();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.textLink, style]}
    >
      <Text style={[styles.textLinkLabel, { color: tone.accent }, hovered && styles.underline, textStyle]}>{label}</Text>
      {icon ? <Icon name={icon} size={iconSize.sm} color={tone.accent} style={hovered ? styles.nudge : null} /> : null}
    </Pressable>
  );
};

// Equal columns that wrap, sized from the page's own width.
export const Columns = ({ columns, gap = spacing.lg, children, style }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.columns, { marginHorizontal: -gap / 2, marginBottom: -gap }, style]}>
      {items.map((child) => (
        <View key={child.key} style={[styles.column, { width: `${100 / columns}%`, paddingHorizontal: gap / 2, marginBottom: gap }]}>
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = themedStyles(() => ({
  container: { width: '100%', alignSelf: 'center' },
  centred: { alignSelf: 'center', alignItems: 'center' },
  textCentre: { textAlign: 'center' },
  lead: { marginTop: spacing.md },

  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  eyebrowText: { ...type.caption, letterSpacing: 0.6, textTransform: 'uppercase' },
  headerEyebrow: { marginBottom: spacing.lg },
  headerEyebrowCentred: { alignSelf: 'center' },

  tile: { alignItems: 'center', justifyContent: 'center' },

  card: { borderWidth: 1, borderRadius: radius.xl },
  cardPadded: { padding: spacing.xxl },
  cardPressed: { opacity: 0.92 },
  cardLifted: { transform: [{ translateY: -2 }] },
  // A backdrop may run past the band's edges; this keeps the page from
  // scrolling sideways.
  clipped: { overflow: 'hidden' },
  feature: { flex: 1, gap: spacing.md },
  featureTitle: { ...type.h3, marginTop: spacing.xs },
  featureBody: { ...type.body },

  paragraph: { ...type.bodyLarge, lineHeight: 29 },

  checkList: { gap: spacing.md },
  checkListDense: { gap: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  checkIcon: { marginTop: 3 },
  checkText: { ...type.bodyLarge, flex: 1 },
  checkTextDense: { ...type.body },

  textLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs },
  textLinkLabel: { ...type.bodyMedium },
  underline: { textDecorationLine: 'underline' },
  nudge: { transform: [{ translateX: 3 }] },

  columns: { flexDirection: 'row', flexWrap: 'wrap' },
  column: { minWidth: 0 },
}));
