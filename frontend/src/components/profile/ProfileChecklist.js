import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../../theme/tokens';

const SIZE = 64;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A circular progress meter with the percentage in the middle.
const Ring = ({ percent, complete }) => (
  <View style={styles.ring} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
    <Svg width={SIZE} height={SIZE}>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.surfaceMuted} strokeWidth={STROKE} fill="none" />
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={complete ? colors.success : colors.primary}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
        rotation={-90}
        originX={SIZE / 2}
        originY={SIZE / 2}
      />
    </Svg>
    <Text style={[styles.ringText, complete && styles.ringTextComplete]}>{percent}%</Text>
  </View>
);

const Step = ({ step, first }) => {
  const [hovered, setHovered] = useState(false);
  const actionable = !step.done && !step.waiting && step.onPress;
  const state = step.done ? 'done' : step.waiting ? 'waiting' : 'todo';

  return (
    <Pressable
      onPress={actionable ? step.onPress : undefined}
      disabled={!actionable}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole={actionable ? 'button' : 'text'}
      accessibilityLabel={step.label}
      style={[styles.step, !first && styles.stepRule, hovered && actionable && styles.stepHovered]}
    >
      <View style={[styles.mark, styles[`mark_${state}`]]}>
        {state === 'done' ? <Icon name="checkmark" size={14} color={colors.textOnDark} /> : null}
        {state === 'waiting' ? <Icon name="time" size={13} color={colors.warningText} /> : null}
      </View>
      <Text style={[styles.stepText, state === 'done' && styles.stepTextDone]} numberOfLines={2}>{step.label}</Text>
      {actionable ? <Icon name="forward" size={iconSize.sm} color={colors.primaryText} /> : null}
    </Pressable>
  );
};

// What is left to make the profile complete, as a checklist: every step is
// visible, finished ones are ticked, the rest open the screen that does them.
// Once everything is done it folds down to a single line of praise.
const ProfileChecklist = ({ steps }) => {
  const { t } = useTranslation();
  const done = steps.filter((step) => step.done).length;
  const percent = steps.length ? Math.round((done / steps.length) * 100) : 100;
  const complete = percent === 100;
  const waitingOnly = !complete && steps.every((step) => step.done || step.waiting);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ring percent={percent} complete={complete} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('profile:strength.title')}</Text>
          <Text style={[styles.subtitle, complete && styles.subtitleComplete]}>
            {complete
              ? t('profile:strength.complete')
              : waitingOnly
                ? t('profile:strength.waitingReview')
                : t('profile:strength.stepsDone', { done, total: steps.length })}
          </Text>
        </View>
      </View>

      {!complete ? (
        <View style={styles.steps}>
          {steps.map((step, index) => <Step key={step.key} step={step} first={index === 0} />)}
        </View>
      ) : null}
    </View>
  );
};

const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, ...shadow.level1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerText: { flex: 1 },
  title: { ...type.h3, color: colors.textPrimary },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  subtitleComplete: { color: colors.successText },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', ...type.smallMedium, color: colors.primaryText },
  ringTextComplete: { color: colors.successText },

  steps: { marginTop: spacing.lg },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm, borderRadius: radius.md },
  stepRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  stepHovered: { backgroundColor: colors.primaryMuted },
  stepText: { ...type.body, color: colors.textPrimary, flex: 1 },
  stepTextDone: { color: colors.textMuted },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  mark_done: { backgroundColor: colors.success, borderColor: colors.success },
  mark_waiting: { backgroundColor: colors.warningMuted, borderColor: colors.warningText },
  mark_todo: { borderColor: colors.borderStrong },
}));

export default ProfileChecklist;
