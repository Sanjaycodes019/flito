import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SelectField from './SelectField';
import Button from './Button';
import CalendarToggle from './CalendarToggle';
import { useCalendar } from '../../services/calendarPreference';
import { adToBs, bsToAd, daysInBsMonth, localizeDigits, BS_MAX_YEAR } from '../../utils/bsCalendar';
import { colors, spacing, type } from '../../theme/tokens';

const pad = (n) => String(n).padStart(2, '0');
const EMPTY = { year: null, month: null, day: null };

// Days in a month; a leap year (or a long BS year) stands in until the year is
// chosen, so 29 Feb (or the 32nd) can still be picked first.
const daysIn = (calendar, year, month) => {
  if (calendar === 'bs') return daysInBsMonth(year || 2083, month || 1) || 32;
  return new Date(Date.UTC(year || 2024, month || 1, 0)).getUTCDate();
};

// The parts of an AD "YYYY-MM-DD" value in the calendar being shown.
const partsOf = (value, calendar) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return EMPTY;
  if (calendar === 'bs') return adToBs(match[0]) || EMPTY;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

// The AD "YYYY-MM-DD" for parts in the calendar being shown, or null until complete.
const valueOf = ({ year, month, day }, calendar) => {
  if (!year || !month || !day) return null;
  return calendar === 'bs' ? bsToAd(year, month, day) : `${year}-${pad(month)}-${pad(day)}`;
};

// The BS years that cover a list of AD years.
const bsYearsFor = (adYears) => {
  const first = adToBs(`${Math.min(...adYears)}-01-01`)?.year;
  const last = adToBs(`${Math.max(...adYears)}-12-31`)?.year || BS_MAX_YEAR;
  if (!first) return [];
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
};

// A calendar date picked as day, month and year, in the calendar the user
// chose (AD or Bikram Sambat), which works the same on a phone and on the web.
// `value` and `onChange` always use the AD day "YYYY-MM-DD", and onChange gets
// null until all three are chosen. `years` lists the AD years to offer.
const DateField = ({ label, value, onChange, years, required = false, error, helperText, containerStyle }) => {
  const { t, i18n } = useTranslation();
  const calendar = useCalendar();
  const isBs = calendar === 'bs';
  const months = t(isBs ? 'common:dateField.bsMonths' : 'common:dateField.months', { returnObjects: true });
  const [parts, setParts] = useState(() => partsOf(value, calendar));

  // A date set from outside, or a change of calendar, replaces what is shown.
  useEffect(() => {
    setParts((current) => (value || current === EMPTY ? partsOf(value, calendar) : current));
  }, [value, calendar]);

  const update = (key) => (next) => {
    const merged = { ...parts, [key]: next };
    const lastDay = daysIn(calendar, merged.year, merged.month);
    if (merged.day && merged.day > lastDay) merged.day = lastDay;
    setParts(merged);
    onChange(valueOf(merged, calendar));
  };

  const clear = () => {
    setParts(EMPTY);
    onChange(null);
  };

  const started = Boolean(parts.year || parts.month || parts.day);
  const numeral = (n) => (isBs ? localizeDigits(n, i18n.language) : String(n));
  const dayOptions = Array.from({ length: daysIn(calendar, parts.year, parts.month) }, (_, i) => ({ value: i + 1, label: numeral(i + 1) }));
  const monthOptions = months.map((name, i) => ({ value: i + 1, label: name }));
  const yearOptions = (isBs ? bsYearsFor(years) : years).map((year) => ({ value: year, label: numeral(year) }));

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        <CalendarToggle compact style={styles.toggle} />
        {started && (
          <Button title={t('common:dateField.clear')} variant="ghost" size="sm" onPress={clear} accessibilityLabel={t('common:dateField.clearLabel', { label: label.toLowerCase() })} style={styles.clear} />
        )}
      </View>
      <View style={styles.row}>
        <SelectField
          label={`${label}, day`}
          showLabel={false}
          value={parts.day}
          options={dayOptions}
          onChange={update('day')}
          placeholder={t('common:dateField.day')}
          containerStyle={styles.day}
        />
        <SelectField
          label={`${label}, month`}
          showLabel={false}
          value={parts.month}
          options={monthOptions}
          onChange={update('month')}
          placeholder={t('common:dateField.month')}
          containerStyle={styles.month}
        />
        <SelectField
          label={`${label}, year`}
          showLabel={false}
          value={parts.year}
          options={yearOptions}
          onChange={update('year')}
          placeholder={t('common:dateField.year')}
          containerStyle={styles.year}
        />
      </View>
      {error || helperText ? <Text style={[styles.helper, error && styles.error]}>{error || helperText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: spacing.xs },
  label: { ...type.smallMedium, color: colors.textSecondary, flex: 1 },
  required: { color: colors.errorText },
  toggle: { marginRight: spacing.sm },
  clear: { marginVertical: 0 },
  row: { flexDirection: 'row', gap: spacing.sm },
  day: { flex: 1, minWidth: 0, marginBottom: 0 },
  month: { flex: 1.2, minWidth: 0, marginBottom: 0 },
  year: { flex: 1.2, minWidth: 0, marginBottom: 0 },
  helper: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  error: { color: colors.errorText },
});

export default DateField;
