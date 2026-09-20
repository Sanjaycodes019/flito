import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// One question at a time, for people who find long forms hard. Every step has
// an icon, a short title, one plain sentence, and the fields for just that
// step, sized to fit a phone screen without zooming. The bar shows how far
// along you are ("Step 2 of 5"), and a step that is optional says Skip while
// it is empty.
//
// All the answers live in the screen that renders this, so going Back never
// loses anything. A step's `check()` returns true when it may be left; when it
// returns false `onBlocked` fires so the screen can show what is missing.
//
// steps: [{ key, title, hint, icon, optional, isEmpty(), check(), content }]
// `freeJump` lets the step bar be tapped to go anywhere (used when editing).
const StepWizard = ({ steps, finishLabel, finishIcon = 'checkmark', onFinish, finishing, onBlocked, onAdvance, onStepChange, onCancel, freeJump = false, fixedFooter = false, scrollRef, contentStyle }) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  const go = (next) => {
    setIndex(next);
    onAdvance?.(next);
    onStepChange?.(next);
  };

  const handleNext = () => {
    if (step.check && !step.check()) {
      onBlocked?.(index);
      return;
    }
    go(index + 1);
  };

  const handleBack = () => (index === 0 ? onCancel?.() : go(index - 1));

  const nextLabel = step.optional && step.isEmpty?.() ? t('common:wizard.skip') : t('common:wizard.next');

  const top = (
    <>
      <View style={styles.progressRow}>
        <Text style={styles.progressText} accessibilityLiveRegion="polite">
          {t('common:wizard.stepOf', { current: index + 1, total: steps.length })}
        </Text>
        <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}>
          {steps.map((item, i) => (
            <Pressable
              key={item.key}
              disabled={!freeJump}
              onPress={() => go(i)}
              accessibilityLabel={item.title}
              style={[styles.segment, i <= index && styles.segmentDone]}
            />
          ))}
        </View>
      </View>

      <View style={styles.heading}>
        <View style={styles.iconBubble}>
          <Icon name={step.icon} size={iconSize.lg} color={colors.primaryText} />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.title} accessibilityRole="header">{step.title}</Text>
          {!!step.hint && <Text style={styles.hint}>{step.hint}</Text>}
        </View>
      </View>

      <View style={styles.body}>{step.content}</View>
    </>
  );

  const footer = (
    <View style={[styles.footer, fixedFooter && styles.footerFixed]}>
      {(index > 0 || onCancel) && (
        <Button
          title={index === 0 ? t('common:wizard.cancel') : t('common:wizard.back')}
          icon={index === 0 ? 'close' : 'back'}
          variant="tertiary"
          onPress={handleBack}
          style={styles.footerSide}
        />
      )}
      {last ? (
        <Button title={finishLabel} icon={finishIcon} onPress={onFinish} loading={finishing} style={styles.footerMain} />
      ) : (
        <Button title={nextLabel} icon="forward" iconPosition="right" onPress={handleNext} style={styles.footerMain} />
      )}
    </View>
  );

  if (!fixedFooter) {
    return (
      <View>
        {top}
        {footer}
      </View>
    );
  }

  // On a phone the buttons stay at the bottom of the screen, so Next never
  // scrolls out of reach however long the step is.
  return (
    <View style={styles.fixedRoot}>
      <ScrollView ref={scrollRef} style={styles.fixedScroll} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        {top}
      </ScrollView>
      {footer}
    </View>
  );
};

const styles = themedStyles(() => ({
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  progressText: { ...type.small, fontWeight: '600', color: colors.textSecondary },
  bar: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  segmentDone: { backgroundColor: colors.primary },

  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: { flex: 1, minWidth: 0 },
  title: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textSecondary, marginTop: 2 },

  body: { marginBottom: spacing.lg },

  footer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  footerFixed: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  footerSide: { flex: 1 },
  footerMain: { flex: 2 },

  fixedRoot: { flex: 1 },
  fixedScroll: { flex: 1 },
}));

export default StepWizard;
