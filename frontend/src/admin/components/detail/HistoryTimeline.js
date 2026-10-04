import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, type, themedStyles } from '../../../theme/tokens';
import { formatWhen } from '../../format';
import { Panel, Muted } from './DetailParts';

// How strongly each kind of change reads on the timeline. Read at render
// time, so it follows the light/dark palette.
const TONE = {
  approved: 'successText',
  reactivated: 'successText',
  rejected: 'errorText',
  revoked: 'errorText',
  banned: 'errorText',
  cancelled: 'errorText',
  suspended: 'warningText',
};
const toneOf = (action) => colors[TONE[action.split('.').pop()] || 'infoText'];

// What admins have done to this record, newest first: what changed, who did
// it, when, and the reason they gave.
const HistoryTimeline = ({ entries }) => {
  const { t } = useTranslation();
  return (
    <Panel icon="history" title={t('admin:history.title')} count={entries?.length || 0}>
      {!entries?.length ? (
        <Muted>{t('admin:history.empty')}</Muted>
      ) : entries.map((entry, index) => (
        <View key={entry._id} style={styles.entry}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: toneOf(entry.action) }]} />
            {index < entries.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.body}>
            <Text style={styles.action}>{t(`admin:history.actions.${entry.action}`, entry.action)}</Text>
            <Text style={styles.meta}>
              {[entry.by?.name ? t('admin:history.by', { name: entry.by.name }) : null, formatWhen(entry.at)].filter(Boolean).join(' · ')}
            </Text>
            {entry.reason ? <Text style={styles.reason} selectable>“{entry.reason}”</Text> : null}
          </View>
        </View>
      ))}
    </Panel>
  );
};

const styles = themedStyles(() => ({
  entry: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  line: { flex: 1, width: 2, backgroundColor: colors.divider, marginTop: spacing.xs },
  body: { flex: 1, minWidth: 0, paddingBottom: spacing.lg },
  action: { ...type.smallMedium, color: colors.textPrimary },
  meta: { ...type.small, color: colors.textMuted, marginTop: 1 },
  reason: {
    ...type.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
}));

export default HistoryTimeline;
