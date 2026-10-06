import React, { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/common/Card';
import useBreakpoint from '../../../hooks/useBreakpoint';
import Icon from '../../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../../theme/tokens';

// The vocabulary every admin record page is written in, so a user, a truck,
// a booking and a load all read as one product:
//
//   Hero        the record's name, what it is, its badges, and key numbers
//   Panel       a titled card of related content, with an optional action
//   InfoGrid    label/value pairs in one or two columns
//   RecordRow   a linked record (a person, a truck, a booking) that opens it
//   Notice      a tinted line of status: why it was rejected, what is missing

const initialsOf = (name) => {
  const letters = (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join('') || '?';
};

// A photo, a person's initials, or an icon for a thing.
export const Lead = ({ imageUrl, person, icon = 'info', size = 40, tone = 'primary' }) => {
  const frame = { width: size, height: size, borderRadius: person ? size / 2 : Math.round(size / 4) };
  if (imageUrl) return <Image source={{ uri: imageUrl }} style={[styles.leadImage, frame]} accessible={false} />;
  if (person) {
    return (
      <View style={[styles.leadPerson, frame]}>
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initialsOf(person)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.leadThing, tone === 'muted' && styles.leadMuted, frame]}>
      <Icon name={icon} size={Math.round(size * 0.48)} color={tone === 'muted' ? colors.textMuted : colors.primaryText} />
    </View>
  );
};

// One headline number about a record: "12 bookings", "4.8 rating".
export const StatTile = ({ icon, value, label }) => (
  <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
    <View style={styles.statIcon}>
      <Icon name={icon} size={iconSize.sm} color={colors.primaryText} />
    </View>
    <View style={styles.statText}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  </View>
);

// The top of a record page: who or what it is, at a glance. On a phone the
// mark shrinks and the title steps down a size, so a long name wraps inside
// the card instead of crowding it.
export const Hero = ({ lead, kicker, title, subtitle, badges, stats }) => {
  const { isPhone } = useBreakpoint();
  // Four tiles across when each gets ~150px, else two: always a full grid.
  const [statsWidth, setStatsWidth] = useState(0);
  const statColumns = statsWidth >= 600 ? 4 : 2;
  return (
    <Card style={[styles.hero, isPhone && styles.heroPhone]}>
      <View style={styles.heroTop}>
        {lead && isPhone ? React.cloneElement(lead, { size: 52 }) : lead}
        <View style={styles.heroText}>
          {kicker ? <Text style={styles.kicker} numberOfLines={2}>{kicker}</Text> : null}
          <Text style={[styles.heroTitle, isPhone && styles.heroTitlePhone]} accessibilityRole="header" selectable>{title}</Text>
          {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {badges ? <View style={styles.badges}>{badges}</View> : null}
      {stats?.length ? (
        <View style={styles.stats} onLayout={(event) => setStatsWidth(event.nativeEvent.layout.width)}>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statCell, { width: `${100 / statColumns}%` }]}>
              <StatTile {...stat} />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
};

// A titled block of a record page. `count` shows beside the title, `action`
// (a button) at its right.
export const Panel = ({ icon, title, count, action, children, tone, style }) => (
  <Card style={[styles.panel, tone === 'attention' && styles.panelAttention, style]}>
    <View style={styles.panelHead}>
      {icon ? (
        <View style={[styles.panelIcon, tone === 'attention' && styles.panelIconAttention]}>
          <Icon name={icon} size={iconSize.sm} color={tone === 'attention' ? colors.warningText : colors.primaryText} />
        </View>
      ) : null}
      <Text style={styles.panelTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
      {count != null ? <Text style={styles.count}>{count}</Text> : null}
      {action ? <View style={styles.panelAction}>{action}</View> : null}
    </View>
    {children}
  </Card>
);

// Label/value pairs, two to a row when the panel has the room.
export const InfoGrid = ({ children }) => {
  const [width, setWidth] = useState(0);
  const columns = width >= 520 ? 2 : 1;
  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {React.Children.toArray(children).filter(Boolean).map((child) => (
        <View key={child.key} style={[styles.gridCell, { width: child.props.wide || columns === 1 ? '100%' : '50%' }]}>
          {child}
        </View>
      ))}
    </View>
  );
};

// One fact. An empty value shows a muted dash rather than nothing, so a
// missing detail is visible as missing.
export const InfoItem = ({ icon, label, value, children, tone }) => {
  const { t } = useTranslation();
  const content = children ?? value;
  const empty = content == null || content === '' || content === false;
  return (
    <View style={styles.item}>
      <View style={styles.itemLabelRow}>
        {icon ? <Icon name={icon} size={iconSize.xs} color={colors.textMuted} /> : null}
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      {empty ? (
        <Text style={[styles.itemValue, styles.itemEmpty]}>{t('admin:detail.notGiven')}</Text>
      ) : typeof content === 'string' || typeof content === 'number' ? (
        <Text style={[styles.itemValue, tone === 'warning' && styles.itemWarning, tone === 'success' && styles.itemSuccess, tone === 'error' && styles.itemError]} selectable>{content}</Text>
      ) : content}
    </View>
  );
};

// A record linked from this one. Opens its page when it has one.
export const RecordRow = ({ lead, title, subtitle, meta, right, onPress, first }) => {
  const [hovered, setHovered] = useState(false);
  const body = (
    <>
      {lead}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
      {onPress ? <Icon name="forward" size={iconSize.sm} color={colors.textMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, !first && styles.rowRule]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, styles.rowPressable, !first && styles.rowRule, (hovered || pressed) && styles.rowHovered]}
    >
      {body}
    </Pressable>
  );
};

// A tinted line explaining where something stands.
export const Notice = ({ tone = 'info', icon, title, children }) => {
  const palette = {
    info: { bg: colors.infoMuted, fg: colors.infoText, icon: 'info' },
    warning: { bg: colors.warningMuted, fg: colors.warningText, icon: 'warning' },
    error: { bg: colors.errorMuted, fg: colors.errorText, icon: 'error' },
    success: { bg: colors.successMuted, fg: colors.successText, icon: 'success' },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]}>
      <Icon name={icon || palette.icon} size={iconSize.sm} color={palette.fg} style={styles.noticeIcon} />
      <View style={styles.noticeText}>
        {title ? <Text style={[styles.noticeTitle, { color: palette.fg }]}>{title}</Text> : null}
        {children ? <Text style={styles.noticeBody} selectable>{children}</Text> : null}
      </View>
    </View>
  );
};

