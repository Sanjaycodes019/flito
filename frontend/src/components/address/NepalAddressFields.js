import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SelectField from '../common/SelectField';
import Input from '../common/Input';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

export const TOLE_MAX_LENGTH = 100;

// Beyond this, a phone's position is too rough to trust the municipality.
export const ROUGH_ACCURACY_M = 100;

export const emptyPlace = { provinceId: null, districtId: null, localLevelId: null, ward: null, tole: '' };

// Changing one of these by hand means a detected or pinned point no longer
// describes the place; choosing the ward or typing the tole doesn't.
export const AREA_FIELDS = ['provinceId', 'districtId', 'localLevelId'];

// What still needs choosing, keyed by field. `whose` words the messages for
// the form: "your" on the user's own address, "the" on a load's pickup.
export const missingPlaceFields = (place, whose = 'your') => ({
  provinceId: !place.provinceId && `Choose ${whose} province`,
  districtId: !place.districtId && `Choose ${whose} district`,
  localLevelId: !place.localLevelId && `Choose ${whose} municipality`,
  ward: !place.ward && `Choose ${whose} ward`,
  tole: !(place.tole || '').trim() && `Enter ${whose} tole, village or area`,
});

export const isPlaceComplete = (place) => !Object.values(missingPlaceFields(place)).some(Boolean);

// The place after choosing `value` for `key`. Choosing a level clears what sat
// below it; choosing a district also sets its province.
export const choosePlaceField = (tree, place, key, value) => {
  if (place[key] === value) return place;
  if (key === 'provinceId') return { ...place, provinceId: value, districtId: null, localLevelId: null, ward: null };
  if (key === 'districtId') {
    const district = tree.districts.find((d) => d.id === value);
    return { ...place, provinceId: district?.provinceId || place.provinceId, districtId: value, localLevelId: null, ward: null };
  }
  if (key === 'localLevelId') return { ...place, localLevelId: value, ward: null };
  return { ...place, [key]: value };
};

// A detected location over what was already filled in. The ward stays only if
// the municipality didn't change, and a suggested tole replaces the typed one.
export const mergeDetectedPlace = (current, detected) => ({
  ...detected.place,
  ward: detected.place.localLevelId && detected.place.localLevelId === current.localLevelId ? current.ward : null,
  tole: detected.areaName || current.tole,
});

// Short text for a place so far: "Basantapur, Kathmandu", or just the
// municipality or district while the rest is still being chosen.
export const shortPlaceName = (tree, place) => {
  const localLevel = tree.localLevels.find((l) => l.id === place.localLevelId);
  const district = tree.districts.find((d) => d.id === place.districtId);
  const area = localLevel?.name || district?.name;
  const tole = (place.tole || '').trim();
  if (!area) return null;
  return tole && tole.toLowerCase() !== area.toLowerCase() ? `${tole}, ${area}` : area;
};

