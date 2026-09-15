import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SelectField from './SelectField';
import Button from './Button';
import { colors, spacing, type } from '../../theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

// Days in a month; a leap year stands in until the year is chosen, so 29 Feb
// can still be picked first.
const daysIn = (year, month) => new Date(Date.UTC(year || 2024, month || 1, 0)).getUTCDate();

const parse = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : { year: null, month: null, day: null };
};

// A calendar date picked as day, month and year, which works the same on a
// phone and on the web. `value` and `onChange` use "YYYY-MM-DD", and onChange
// gets null until all three are chosen. `years` lists the years to offer.
const DateField = ({ label, value, onChange, years, required = false, error, helperText, containerStyle }) => {
  const [parts, setParts] = useState(() => parse(value));

  // A date set from outside replaces what is shown.
  useEffect(() => {
    if (value) setParts(parse(value));
  }, [value]);

  const update = (key) => (next) => {
    const merged = { ...parts, [key]: next };
    const lastDay = daysIn(merged.year, merged.month);
    if (merged.day && merged.day > lastDay) merged.day = lastDay;
    setParts(merged);
    onChange(merged.year && merged.month && merged.day ? `${merged.year}-${pad(merged.month)}-${pad(merged.day)}` : null);
  };

  const clear = () => {
    setParts({ year: null, month: null, day: null });
    onChange(null);
  };

  const started = Boolean(parts.year || parts.month || parts.day);
  const dayOptions = Array.from({ length: daysIn(parts.year, parts.month) }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const monthOptions = MONTHS.map((name, i) => ({ value: i + 1, label: name }));
  const yearOptions = years.map((year) => ({ value: year, label: String(year) }));

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {started && (
          <Button title="Clear" variant="ghost" size="sm" onPress={clear} accessibilityLabel={`Clear ${label.toLowerCase()}`} style={styles.clear} />
        )}
      </View>
      <View style={styles.row}>
        <SelectField
          label={`${label}, day`}
          showLabel={false}
          value={parts.day}
          options={dayOptions}
          onChange={update('day')}
          placeholder="Day"
          containerStyle={styles.day}
        />
        <SelectField
          label={`${label}, month`}
          showLabel={false}
          value={parts.month}
          options={monthOptions}
          onChange={update('month')}
          placeholder="Month"
          containerStyle={styles.month}
        />
        <SelectField
          label={`${label}, year`}
          showLabel={false}
          value={parts.year}
          options={yearOptions}
          onChange={update('year')}
          placeholder="Year"
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
  clear: { marginVertical: 0 },
  row: { flexDirection: 'row', gap: spacing.sm },
  day: { flex: 1, minWidth: 0, marginBottom: 0 },
  month: { flex: 1.2, minWidth: 0, marginBottom: 0 },
  year: { flex: 1.2, minWidth: 0, marginBottom: 0 },
  helper: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  error: { color: colors.errorText },
});

export default DateField;
