import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import NepalAddressFields, {
  AREA_FIELDS,
  DetectedLocationNotice,
  emptyPlace,
  mergeDetectedPlace,
  missingPlaceFields,
} from '../components/address/NepalAddressFields';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../theme/tokens';
import useScreenLayout from '../hooks/useScreenLayout';
import useCurrentPlace from '../hooks/useCurrentPlace';
import api from '../services/api';
import { fetchLocations } from '../services/locations';
import { setUser } from '../redux/slices/authSlice';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

// Where the user lives, in Nepal's federal structure: province, district,
// municipality (local level) and ward from the official lists, plus the tole,
// village or area in their own words. "Use Current Location" fills in the
// province, district and municipality and suggests a tole; the ward is always
// the user's choice, since no current ward boundaries are openly available.
const AddressScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const saved = useSelector((state) => state.auth.user?.address);
  const layout = useScreenLayout('narrow');
  const { detect, detecting } = useCurrentPlace();

  const [tree, setTree] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(() => (saved
    ? { provinceId: saved.provinceId, districtId: saved.districtId, localLevelId: saved.localLevelId, ward: saved.ward, tole: saved.tole }
    : emptyPlace));
  // Set only when the current form came from the user's location.
  const [coordinates, setCoordinates] = useState(null);
  const [detected, setDetected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);

  const loadTree = useCallback(async () => {
    setLoadError(null);
    try {
      setTree(await fetchLocations());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  if (!tree) {
    return loadError ? (
      <View style={styles.container}>
        <EmptyState icon="offline" tone="error" title="Could not load address options" message={loadError} actionLabel="Try Again" onAction={loadTree} />
      </View>
    ) : <Spinner />;
  }

  // Changing the province, district or municipality by hand means the
  // detected coordinates no longer describe this address.
  const handleChange = (next, key) => {
    if (AREA_FIELDS.includes(key)) setCoordinates(null);
    setForm(next);
  };

  const handleUseLocation = async () => {
    const result = await detect();
    if (!result) return;
    setForm((current) => mergeDetectedPlace(current, result));
    setCoordinates(result.coordinates);
    setDetected(result);
    setTriedToSave(false);
  };

  const missing = missingPlaceFields(form);
  const errors = triedToSave ? missing : {};
  const complete = !Object.values(missing).some(Boolean);

  const handleSave = async () => {
    setTriedToSave(true);
    if (!complete) return;

    setSaving(true);
    let savedUser = null;
    try {
      const address = { ...form, tole: form.tole.trim(), ...(coordinates ? { coordinates } : {}) };
      const { data } = await api.patch('/users/me', { address });
      savedUser = data.user;
      dispatch(setUser(savedUser));
    } catch (error) {
      notify(t('profile:addressScreen.saveFailedTitle'), getErrorMessage(error));
    }
    setSaving(false);

    if (savedUser) {
      notify(t('profile:addressScreen.savedTitle'), savedUser.address?.formatted || t('profile:addressScreen.savedFallbackMessage'), () => navigation.goBack());
    }
  };

  const toleIsSuggestion = Boolean(detected?.areaName) && form.tole === detected.areaName;

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <Icon name="gps" size={iconSize.md} color={colors.primaryText} />
          </View>
          <View style={styles.locationText}>
            <Text style={styles.locationTitle}>{t('profile:addressScreen.useLocationTitle')}</Text>
            <Text style={styles.locationHint}>{t('profile:addressScreen.useLocationHint')}</Text>
          </View>
        </View>
        <Button title={t('profile:addressScreen.useLocationButton')} icon="gps" variant="tertiary" onPress={handleUseLocation} loading={detecting} />
      </Card>

      <Card style={!layout.isPhone && styles.formWide}>
        {detected && (
          <DetectedLocationNotice detected={detected} hint={t('profile:addressScreen.detectedHint')} />
        )}

        <NepalAddressFields
          tree={tree}
          value={form}
          onChange={handleChange}
          errors={errors}
          columns={!layout.isPhone}
          toleHelperText={toleIsSuggestion ? t('profile:addressScreen.toleSuggestionHint') : undefined}
        />

        <Button
          title={t('profile:addressScreen.saveButton')}
          icon="checkmark"
          onPress={handleSave}
          loading={saving}
          style={!layout.isPhone && styles.saveWide}
        />
      </Card>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { flex: 1 },
  locationTitle: { ...type.bodyMedium, color: colors.textPrimary },
  locationHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  formWide: { padding: spacing.xxl },
  saveWide: { alignSelf: 'flex-end', minWidth: 220 },
}));

export default AddressScreen;
