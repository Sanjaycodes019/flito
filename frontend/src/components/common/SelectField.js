import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Input from './Input';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

// Searching ignores case, spaces and punctuation, so "budhanil" finds
// "Budhanilkhantha".
const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Long lists get a search box; short ones don't need it.
const SEARCH_FROM = 9;

const OptionRow = ({ option, selected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onSelect}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}
      style={({ pressed }) => [styles.option, (hovered || pressed) && styles.optionActive, selected && styles.optionSelected]}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
        {!!option.description && <Text style={styles.optionDescription}>{option.description}</Text>}
      </View>
      {selected && <Icon name="checkmark" size={iconSize.md} color={colors.primaryText} />}
    </Pressable>
  );
};

// A form field for choosing one value from a list: looks like an input, opens
// a dialog of options with search for long lists. Options are
// { value, label, description?, keywords? }; keywords are extra search terms
// (such as another spelling of a place name). `accessibilityLabel` names the
// field for screen readers when the visible label repeats on one page (a
// pickup and a dropoff each have a "Province").
const SelectField = ({
  label,
  showLabel = true,
  accessibilityLabel,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error,
  helperText,
  containerStyle,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState(false);
  const resolvedPlaceholder = placeholder ?? t('common:selectField.select');

  const selected = options.find((option) => option.value === value);
  const searchable = options.length >= SEARCH_FROM;

  const visible = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return options;
    return options.filter((option) => [option.label, option.description, ...(option.keywords || [])]
      .some((text) => normalize(text).includes(needle)));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (option) => {
    onChange(option.value);
    close();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {showLabel && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <Pressable
        onPress={() => setOpen(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={selected ? `${accessibilityLabel || label}, ${selected.label}` : accessibilityLabel || label}
        style={[
          styles.field,
          hovered && !disabled && styles.fieldHovered,
          error && styles.fieldError,
          disabled && styles.fieldDisabled,
        ]}
      >
        <Text
          style={[styles.value, !selected && styles.placeholder, disabled && styles.valueDisabled]}
          numberOfLines={1}
        >
          {selected ? selected.label : resolvedPlaceholder}
        </Text>
        <Icon name="chevronDown" size={iconSize.md} color={disabled ? colors.disabledText : colors.textMuted} />
      </Pressable>

      {(error || helperText) && (
        <Text style={[styles.helper, error && styles.errorText]}>{error || helperText}</Text>
      )}

      {/* With a search box, the cursor starts there instead of on the close button. */}
      <Modal visible={open} title={label} onClose={close} focusCloseOnOpen={!searchable}>
        {searchable && (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('common:selectField.searchPlaceholder', { label: label.toLowerCase() })}
            icon="search"
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
            containerStyle={styles.search}
          />
        )}
        {visible.length === 0 ? (
          <Text style={styles.empty}>{t('common:selectField.noMatches')}</Text>
        ) : (
          <View style={styles.list}>
            {visible.map((option) => (
              <OptionRow
                key={String(option.value)}
                option={option}
                selected={option.value === value}
                onSelect={() => choose(option)}
              />
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  required: { color: colors.errorText },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldHovered: { borderColor: colors.borderStrong },
  fieldError: { borderColor: colors.error },
  fieldDisabled: { backgroundColor: colors.surfaceMuted },
  value: { ...type.body, fontSize: 16, color: colors.textPrimary, flex: 1 },
  placeholder: { color: colors.textMuted },
  valueDisabled: { color: colors.disabledText },
  helper: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  errorText: { color: colors.errorText },

  search: { marginBottom: spacing.sm },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  optionActive: { backgroundColor: colors.surfaceMuted },
  optionSelected: { backgroundColor: colors.primaryMuted },
  optionText: { flex: 1 },
  optionLabel: { ...type.body, color: colors.textPrimary },
  optionLabelSelected: { ...type.bodyMedium, color: colors.primaryText },
  optionDescription: { ...type.small, color: colors.textMuted, marginTop: 1 },
  empty: { ...type.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
});

export default SelectField;
