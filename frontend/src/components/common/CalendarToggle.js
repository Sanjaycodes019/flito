import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CALENDARS, setCalendar, useCalendar } from '../../services/calendarPreference';
import { colors, spacing, radius, type } from '../../theme/tokens';

// A small AD / BS segmented switch for choosing the calendar dates are shown
// and picked in. The choice is global and remembered on the device, so
// changing it in one place changes it everywhere.
const CalendarToggle = ({ compact = false, style }) => {
  const { t } = useTranslation();
  const current = useCalendar();

  return (
    <View style={[styles.track, style]} accessibilityRole="radiogroup" accessibilityLabel={t('common:calendar.label')}>
      {CALENDARS.map((calendar) => {
        const active = current === calendar;
        return (
          <Pressable
            key={calendar}
            onPress={() => setCalendar(calendar)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`common:calendar.${calendar}Long`)}
            style={({ pressed }) => [styles.segment, compact && styles.segmentCompact, active && styles.segmentActive, pressed && !active && styles.segmentPressed]}
          >
            <Text style={[styles.text, compact && styles.textCompact, active && styles.textActive]}>{t(`common:calendar.${calendar}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 2, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, minWidth: 40, alignItems: 'center' },
  segmentCompact: { paddingHorizontal: spacing.sm, paddingVertical: 2, minWidth: 34 },
  segmentActive: { backgroundColor: colors.surface },
  segmentPressed: { opacity: 0.7 },
  text: { ...type.bodyMedium, color: colors.textMuted },
  textCompact: { ...type.small },
  textActive: { color: colors.textPrimary },
});

export default CalendarToggle;
