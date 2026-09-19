import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SelectField from '../common/SelectField';
import Input from '../common/Input';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import i18n from '../../i18n';
import { localizedName, localizedCategory } from '../../utils/helpers';

export const TOLE_MAX_LENGTH = 100;

// Beyond this, a phone's position is too rough to trust the municipality.
export const ROUGH_ACCURACY_M = 100;

export const emptyPlace = { provinceId: null, districtId: null, localLevelId: null, ward: null, tole: '' };

// Changing one of these by hand means a detected or pinned point no longer
// describes the place; choosing the ward or typing the tole doesn't.
export const AREA_FIELDS = ['provinceId', 'districtId', 'localLevelId'];

// What still needs choosing, keyed by field. `whose` words the messages for
// the form: "your" on the user's own address, "the" on a load's pickup. Each
// message has a translated "_the" variant in common.json for that case.
export const missingPlaceFields = (place, whose = 'your') => {
  const suffix = whose === 'the' ? '_the' : '';
  return {
    provinceId: !place.provinceId && i18n.t(`common:address.missing.province${suffix}`),
    districtId: !place.districtId && i18n.t(`common:address.missing.district${suffix}`),
    localLevelId: !place.localLevelId && i18n.t(`common:address.missing.municipality${suffix}`),
    ward: !place.ward && i18n.t(`common:address.missing.ward${suffix}`),
    tole: !(place.tole || '').trim() && i18n.t(`common:address.missing.tole${suffix}`),
  };
};

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

// A detected location over what was already filled in. A detected ward is used;
// otherwise the ward stays only if the municipality didn't change. A suggested
// tole replaces the typed one.
export const mergeDetectedPlace = (current, detected) => ({
  ...detected.place,
  ward: detected.ward
    || (detected.place.localLevelId && detected.place.localLevelId === current.localLevelId ? current.ward : null),
  tole: detected.areaName || current.tole,
});

// Short text for a place so far: "Basantapur, Kathmandu", or just the
// municipality or district while the rest is still being chosen.
export const shortPlaceName = (tree, place) => {
  const localLevel = tree.localLevels.find((l) => l.id === place.localLevelId);
  const district = tree.districts.find((d) => d.id === place.districtId);
  const area = localizedName(localLevel) || localizedName(district);
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
  tolePlaceholder,
  includeWardAndTole = true,
  required = true,
}) => {
  const { t } = useTranslation();
  const resolvedTolePlaceholder = tolePlaceholder ?? t('common:address.tolePlaceholderExample');
  const named = (label) => (labelPrefix ? `${labelPrefix} ${label.toLowerCase()}` : label);

  // `t` isn't read here, but it changes reference on every language switch,
  // so it doubles as the memo's cue to recompute (localizedName/localizedCategory
  // read i18n.language directly, which useMemo can't otherwise see).
  const provinceOptions = useMemo(() => tree.provinces.map((p) => ({ value: p.id, label: localizedName(p) })), [tree, t]);

  const districtOptions = useMemo(() => {
    const provinceName = Object.fromEntries(tree.provinces.map((p) => [p.id, localizedName(p)]));
    const districts = value.provinceId
      ? [
        ...tree.districts.filter((d) => d.provinceId === value.provinceId),
        ...tree.districts.filter((d) => d.provinceId !== value.provinceId),
      ]
      : tree.districts;
    return districts.map((d) => ({ value: d.id, label: localizedName(d), description: provinceName[d.provinceId], keywords: d.aliases }));
  }, [tree, value.provinceId, t]);

  const localLevelOptions = useMemo(() => tree.localLevels
    .filter((l) => l.districtId === value.districtId)
    .map((l) => ({
      value: l.id,
      label: localizedName(l),
      description: t('common:address.localLevelDescription', { category: localizedCategory(l), count: l.wards }),
      keywords: l.aliases,
    })),
  [tree, value.districtId, t]);

  const localLevel = useMemo(() => tree.localLevels.find((l) => l.id === value.localLevelId), [tree, value.localLevelId]);

  const wardOptions = useMemo(() => (localLevel
    ? Array.from({ length: localLevel.wards }, (_, i) => ({ value: i + 1, label: t('common:address.ward', { number: i + 1 }) }))
    : []), [localLevel, t]);

  const choose = (key) => (next) => onChange(choosePlaceField(tree, value, key, next), key);

  const pairStyle = columns ? styles.row : null;
  const halfStyle = columns ? styles.half : undefined;

  return (
    <View>
      <View style={pairStyle}>
        <SelectField
          label={t('common:address.province')}
          accessibilityLabel={named(t('common:address.province'))}
          required={required}
          value={value.provinceId}
          options={provinceOptions}
          onChange={choose('provinceId')}
          placeholder={t('common:address.selectProvince')}
          error={errors.provinceId}
          containerStyle={halfStyle}
        />
        <SelectField
          label={t('common:address.district')}
          accessibilityLabel={named(t('common:address.district'))}
          required={required}
          value={value.districtId}
          options={districtOptions}
          onChange={choose('districtId')}
          placeholder={t('common:address.selectDistrict')}
          error={errors.districtId}
          containerStyle={halfStyle}
        />
      </View>

      <View style={pairStyle}>
        <SelectField
          label={t('common:address.municipality')}
          accessibilityLabel={named(t('common:address.municipality'))}
          required={required}
          value={value.localLevelId}
          options={localLevelOptions}
          onChange={choose('localLevelId')}
          placeholder={value.districtId ? t('common:address.selectMunicipality') : t('common:address.chooseDistrictFirst')}
          disabled={!value.districtId}
          error={errors.localLevelId}
          containerStyle={halfStyle}
        />
        {includeWardAndTole && (
          <SelectField
            label={t('common:address.wardNumber')}
            accessibilityLabel={named(t('common:address.wardNumber'))}
            required={required}
            value={value.ward}
            options={wardOptions}
            onChange={choose('ward')}
            placeholder={localLevel ? t('common:address.selectWard') : t('common:address.chooseMunicipalityFirst')}
            disabled={!localLevel}
            error={errors.ward}
            containerStyle={halfStyle}
          />
        )}
      </View>

      {includeWardAndTole && (
        <Input
          label={t('common:address.toleVillageArea')}
          accessibilityLabel={named(t('common:address.toleVillageArea'))}
          required={required}
          value={value.tole}
          onChangeText={(tole) => onChange({ ...value, tole }, 'tole')}
          placeholder={resolvedTolePlaceholder}
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
  const { t } = useTranslation();
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
        <Text style={[styles.noticeTitle, { color: ink }]}>{t('common:address.filledFromLocation')}</Text>
      </View>
      {typeof detected.accuracy === 'number' && (
        <Text style={styles.noticeText}>
          {t('common:address.accurateTo', { meters: Math.round(detected.accuracy) })}
          {rough ? t('common:address.roughAccuracyNote') : ''}
        </Text>
      )}
      {detected.protectedArea ? (
        <Text style={styles.noticeText}>
          {t('common:address.insideProtectedArea', { protectedArea: detected.protectedArea })}
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