export const Muted = ({ children }) => <Text style={styles.muted}>{children}</Text>;

const styles = themedStyles(() => ({
  leadImage: { backgroundColor: colors.surfaceMuted },
  leadPerson: { backgroundColor: colors.surfaceDark, alignItems: 'center', justifyContent: 'center' },
  leadThing: { backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  leadMuted: { backgroundColor: colors.surfaceMuted },
  initials: { fontWeight: '700', color: colors.textOnDark },

  hero: { padding: spacing.xl, marginTop: 0, marginBottom: spacing.lg },
  heroPhone: { padding: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, minWidth: 0 },
  kicker: { ...type.caption, color: colors.primaryText, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { ...type.h1, color: colors.textPrimary, marginTop: spacing.xxs },
  heroTitlePhone: { ...type.h2 },
  heroSubtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xxs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  // Cells of a fixed share, so the tiles line up in a grid however long
  // each value is.
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginHorizontal: -spacing.xs,
  },
  statCell: { paddingHorizontal: spacing.xs, paddingTop: spacing.sm, minWidth: 0 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  statIcon: { width: 36, height: 36, flexShrink: 0, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  statText: { flex: 1, minWidth: 0 },
  statValue: { ...type.h3, color: colors.textPrimary },
  statLabel: { ...type.small, color: colors.textMuted },

  panel: { padding: spacing.lg, marginTop: 0, marginBottom: spacing.lg },
  panelAttention: { borderWidth: 1, borderColor: colors.warningText },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  panelIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  panelIconAttention: { backgroundColor: colors.warningMuted },
  panelTitle: { ...type.h3, color: colors.textPrimary, flexShrink: 1 },
  count: {
    ...type.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  panelAction: { marginLeft: 'auto' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm },
  gridCell: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  item: { gap: spacing.xxs },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemValue: { ...type.bodyMedium, color: colors.textPrimary },
  itemEmpty: { color: colors.textMuted, fontWeight: '400' },
  itemWarning: { color: colors.warningText },
  itemSuccess: { color: colors.successText },
  itemError: { color: colors.errorText },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowPressable: { marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  rowRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowHovered: { backgroundColor: colors.surfaceMuted },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.bodyMedium, color: colors.textPrimary },
  rowSubtitle: { ...type.small, color: colors.textSecondary, marginTop: 1 },
  rowMeta: { ...type.small, color: colors.textMuted, marginTop: 1 },
  rowRight: { flexShrink: 0, alignItems: 'flex-end' },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  noticeIcon: { marginTop: 2 },
  noticeText: { flex: 1, minWidth: 0, gap: spacing.xxs },
  noticeTitle: { ...type.smallMedium },
  noticeBody: { ...type.small, color: colors.textSecondary },

  muted: { ...type.small, color: colors.textMuted },
}));