// Province, district, municipality (local level) and ward from Nepal's
// official lists, plus the tole, village or area in the user's words. Every
// district is always listed, the chosen province's first. `labelPrefix`
// ("Pickup") tells screen readers apart when a page has two addresses.
// `includeWardAndTole` off asks only for the municipality, such as where a
// truck is based.
const NepalAddressFields = ({
  tree,
  value,
  onChange,
  errors = {},
  columns = false,
  labelPrefix,
  toleHelperText,
  tolePlaceholder = 'e.g. Basantapur',
  includeWardAndTole = true,
  required = true,
}) => {
  const named = (label) => (labelPrefix ? `${labelPrefix} ${label.toLowerCase()}` : label);

  const provinceOptions = useMemo(() => tree.provinces.map((p) => ({ value: p.id, label: p.name })), [tree]);

  const districtOptions = useMemo(() => {
    const provinceName = Object.fromEntries(tree.provinces.map((p) => [p.id, p.name]));
    const districts = value.provinceId
      ? [
        ...tree.districts.filter((d) => d.provinceId === value.provinceId),
        ...tree.districts.filter((d) => d.provinceId !== value.provinceId),
      ]
      : tree.districts;
    return districts.map((d) => ({ value: d.id, label: d.name, description: provinceName[d.provinceId], keywords: d.aliases }));
  }, [tree, value.provinceId]);

  const localLevelOptions = useMemo(() => tree.localLevels
    .filter((l) => l.districtId === value.districtId)
    .map((l) => ({ value: l.id, label: l.name, description: `${l.category}, ${l.wards} wards`, keywords: l.aliases })),
  [tree, value.districtId]);

  const localLevel = useMemo(() => tree.localLevels.find((l) => l.id === value.localLevelId), [tree, value.localLevelId]);

  const wardOptions = useMemo(() => (localLevel
    ? Array.from({ length: localLevel.wards }, (_, i) => ({ value: i + 1, label: `Ward ${i + 1}` }))
    : []), [localLevel]);

  const choose = (key) => (next) => onChange(choosePlaceField(tree, value, key, next), key);

  const pairStyle = columns ? styles.row : null;
  const halfStyle = columns ? styles.half : undefined;

  return (
    <View>
      <View style={pairStyle}>
        <SelectField
          label="Province"
          accessibilityLabel={named('Province')}
          required={required}
          value={value.provinceId}
          options={provinceOptions}
          onChange={choose('provinceId')}
          placeholder="Select province"
          error={errors.provinceId}
          containerStyle={halfStyle}
        />
        <SelectField
          label="District"
          accessibilityLabel={named('District')}
          required={required}
          value={value.districtId}
          options={districtOptions}
          onChange={choose('districtId')}
          placeholder="Select district"
          error={errors.districtId}
          containerStyle={halfStyle}
        />
      </View>

      <View style={pairStyle}>
        <SelectField
          label="Municipality"
          accessibilityLabel={named('Municipality')}
          required={required}
          value={value.localLevelId}
          options={localLevelOptions}
          onChange={choose('localLevelId')}
          placeholder={value.districtId ? 'Select municipality' : 'Choose a district first'}
          disabled={!value.districtId}
          error={errors.localLevelId}
          containerStyle={halfStyle}
        />
        {includeWardAndTole && (
          <SelectField
            label="Ward Number"
            accessibilityLabel={named('Ward Number')}
            required={required}
            value={value.ward}
            options={wardOptions}
            onChange={choose('ward')}
            placeholder={localLevel ? 'Select ward' : 'Choose a municipality first'}
            disabled={!localLevel}
            error={errors.ward}
            containerStyle={halfStyle}
          />
        )}
      </View>

      {includeWardAndTole && (
        <Input
          label="Tole, Village or Area"
          accessibilityLabel={named('Tole, Village or Area')}
          required={required}
          value={value.tole}
          onChangeText={(tole) => onChange({ ...value, tole }, 'tole')}
          placeholder={tolePlaceholder}
          icon="location"
          maxLength={TOLE_MAX_LENGTH}
          error={errors.tole}
          helperText={toleHelperText}
        />
      )}
    </View>
  );
};

// Shown after "Use Current Location": how precise the fix was, and whether
// the point is inside a national park (which belongs to no municipality).
export const DetectedLocationNotice = ({ detected, hint, style }) => {
  const rough = detected.accuracy > ROUGH_ACCURACY_M;
  const ink = rough ? colors.warningText : colors.infoText;
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: rough ? colors.warningMuted : colors.infoMuted, borderLeftColor: rough ? colors.warning : colors.info },
        style,
      ]}
    >
      <View style={styles.noticeHeader}>
        <Icon name={rough ? 'warning' : 'info'} size={iconSize.md} color={ink} />
        <Text style={[styles.noticeTitle, { color: ink }]}>Filled in from your location</Text>
      </View>
      {typeof detected.accuracy === 'number' && (
        <Text style={styles.noticeText}>
          Accurate to about {Math.round(detected.accuracy)} m.
          {rough ? " That's rough, so check each field carefully." : ''}
        </Text>
      )}
      {detected.protectedArea ? (
        <Text style={styles.noticeText}>
          You seem to be inside {detected.protectedArea}, which isn&apos;t part of a municipality. Choose the municipality below.
        </Text>
      ) : null}
      {hint ? <Text style={styles.noticeText}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  half: { flex: 1, minWidth: 0 },

  notice: {
    borderLeftWidth: 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxs },
  noticeTitle: { ...type.bodyMedium },
  noticeText: { ...type.small, color: colors.textSecondary, marginTop: spacing.xxs },
});

export default NepalAddressFields;
