import React, { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from './Card';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, shadow, themedStyles } from '../../theme/tokens';

const initialsOf = (name) => {
  const letters = (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join('') || '?';
};

// The leading mark of a card: a photo, or initials in a circle for a person,
// or an icon in a tinted square for a thing (load, truck, booking).
const Lead = ({ icon, person, imageUrl }) => {
  if (imageUrl) return <Image source={{ uri: imageUrl }} style={[styles.lead, styles.leadPhoto]} accessible={false} />;
  if (person) {
    return (
      <View style={[styles.lead, styles.leadPerson]}>
        <Text style={styles.initials}>{initialsOf(person)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.lead, styles.leadThing]}>
      <Icon name={icon} size={iconSize.md} color={colors.primaryText} />
    </View>
  );
};

// The record card every list in FLITO uses (loads, bookings, offers, trucks,
// and every admin list), one anatomy for all of them:
//
//   [lead]  Title (two lines at most)
//           Subtitle
//   [badge] [badge] [pill]          status, wrapping onto a second line
//   ─────────────────────────
//   facts: icon, label, value       one line each, cut with "…" if long
//   anything else (route, papers)
//                     View details ›
//   ═════════════════════════
//   footer actions                  share the width, wrap when narrow
//
// Badges sit under the title rather than beside it, so a long name or a long
// Nepali status never squeezes the other. The footer is pushed to the card's
// bottom, so footers line up across a row of cards of different heights.
//
// With `onPress` everything above the footer opens the record's page. The
// footer stays outside that tap area, so its buttons and fields (approve, a
// rejection reason) work as themselves.
const RecordCard = ({
  icon, person, imageUrl, title, titleAddon, subtitle, badges, children, footer, onPress, accessibilityLabel, highlight,
}) => {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;

  const content = (
    <>
      <View style={styles.header}>
        <Lead icon={icon} person={person} imageUrl={imageUrl} />
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {titleAddon}
          </View>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
      </View>
      {badges ? <View style={styles.badges}>{badges}</View> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
      {onPress ? (
        <View style={styles.open}>
          <Text style={[styles.openText, active && styles.openTextActive]}>{t('common:card.viewDetails')}</Text>
          <Icon name="forward" size={iconSize.sm} color={active ? colors.primaryText : colors.textMuted} />
        </View>
      ) : null}
    </>
  );

  return (
    <Card
      style={[
        styles.card,
        (onPress || highlight) && styles.cardInteractive,
        highlight && styles.cardHighlight,
        onPress && hovered && styles.cardHovered,
        focused && styles.cardFocused,
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityRole="link"
          accessibilityLabel={accessibilityLabel || title}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        >
          {content}
        </Pressable>
      ) : <View style={styles.pressable}>{content}</View>}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Card>
  );
};

const FACT_TONES = {
  warning: 'warningText',
  error: 'errorText',
  success: 'successText',
};

// One fact about a record. With a label it reads as a row of a receipt,
// label on the left and value on the right; without one, the icon leads the
// value. Values get one line (`lines` for more) and end in "…" rather than
// pushing the card wider. Falsy values render nothing, so optional fields
// need no checks.
export const Fact = ({ icon, label, children, lines = 1, tone }) => {
  if (!children) return null;
  const valueColor = tone ? { color: colors[FACT_TONES[tone]] } : null;
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={iconSize.xs} color={tone ? colors[FACT_TONES[tone]] : colors.textMuted} style={styles.factIcon} />
      {label ? (
        <>
          <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
          <Text style={[styles.factValue, styles.factValueRight, valueColor]} numberOfLines={lines}>{children}</Text>
        </>
      ) : (
        <Text style={[styles.factValue, valueColor]} numberOfLines={lines}>{children}</Text>
      )}
    </View>
  );
};

const PILL_TONES = {
  success: ['successMuted', 'successText'],
  warning: ['warningMuted', 'warningText'],
  error: ['errorMuted', 'errorText'],
  info: ['infoMuted', 'infoText'],
  accent: ['accentMuted', 'accentText'],
  muted: ['surfaceMuted', 'textSecondary'],
};

// A small tinted label beside the status badges: identity verified, a
// rating, "1 of 3 trucks", the amount of a booking.
export const Pill = ({ icon, tone = 'muted', children }) => {
  const [bg, fg] = PILL_TONES[tone] || PILL_TONES.muted;
  return (
    <View style={[styles.pill, { backgroundColor: colors[bg] }]}>
      {icon ? <Icon name={icon} size={12} color={colors[fg]} /> : null}
      <Text style={[styles.pillText, { color: colors[fg] }]} numberOfLines={1}>{children}</Text>
    </View>
  );
};

// Where a load goes: two stops joined by a line, each cut to one line.
export const RouteLine = ({ from, to }) => (
  <View style={styles.route}>
    <View style={styles.routeRail}>
      <View style={[styles.routeDot, styles.routeDotFrom]} />
      <View style={styles.routeLine} />
      <View style={[styles.routeDot, styles.routeDotTo]} />
    </View>
    <View style={styles.routeStops}>
      <Text style={styles.routeText} numberOfLines={1}>{from || '—'}</Text>
      <Text style={styles.routeText} numberOfLines={1}>{to || '—'}</Text>
    </View>
  </View>
);

export const PillRow = ({ children }) => <View style={styles.badgesInline}>{children}</View>;

// Footer buttons: equal shares of the width, wrapping two to a row on a
// narrow card instead of squeezing their labels.
export const ActionRow = ({ children }) => (
  <View style={styles.actions}>
    {React.Children.toArray(children).filter(Boolean).map((child) => (
      <View key={child.key} style={styles.actionCell}>{child}</View>
    ))}
  </View>
);

export const DocumentGrid = ({ children }) => <View style={styles.documents}>{children}</View>;

const styles = themedStyles(() => ({
  card: { padding: spacing.lg, flex: 1, marginVertical: 0, minWidth: 0 },
  cardInteractive: { borderWidth: 1, borderColor: colors.divider },
  cardHighlight: { borderColor: colors.accentText, borderWidth: 1.5 },
  cardHovered: { borderColor: colors.borderStrong, ...shadow.level2 },
  cardFocused: { borderColor: colors.focusRing },
  pressable: { flexGrow: 1, borderRadius: radius.md, minWidth: 0 },
  pressed: { opacity: 0.85 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  lead: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  leadPhoto: { borderRadius: 22, backgroundColor: colors.surfaceMuted },
  leadPerson: { borderRadius: 22, backgroundColor: colors.surfaceDark },
  leadThing: { borderRadius: radius.md, backgroundColor: colors.primaryMuted },
  initials: { fontSize: 15, fontWeight: '700', color: colors.textOnDark },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  title: { ...type.h3, color: colors.textPrimary, flexShrink: 1 },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 1 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  badgesInline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  pillText: { ...type.caption, fontWeight: '600', flexShrink: 1 },

  body: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  factIcon: { width: iconSize.xs, flexShrink: 0 },
  factLabel: { ...type.small, color: colors.textMuted, flexShrink: 0, maxWidth: '45%' },
  factValue: { ...type.smallMedium, color: colors.textPrimary, flex: 1, minWidth: 0 },
  factValueRight: { textAlign: 'right' },

  route: { flexDirection: 'row', gap: spacing.sm, minWidth: 0 },
  routeRail: { alignItems: 'center', paddingVertical: 6, width: iconSize.xs },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeDotFrom: { backgroundColor: colors.accent },
  routeDotTo: { backgroundColor: colors.primary },
  routeLine: { flex: 1, width: 2, minHeight: 10, backgroundColor: colors.border, marginVertical: 2 },
  routeStops: { flex: 1, minWidth: 0, gap: spacing.xs },
  routeText: { ...type.smallMedium, color: colors.textPrimary },

  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xxs, marginTop: 'auto', paddingTop: spacing.md },
  openText: { ...type.smallMedium, color: colors.textMuted },
  openTextActive: { color: colors.primaryText },

  footer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  actionCell: { flexGrow: 1, flexBasis: 130, paddingHorizontal: spacing.xs },
  documents: { gap: spacing.xs },
}));

export default RecordCard;
