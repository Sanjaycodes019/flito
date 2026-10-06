import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles, themed } from '../../theme/tokens';
import { formatCurrency } from '../../utils/helpers';
import { formatDayKey, nepalDay } from '../../utils/nepalDate';

const TONES = themed(() => ({
  overdue: { tint: colors.errorMuted, text: colors.errorText, icon: 'warning' },
  due: { tint: colors.warningMuted, text: colors.warningText, icon: 'time' },
  start: { tint: colors.infoMuted, text: colors.infoText, icon: 'info' },
}));

// What an owner's Home says about FLITO's fees, when there is something to
// say: fees past due, fees to pay now, or, before fees start, the date they
// will. `fees` is { summary, rules } from useCommissionSummary.
const CommissionNotice = ({ fees, onOpen }) => {
  const { t } = useTranslation();
  if (!fees) return null;
  const { summary, rules } = fees;

  const overdue = summary.overdue - summary.awaiting;
  const due = summary.payableNow - summary.awaiting;
  let kind = null;
  let title;
  let body;
  if (overdue > 0) {
    kind = 'overdue';
    title = t('payments:commission.homeOverdueTitle', { amount: formatCurrency(overdue) });
    body = t('payments:commission.homeOverdueText');
  } else if (due > 0) {
    kind = 'due';
    title = t('payments:commission.homeDueTitle', { amount: formatCurrency(due) });
    body = t('payments:commission.homeDueText', { date: summary.dueDay ? formatDayKey(summary.dueDay) : '' });
  } else if (rules?.startsOn && nepalDay() < rules.startsOn) {
    kind = 'start';
    title = t('payments:commission.homeStartTitle', { date: formatDayKey(rules.startsOn) });
    body = t('payments:commission.homeStartText');
  }
  if (!kind) return null;

  const tone = TONES[kind];
  return (
    <View style={[styles.card, { backgroundColor: tone.tint }]}>
      <Icon name={tone.icon} size={iconSize.lg} color={tone.text} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: tone.text }]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Button title={t('payments:commission.seeFees')} icon="forward" size="sm" variant="tertiary" onPress={onOpen} style={styles.button} />
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md },
  text: { flex: 1 },
  title: { ...type.bodyMedium },
  body: { ...type.small, color: colors.textPrimary, marginTop: spacing.xxs },
  button: { alignSelf: 'flex-start', marginTop: spacing.sm },
}));

export default CommissionNotice;
