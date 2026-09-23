import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SelectField from '../../components/common/SelectField';
import DateField from '../../components/common/DateField';
import Disclosure from '../../components/common/Disclosure';
import StepWizard from '../../components/common/StepWizard';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { StatusPill } from '../../components/common/SettingsList';
import NepalAddressFields, { emptyPlace } from '../../components/address/NepalAddressFields';
import VerifiedBadge from '../../components/common/VerifiedBadge';
import PhotoSourceButtons from '../../components/common/PhotoSourceButtons';
import DocumentTile from '../../components/kyc/DocumentTile';
import MyDriversSection from '../../components/fleet/MyDriversSection';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import {
  BODY_TYPES,
  FLEET_TRUCK_TYPES,
  FUEL_TYPES,
  INSURANCE_TYPES,
  LEGACY_TRUCK_TYPES,
  MAX_DOCUMENT_BYTES,
  SERVICE_AREAS,
  TRUCK_DOCUMENT_LABELS,
  TRUCK_FEATURES,
  TRUCK_MAKES,
} from '../../utils/constants';
import {
  bodyTypeLabel, formatCurrency, formatKg, getErrorMessage, truckFeatureLabel, truckTypeLabel,
} from '../../utils/helpers';
import { nepalDay } from '../../utils/nepalDate';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
import socketService from '../../services/socket';
import { pickDocument, takePhoto, uploadFiles } from '../../services/uploads';
import { fetchLocations } from '../../services/locations';
import useScreenLayout from '../../hooks/useScreenLayout';

const MAX_CAPACITY_KG = 60000;
const MAX_CARGO_BED_FT = 60;
// Papers running out within this many days are flagged on the truck.
const PAPER_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const DOCUMENT_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 /-]{2,29}$/;
const FEET = /^\d{1,2}(\.\d)?$/;

const typeFor = (value) => [...FLEET_TRUCK_TYPES, ...LEGACY_TRUCK_TYPES].find((option) => option.value === value);

const currentYear = () => Number(nepalDay().slice(0, 4));

// "Budhanilkantha, Kathmandu", or "Kathmandu" where the names match.
const areaName = (tree, area) => {
  const localLevel = tree?.localLevels.find((l) => l.id === area?.localLevelId);
  const district = tree?.districts.find((d) => d.id === area?.districtId);
  if (!localLevel || !district) return null;
  return localLevel.name === district.name ? localLevel.name : `${localLevel.name}, ${district.name}`;
};

// "within its province" / "within its district", to note beside the base.
const serviceAreaNote = (value, t) => ({
  province: t('trucks:fleet.card.serviceAreaNoteProvince'),
  district: t('trucks:fleet.card.serviceAreaNoteDistrict'),
}[value]);

const pricingText = (truck, t) => (truck.ratePerKm
  ? t('trucks:fleet.card.pricingRate', { rate: formatCurrency(truck.ratePerKm) })
    + (truck.minimumCharge ? t('trucks:fleet.card.pricingWithMinimum', { minimum: formatCurrency(truck.minimumCharge) }) : '')
  : null);

const dayKeyOf = (date) => (date ? String(date).slice(0, 10) : null);
const textOf = (value) => (value == null ? '' : String(value));

// Whether a paper with this end date is current, running out, or lapsed.
const paperStatus = (date, t) => {
  if (!date) return null;
  const days = Math.floor((Date.parse(`${dayKeyOf(date)}T00:00:00Z`) - Date.parse(`${nepalDay()}T00:00:00Z`)) / DAY_MS);
  if (days < 0) return { tone: 'error', text: t('trucks:fleet.card.paperExpired') };
  if (days <= PAPER_WARNING_DAYS) {
    return { tone: 'warning', text: days === 0 ? t('trucks:fleet.card.paperEndsToday') : t('trucks:fleet.card.paperEndsIn', { count: days }) };
  }
  return { tone: 'success', text: t('trucks:fleet.card.paperCurrent') };
};

const ManageFleet = () => {
  const scrollRef = useRef(null);
  const toTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });
  const { t } = useTranslation();
  const [trucks, setTrucks] = useState([]);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Bumped on pull-to-refresh so the drivers list reloads with the trucks.
  const [refreshKey, setRefreshKey] = useState(0);
  const layout = useScreenLayout('narrow');
  const wide = !layout.isPhone;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/trucks');
      setTrucks(data.trucks);
    } catch (error) {
      notify(t('trucks:fleet.errorTitle'), getErrorMessage(error));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        load(),
        fetchLocations().then(setTree).catch(() => setTree(null)),
      ]);
      setLoading(false);
    })();
  }, [load]);

  // An admin's decision on a truck shows up without a manual refresh.
  useEffect(() => {
    const onReviewed = () => { load(); };
    socketService.on('truck-reviewed', onReviewed);
    return () => socketService.off('truck-reviewed', onReviewed);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
    await load();
    setRefreshing(false);
  };

  const runAction = async (truckId, fn) => {
    setBusyId(truckId);
    try {
      await fn();
      await load();
    } catch (error) {
      notify(t('trucks:fleet.errorTitle'), getErrorMessage(error));
    }
    setBusyId(null);
  };

  const handleDelete = (truck) => {
    confirmAction({
      title: t('trucks:fleet.removeTruckTitle'),
      message: t('trucks:fleet.removeTruckMessage', { registrationNumber: truck.registrationNumber }),
      confirmLabel: t('trucks:fleet.removeButton'),
      destructive: true,
      onConfirm: () => runAction(truck._id, () => api.delete(`/trucks/${truck._id}`)),
    });
  };

  const handleSaved = async () => {
    setAdding(false);
    setEditingId(null);
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{t('trucks:fleet.truckCount', { count: trucks.length })}</Text>
          <Text style={styles.headerHint}>{t('trucks:fleet.headerHint')}</Text>
        </View>
        {!adding && (
          <Button title={t('trucks:fleet.addTruckButton')} icon="add" size="sm" onPress={() => { setAdding(true); setEditingId(null); }} style={styles.addButton} />
        )}
      </View>

      {adding && <TruckForm tree={tree} wide={wide} onSaved={handleSaved} onCancel={() => setAdding(false)} onStepChange={toTop} />}

      {trucks.length === 0 && !adding && (
        <EmptyState icon="fleet" title={t('trucks:fleet.emptyTitle')} message={t('trucks:fleet.emptyMessage')} />
      )}

      {trucks.map((truck) => (editingId === truck._id ? (
        <TruckForm key={truck._id} tree={tree} wide={wide} truck={truck} onSaved={handleSaved} onCancel={() => setEditingId(null)} onStepChange={toTop} />
      ) : (
        <TruckCard
          key={truck._id}
          truck={truck}
          tree={tree}
          busy={busyId === truck._id}
          onChanged={load}
          onEdit={() => { setEditingId(truck._id); setAdding(false); }}
          onAssignDriver={(driverPhone) =>
            runAction(truck._id, () => api.patch(`/trucks/${truck._id}/driver`, { driverPhone }))
          }
          onSetStatus={(status) =>
            runAction(truck._id, () => api.patch(`/trucks/${truck._id}`, { status }))
          }
          onDelete={() => handleDelete(truck)}
        />
      )))}

      <MyDriversSection refreshKey={refreshKey} />
    </ScrollView>
  );
};

// A picture for each choice, so a truck or body can be picked by looking.
const TYPE_ICONS = { pickup: 'truckPickup', 'mini-truck': 'truckSmall', 'light-truck': 'truckMedium', '6-wheeler': 'truckLarge', '10-wheeler': 'truckContainer', '12-wheeler': 'truckTrailer', trailer: 'truckTrailer', other: 'goodsOther', '6-ton': 'truckLarge', '10-ton': 'truckLarge', '14-ton': 'truckContainer', '18-wheeler': 'truckTrailer' };
const BODY_ICONS = { open: 'load', covered: 'truckContainer', flatbed: 'bodyFlatbed', tipper: 'bodyTipper', tanker: 'bodyTanker', refrigerated: 'bodyCold' };
const FUEL_ICONS = { diesel: 'fuel', petrol: 'fuel', electric: 'electric' };
const AREA_ICONS = { nepal: 'area', province: 'area', district: 'area' };

// Cards to pick one option from, each with an optional description and examples.
const OptionGrid = ({ options, value, onChange, columns, allowClear = false, icons }) => (
  <View style={styles.optionGrid} accessibilityRole="radiogroup">
    {options.map((option) => {
      const selected = value === option.value;
      const icon = icons?.[option.value];
      return (
        <View key={option.value} style={[styles.optionCell, { width: `${100 / columns}%` }]}>
          <Pressable
            onPress={() => onChange(selected && allowClear ? null : option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[styles.option, selected && styles.optionSelected]}
          >
            {icon ? <Icon name={icon} size={24} color={selected ? colors.primaryText : colors.textSecondary} style={styles.optionIcon} /> : null}
            <View style={styles.optionTop}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]} numberOfLines={2}>{option.label}</Text>
              {selected && <Icon name="checkmark" size={iconSize.sm} color={colors.primaryText} />}
            </View>
            {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
            {option.examples ? <Text style={styles.optionExamples} numberOfLines={2}>{option.examples}</Text> : null}
          </Pressable>
        </View>
      );
    })}
  </View>
);

const CheckRow = ({ label, description, checked, onToggle }) => (
  <Pressable
    onPress={onToggle}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    accessibilityLabel={label}
    style={[styles.checkRow, checked && styles.checkRowChecked]}
  >
    <Icon name={checked ? 'checkboxOn' : 'checkboxOff'} size={iconSize.lg} color={checked ? colors.primaryText : colors.textMuted} />
    <View style={styles.checkText}>
      <Text style={styles.checkLabel}>{label}</Text>
      {description ? <Text style={styles.checkDescription}>{description}</Text> : null}
    </View>
  </Pressable>
);

// Adds a truck, or edits one when `truck` is given (the registration can't
// change). Filled in the way a truck is described on its bluebook in Nepal.
const TruckForm = ({ tree, truck, wide, onSaved, onCancel, onStepChange }) => {
  const { t } = useTranslation();
  const editing = Boolean(truck);
  const startType = truck?.truckType || '6-wheeler';
  const year = currentYear();

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [truckType, setTruckType] = useState(startType);
  const [capacity, setCapacity] = useState(() => textOf(truck?.capacity || typeFor(startType)?.capacity));
  const [make, setMake] = useState(truck?.make || null);
  const [model, setModel] = useState(truck?.model || (!truck?.make && truck?.makeModel) || '');
  const [manufactured, setManufactured] = useState(truck?.year || null);
  const [fuelType, setFuelType] = useState(truck?.fuelType || 'diesel');
  const [bodyType, setBodyType] = useState(truck?.bodyType || 'open');
  const [bed, setBed] = useState({
    lengthFt: textOf(truck?.cargoBed?.lengthFt),
    widthFt: textOf(truck?.cargoBed?.widthFt),
    heightFt: textOf(truck?.cargoBed?.heightFt),
  });
  const [features, setFeatures] = useState(() => Object.fromEntries(
    TRUCK_FEATURES.map((feature) => [feature.key, Boolean(truck?.features?.[feature.key])]),
  ));
  const [base, setBase] = useState(() => ({ ...emptyPlace, ...(truck?.baseLocation || {}) }));
  const [serviceArea, setServiceArea] = useState(truck?.serviceArea || 'nepal');
  const [ratePerKm, setRatePerKm] = useState(textOf(truck?.ratePerKm));
  const [minimumCharge, setMinimumCharge] = useState(textOf(truck?.minimumCharge));
  const [chassisNumber, setChassisNumber] = useState(truck?.chassisNumber || '');
  const [engineNumber, setEngineNumber] = useState(truck?.engineNumber || '');
  const [bluebookUntil, setBluebookUntil] = useState(dayKeyOf(truck?.bluebookRenewedUntil));
  const [insuranceType, setInsuranceType] = useState(truck?.insurance?.type || null);
  const [insuranceCompany, setInsuranceCompany] = useState(truck?.insurance?.company || '');
  const [policyNumber, setPolicyNumber] = useState(truck?.insurance?.policyNumber || '');
  const [insuranceUntil, setInsuranceUntil] = useState(dayKeyOf(truck?.insurance?.validUntil));
  const [emissionUntil, setEmissionUntil] = useState(dayKeyOf(truck?.emissionTestValidUntil));
  const [triedToSave, setTriedToSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const legacyType = LEGACY_TRUCK_TYPES.find((option) => option.value === truckType);
  const rawTypeOptions = legacyType ? [...FLEET_TRUCK_TYPES, legacyType] : FLEET_TRUCK_TYPES;
  const typeOptions = rawTypeOptions.map((option) => ({
    ...option,
    label: t(`trucks:types.${option.value}.label`, option.label),
    description: t(`trucks:types.${option.value}.description`, option.description),
    examples: t(`trucks:types.${option.value}.examples`, option.examples),
  }));
  const bodyTypeOptions = BODY_TYPES.map((option) => ({
    ...option,
    label: t(`trucks:bodyTypes.${option.value}.label`, option.label),
    description: t(`trucks:bodyTypes.${option.value}.description`, option.description),
  }));
  const fuelTypeOptions = FUEL_TYPES.map((option) => ({
    ...option,
    label: t(`trucks:fuelTypes.${option.value}.label`, option.label),
  }));
  const serviceAreaOptions = SERVICE_AREAS.map((option) => ({
    ...option,
    label: t(`trucks:serviceAreas.${option.value}.label`, option.label),
    description: t(`trucks:serviceAreas.${option.value}.description`, option.description),
  }));
  const insuranceTypeOptions = INSURANCE_TYPES.map((option) => ({
    ...option,
    label: t(`trucks:insuranceTypes.${option.value}.label`, option.label),
    description: t(`trucks:insuranceTypes.${option.value}.description`, option.description),
  }));
  const makeOptions = TRUCK_MAKES.map((name) => ({ value: name, label: name }));
  const manufactureYears = Array.from({ length: year + 1 - 1990 + 1 }, (_, i) => year + 1 - i)
    .map((value) => ({ value, label: String(value) }));
  const expiryYears = Array.from({ length: 7 }, (_, i) => year - 1 + i);

  // The current type's examples (translated), for a model placeholder like "e.g. Bolero".
  const typeExamples = typeFor(truckType)?.examples ? t(`trucks:types.${truckType}.examples`, typeFor(truckType).examples) : null;
  const modelExample = typeExamples ? (typeExamples.split(', ')[0].split(' ').slice(1).join(' ') || '1613') : '1613';

  // A capacity still at the old class's usual figure follows the new class.
  const chooseType = (value) => {
    const previous = typeFor(truckType)?.capacity;
    if (!capacity.trim() || Number(capacity) === previous) setCapacity(textOf(typeFor(value)?.capacity));
    setTruckType(value);
  };

  const baseStarted = Boolean(base.provinceId || base.districtId || base.localLevelId);
  const baseComplete = Boolean(base.provinceId && base.districtId && base.localLevelId);
  const bedProblem = (text) => text.trim() && (!FEET.test(text.trim()) || Number(text) < 1 || Number(text) > MAX_CARGO_BED_FT)
    && t('trucks:fleet.errors.feetFormat');
  const numberProblem = (text) => text.trim() && !DOCUMENT_NUMBER.test(text.trim()) && t('trucks:fleet.errors.documentNumberFormat');

  const errors = {
    registrationNumber: !editing && !registrationNumber.trim() && t('trucks:fleet.errors.registrationNumberRequired'),
    capacity: (!/^\d+$/.test(capacity.trim()) || Number(capacity) < 100 || Number(capacity) > MAX_CAPACITY_KG)
      && t('trucks:fleet.errors.capacityRange', { max: MAX_CAPACITY_KG.toLocaleString('en-NP') }),
    lengthFt: bedProblem(bed.lengthFt),
    widthFt: bedProblem(bed.widthFt),
    heightFt: bedProblem(bed.heightFt),
    base: (baseStarted && !baseComplete && t('trucks:fleet.errors.baseIncomplete'))
      || (serviceArea !== 'nepal' && !baseComplete && t('trucks:fleet.errors.baseRequiredForServiceArea')),
    ratePerKm: ratePerKm.trim()
      && (!/^\d+(\.\d{1,2})?$/.test(ratePerKm.trim()) || Number(ratePerKm) <= 0 || Number(ratePerKm) > 1000)
      && t('trucks:fleet.errors.ratePerKmFormat'),
    minimumCharge: minimumCharge.trim() && !/^\d+$/.test(minimumCharge.trim()) && t('trucks:fleet.errors.minimumChargeFormat'),
    chassisNumber: numberProblem(chassisNumber),
    engineNumber: numberProblem(engineNumber),
  };
  const shown = (key) => (triedToSave ? errors[key] || null : null);

  const handleSave = async () => {
    setTriedToSave(true);
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    const feet = (text) => (text.trim() ? Number(text) : null);
    const hasBed = Boolean(bed.lengthFt.trim() || bed.widthFt.trim() || bed.heightFt.trim());
    const hasInsurance = Boolean(insuranceType || insuranceCompany.trim() || policyNumber.trim() || insuranceUntil);

    const body = {
      truckType,
      bodyType,
      capacity: Number(capacity),
      make,
      model: model.trim() || null,
      year: manufactured,
      fuelType,
      cargoBed: hasBed ? { lengthFt: feet(bed.lengthFt), widthFt: feet(bed.widthFt), heightFt: feet(bed.heightFt) } : null,
      features,
      baseLocation: baseComplete
        ? { provinceId: base.provinceId, districtId: base.districtId, localLevelId: base.localLevelId }
        : null,
      serviceArea,
      ratePerKm: ratePerKm.trim() ? Number(ratePerKm) : null,
      minimumCharge: minimumCharge.trim() ? Number(minimumCharge) : null,
      chassisNumber: chassisNumber.trim() || null,
      engineNumber: engineNumber.trim() || null,
      bluebookRenewedUntil: bluebookUntil,
      insurance: hasInsurance
        ? { type: insuranceType, company: insuranceCompany.trim() || null, policyNumber: policyNumber.trim() || null, validUntil: insuranceUntil }
        : null,
      emissionTestValidUntil: emissionUntil,
    };

    setSaving(true);
    try {
      if (editing) await api.patch(`/trucks/${truck._id}`, body);
      else await api.post('/trucks', { registrationNumber: registrationNumber.trim(), ...body });
    } catch (error) {
      notify(t('trucks:fleet.saveTruckErrorTitle'), getErrorMessage(error));
      setSaving(false);
      return;
    }
    setSaving(false);
    await onSaved();
  };

  const pair = wide ? styles.row : null;
  const half = wide ? styles.half : undefined;

  const clean = (...keys) => () => keys.every((key) => !errors[key]);
  const stepText = (key) => ({ title: t(`trucks:fleet.steps.${key}.title`), hint: t(`trucks:fleet.steps.${key}.hint`) });
  const anyError = Object.values(errors).some(Boolean);
  const chosenType = typeOptions.find((option) => option.value === truckType);
  const chosenBody = bodyTypeOptions.find((option) => option.value === bodyType);
  const chosenArea = serviceAreaOptions.find((option) => option.value === serviceArea);
  const paperFields = [bluebookUntil, insuranceUntil, emissionUntil, chassisNumber.trim(), engineNumber.trim(), insuranceType];
  const featureCount = Object.values(features).filter(Boolean).length;

  const steps = [
    {
      key: 'truck',
      icon: 'truckLarge',
      ...stepText('truck'),
      check: clean('registrationNumber', 'capacity'),
      content: (
        <>
        {!editing && (
          <Input
            label={t('trucks:fleet.registrationNumberLabel')}
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder={t('trucks:fleet.registrationNumberPlaceholder')}
            autoCapitalize="characters"
            icon="truck"
            required
            maxLength={30}
            error={shown('registrationNumber')}
            helperText={t('trucks:fleet.registrationNumberHelper')}
          />
        )}

        <Text style={styles.fieldLabel}>
          {t('trucks:fleet.truckTypeFieldLabel')}
          <Text style={styles.required}> *</Text>
        </Text>
        <OptionGrid icons={TYPE_ICONS} options={typeOptions} value={truckType} onChange={chooseType} columns={wide ? 4 : 2} />

        <View style={pair}>
          <Input
            label={t('trucks:fleet.capacityLabel')}
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="numeric"
            placeholder={t('trucks:fleet.capacityPlaceholder')}
            icon="weight"
            required
            error={shown('capacity')}
            helperText={t('trucks:fleet.capacityHelper')}
            containerStyle={half}
          />
          <SelectField
            label={t('trucks:fleet.makeLabel')}
            value={make}
            options={makeOptions}
            onChange={setMake}
            placeholder={t('trucks:fleet.makePlaceholder')}
            containerStyle={half}
          />
        </View>


        </>
      ),
    },
    {
      key: 'about',
      icon: 'truckContainer',
      ...stepText('about'),
      optional: true,
      isEmpty: () => !model.trim() && !manufactured && !bed.lengthFt.trim() && !bed.widthFt.trim() && !bed.heightFt.trim(),
      check: clean('lengthFt', 'widthFt', 'heightFt'),
      content: (
        <>
        <View style={pair}>
          <Input
            label={t('trucks:fleet.modelLabel')}
            value={model}
            onChangeText={setModel}
            placeholder={t('trucks:fleet.modelPlaceholder', { example: modelExample })}
            icon="truck"
            maxLength={40}
            containerStyle={half}
          />
          <SelectField
            label={t('trucks:fleet.yearLabel')}
            value={manufactured}
            options={manufactureYears}
            onChange={setManufactured}
            placeholder={t('trucks:fleet.yearPlaceholder')}
            containerStyle={half}
          />
        </View>

        <Text style={styles.fieldLabel}>{t('trucks:fleet.fuelFieldLabel')}</Text>
        <OptionGrid icons={FUEL_ICONS} options={fuelTypeOptions} value={fuelType} onChange={setFuelType} columns={3} />
        <Text style={styles.fieldLabel}>
          {t('trucks:fleet.bodyTypeFieldLabel')}
          <Text style={styles.required}> *</Text>
        </Text>
        <OptionGrid icons={BODY_ICONS} options={bodyTypeOptions} value={bodyType} onChange={setBodyType} columns={wide ? 3 : 2} />

        <Text style={styles.fieldLabel}>{t('trucks:fleet.cargoBedFieldLabel')}</Text>
        <View style={styles.row}>
          <Input
            label={t('trucks:fleet.lengthLabel')}
            value={bed.lengthFt}
            onChangeText={(lengthFt) => setBed((current) => ({ ...current, lengthFt }))}
            keyboardType="numeric"
            placeholder={t('trucks:fleet.lengthPlaceholder')}
            error={shown('lengthFt')}
            containerStyle={styles.third}
          />
          <Input
            label={t('trucks:fleet.widthLabel')}
            value={bed.widthFt}
            onChangeText={(widthFt) => setBed((current) => ({ ...current, widthFt }))}
            keyboardType="numeric"
            placeholder={t('trucks:fleet.widthPlaceholder')}
            error={shown('widthFt')}
            containerStyle={styles.third}
          />
          <Input
            label={t('trucks:fleet.heightLabel')}
            value={bed.heightFt}
            onChangeText={(heightFt) => setBed((current) => ({ ...current, heightFt }))}
            keyboardType="numeric"
            placeholder={t('trucks:fleet.heightPlaceholder')}
            error={shown('heightFt')}
            containerStyle={styles.third}
          />
        </View>
        </>
      ),
    },
    {
      key: 'where',
      icon: 'area',
      ...stepText('where'),
      optional: true,
      isEmpty: () => !baseStarted && serviceArea === 'nepal',
      check: clean('base'),
      content: (
        <>
        {tree ? (
          <NepalAddressFields
            tree={tree}
            value={base}
            onChange={setBase}
            columns={wide}
            labelPrefix={t('trucks:fleet.baseLabel')}
            includeWardAndTole={false}
            required={false}
          />
        ) : (
          <Text style={styles.hint}>{t('trucks:fleet.noLocationList')}</Text>
        )}
        {shown('base') ? <Text style={styles.errorText}>{shown('base')}</Text> : null}
        {baseStarted && (
          <Button title={t('trucks:fleet.clearBaseButton')} icon="close" variant="ghost" size="sm" onPress={() => setBase(emptyPlace)} style={styles.clearBase} />
        )}

        <Text style={styles.fieldLabel}>{t('trucks:fleet.serviceAreaFieldLabel')}</Text>
        <OptionGrid icons={AREA_ICONS} options={serviceAreaOptions} value={serviceArea} onChange={setServiceArea} columns={wide ? 3 : 1} />
        </>
      ),
    },
    {
      key: 'price',
      icon: 'price',
      ...stepText('price'),
      optional: true,
      isEmpty: () => !ratePerKm.trim() && !minimumCharge.trim() && featureCount === 0,
      check: clean('ratePerKm', 'minimumCharge'),
      content: (
        <>
        <View style={pair}>
          <Input
            label={t('trucks:fleet.ratePerKmLabel')}
            value={ratePerKm}
            onChangeText={setRatePerKm}
            keyboardType="numeric"
            placeholder={t('trucks:fleet.ratePerKmPlaceholder')}
            icon="price"
            error={shown('ratePerKm')}
            containerStyle={half}
          />
          <Input
            label={t('trucks:fleet.minimumChargeLabel')}
            value={minimumCharge}
            onChangeText={setMinimumCharge}
            keyboardType="numeric"
            placeholder={t('trucks:fleet.minimumChargePlaceholder')}
            icon="price"
            error={shown('minimumCharge')}
            containerStyle={half}
          />
        </View>
          <Text style={styles.fieldLabel}>{t('trucks:fleet.featuresSection')}</Text>
        <View style={styles.featureGrid}>
          {TRUCK_FEATURES.map((feature) => (
            <View key={feature.key} style={[styles.featureCell, { width: wide ? '50%' : '100%' }]}>
              <CheckRow
                label={t(`trucks:features.${feature.key}.label`, feature.label)}
                description={t(`trucks:features.${feature.key}.description`, feature.description)}
                checked={features[feature.key]}
                onToggle={() => setFeatures((current) => ({ ...current, [feature.key]: !current[feature.key] }))}
              />
            </View>
          ))}
        </View>
        </>
      ),
    },
    {
      key: 'papers',
      icon: 'document',
      ...stepText('papers'),
      optional: true,
      isEmpty: () => paperFields.every((value) => !value),
      check: clean('chassisNumber', 'engineNumber'),
      content: (
        <>
          <View style={pair}>
            <Input
              label={t('trucks:fleet.chassisNumberLabel')}
              value={chassisNumber}
              onChangeText={setChassisNumber}
              autoCapitalize="characters"
              placeholder={t('trucks:fleet.documentNumberPlaceholder')}
              maxLength={30}
              error={shown('chassisNumber')}
              containerStyle={half}
            />
            <Input
              label={t('trucks:fleet.engineNumberLabel')}
              value={engineNumber}
              onChangeText={setEngineNumber}
              autoCapitalize="characters"
              placeholder={t('trucks:fleet.documentNumberPlaceholder')}
              maxLength={30}
              error={shown('engineNumber')}
              containerStyle={half}
            />
          </View>

          <DateField
            label={t('trucks:fleet.bluebookUntilLabel')}
            value={bluebookUntil}
            onChange={setBluebookUntil}
            years={expiryYears}
            helperText={t('trucks:fleet.bluebookUntilHelper')}
          />

          <Text style={styles.fieldLabel}>{t('trucks:fleet.insuranceFieldLabel')}</Text>
          <OptionGrid options={insuranceTypeOptions} value={insuranceType} onChange={setInsuranceType} columns={2} allowClear />
          <View style={pair}>
            <Input
              label={t('trucks:fleet.insuranceCompanyLabel')}
              value={insuranceCompany}
              onChangeText={setInsuranceCompany}
              placeholder={t('trucks:fleet.insuranceCompanyPlaceholder')}
              maxLength={60}
              containerStyle={half}
            />
            <Input
              label={t('trucks:fleet.policyNumberLabel')}
              value={policyNumber}
              onChangeText={setPolicyNumber}
              placeholder={t('trucks:fleet.policyNumberPlaceholder')}
              maxLength={40}
              containerStyle={half}
            />
          </View>
          <DateField
            label={t('trucks:fleet.insuranceUntilLabel')}
            value={insuranceUntil}
            onChange={setInsuranceUntil}
            years={expiryYears}
            helperText={t('trucks:fleet.insuranceUntilHelper')}
          />

          <DateField
            label={t('trucks:fleet.emissionUntilLabel')}
            value={emissionUntil}
            onChange={setEmissionUntil}
            years={expiryYears}
          />
        </>
      ),
    },
    {
      key: 'review',
      icon: 'success',
      ...stepText('review'),
      content: (
        <Card>
          <ReviewRow label={t('trucks:fleet.review.plate')} value={editing ? truck.registrationNumber : registrationNumber.trim()} />
          <ReviewRow label={t('trucks:fleet.review.type')} value={chosenType?.label} />
          <ReviewRow label={t('trucks:fleet.review.capacity')} value={capacity.trim() ? `${Number(capacity).toLocaleString('en-NP')} kg` : null} />
          <ReviewRow label={t('trucks:fleet.review.body')} value={chosenBody?.label} />
          <ReviewRow label={t('trucks:fleet.review.area')} value={chosenArea?.label} />
          <ReviewRow label={t('trucks:fleet.review.rate')} value={ratePerKm.trim() ? `Rs. ${ratePerKm.trim()} / km` : null} />
          {triedToSave && anyError ? (
            <View style={styles.warning}>
              <Icon name="warning" size={iconSize.sm} color={colors.errorText} />
              <Text style={styles.warningText}>{t('trucks:fleet.review.fixHint')}</Text>
            </View>
          ) : null}
        </Card>
      ),
    },
  ];

  return (
    <Card style={wide && styles.formWide}>
      <Text style={styles.formTitle}>
        {editing ? t('trucks:fleet.editTruckTitle', { registrationNumber: truck.registrationNumber }) : t('trucks:fleet.addTruckTitle')}
      </Text>
      {editing && ['approved', 'pending'].includes(truck.verification?.status) && (
        <View style={styles.warning}>
          <Icon name="warning" size={iconSize.sm} color={colors.warningText} />
          <Text style={styles.warningText}>{t('trucks:fleet.verificationChangeWarning')}</Text>
        </View>
      )}

      <View style={styles.wizard}>
        <StepWizard
          steps={steps}
          freeJump={editing}
          finishLabel={editing ? t('trucks:fleet.saveChangesButton') : t('trucks:fleet.addTruckButton')}
          finishIcon={editing ? 'checkmark' : 'add'}
          onFinish={handleSave}
          finishing={saving}
          onCancel={onCancel}
          onBlocked={() => setTriedToSave(true)}
          onAdvance={() => setTriedToSave(false)}
          onStepChange={onStepChange}
        />
      </View>
    </Card>
  );
};

const ReviewRow = ({ label, value }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, !value && styles.reviewMuted]} numberOfLines={2}>{value || t('trucks:fleet.review.notSet')}</Text>
    </View>
  );
};

const DetailRow = ({ icon, label, value, muted }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelRow}>
      <Icon name={icon} size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={[styles.detailValue, muted && styles.detailMuted]}>{value}</Text>
  </View>
);

// Getting a truck verified by an admin: its papers, and sending them for review.
const verificationCopy = (status, t) => {
  const table = {
    not_submitted: {
      pill: { label: t('trucks:fleet.verification.notSubmittedLabel'), tone: 'muted' },
      hint: t('trucks:fleet.verification.notSubmittedHint'),
    },
    pending: {
      pill: { label: t('trucks:fleet.verification.pendingLabel'), tone: 'warning' },
      hint: t('trucks:fleet.verification.pendingHint'),
    },
    approved: {
      pill: { label: t('trucks:fleet.verification.approvedLabel'), tone: 'success' },
      hint: t('trucks:fleet.verification.approvedHint'),
    },
    rejected: {
      pill: { label: t('trucks:fleet.verification.rejectedLabel'), tone: 'error' },
      hint: t('trucks:fleet.verification.rejectedHint'),
    },
  };
  return table[status] || table.not_submitted;
};

const NO_VERIFICATION = {
  status: 'not_submitted',
  canEdit: true,
  requiredDocuments: ['bluebook', 'truck_photo'],
  optionalDocuments: ['insurance'],
  missingDocuments: ['bluebook', 'truck_photo'],
  documents: [],
};

const documentLabel = (docType, t) => t(`trucks:documents.${docType}`, TRUCK_DOCUMENT_LABELS[docType] || docType);

// Getting a truck verified by an admin: its papers, and sending them for review.
const TruckVerification = ({ truck, onChanged }) => {
  const { t } = useTranslation();
  const verification = truck.verification || NO_VERIFICATION;
  const copy = verificationCopy(verification.status, t);
  const [open, setOpen] = useState(false);
  // What's working: { type, source } for a paper, or { source: 'submit' }.
  const [busy, setBusy] = useState(null);

  const upload = async (docType, source) => {
    let asset;
    try {
      asset = source === 'camera' ? (await takePhoto())[0] : await pickDocument();
    } catch (error) {
      notify(source === 'camera' ? t('trucks:fleet.verification.couldNotOpenCameraTitle') : t('trucks:fleet.verification.couldNotOpenFilesTitle'), getErrorMessage(error));
      return;
    }
    if (!asset) return;
    const size = asset.size || asset.fileSize;
    if (size && size > MAX_DOCUMENT_BYTES) {
      notify(t('trucks:fleet.verification.fileTooLargeTitle'), t('trucks:fleet.verification.fileTooLargeMessage'));
      return;
    }

    setBusy({ type: docType, source });
    try {
      await uploadFiles(`/trucks/${truck._id}/documents`, [asset], { field: 'document', fields: { type: docType } });
      await onChanged();
    } catch (error) {
      notify(t('trucks:fleet.verification.uploadFailedTitle'), getErrorMessage(error));
    }
    setBusy(null);
  };

  const remove = (doc) => confirmAction({
    title: t('trucks:fleet.verification.removePaperTitle'),
    message: t('trucks:fleet.verification.removePaperMessage', { document: documentLabel(doc.type, t).toLowerCase() }),
    confirmLabel: t('trucks:fleet.removeButton'),
    destructive: true,
    onConfirm: async () => {
      setBusy({ type: doc.type, source: 'remove' });
      try {
        await api.delete(`/trucks/${truck._id}/documents/${doc._id}`);
        await onChanged();
      } catch (error) {
        notify(t('trucks:fleet.errorTitle'), getErrorMessage(error));
      }
      setBusy(null);
    },
  });

  const submit = async () => {
    setBusy({ source: 'submit' });
    try {
      await api.post(`/trucks/${truck._id}/verification`);
      await onChanged();
      notify(t('trucks:fleet.verification.sentTitle'), t('trucks:fleet.verification.sentMessage'));
    } catch (error) {
      notify(t('trucks:fleet.verification.couldNotSendTitle'), getErrorMessage(error));
    }
    setBusy(null);
  };

  const paperTypes = [...verification.requiredDocuments, ...verification.optionalDocuments];
  const missing = verification.missingDocuments;

  return (
    <Disclosure
      style={styles.verification}
      title={t('trucks:fleet.verification.title')}
      hint={copy.hint}
      icon="verified"
      badge={<StatusPill label={copy.pill.label} tone={copy.pill.tone} />}
      open={open}
      onToggle={setOpen}
      accessibilityLabel={t('trucks:fleet.verification.accessibilityLabel', { registrationNumber: truck.registrationNumber })}
    >
      {verification.status === 'rejected' && verification.rejectionReason ? (
        <View style={styles.rejection}>
          <Icon name="warning" size={iconSize.sm} color={colors.errorText} />
          <Text style={styles.rejectionText}>{verification.rejectionReason}</Text>
        </View>
      ) : null}

      {paperTypes.map((docType) => {
        const doc = verification.documents.find((paper) => paper.type === docType);
        const required = verification.requiredDocuments.includes(docType);
        const working = busy?.type === docType ? busy.source : null;
        const label = documentLabel(docType, t);
        return (
          <View key={docType} style={styles.paper}>
            <View style={styles.paperHeader}>
              <Text style={styles.paperTitle}>
                {label}
                {required && <Text style={styles.required}> *</Text>}
              </Text>
              {!required && <StatusPill label={t('trucks:fleet.papersOptional')} />}
            </View>
            {doc ? <DocumentTile doc={doc} label={t('trucks:fleet.verification.viewDocument', { document: label.toLowerCase() })} size={56} /> : null}
            {verification.canEdit && (
              <View style={styles.paperActions}>
                <PhotoSourceButtons
                  onTakePhoto={() => upload(docType, 'camera')}
                  onChoose={() => upload(docType, 'library')}
                  takeLabel={doc ? t('trucks:fleet.verification.retakeButton') : t('trucks:fleet.verification.takePhotoButton')}
                  chooseLabel={doc ? t('trucks:fleet.verification.replaceButton') : t('trucks:fleet.verification.uploadFileButton')}
                  chooseIcon="upload"
                  busy={working === 'camera' || working === 'library' ? working : null}
                  disabled={Boolean(busy) && !working}
                />
                {doc && (
                  <Button title={t('trucks:fleet.removeButton')} icon="trash" variant="ghost" size="sm" onPress={() => remove(doc)} loading={working === 'remove'} />
                )}
              </View>
            )}
          </View>
        );
      })}

      {verification.canEdit && (
        <>
          {missing.length > 0 && (
            <Text style={styles.hint}>
              {t('trucks:fleet.verification.stillNeeded', { documents: missing.map((docType) => documentLabel(docType, t).toLowerCase()).join(', ') })}
            </Text>
          )}
          <Button
            title={t('trucks:fleet.verification.sendButton')}
            icon="send"
            onPress={submit}
            loading={busy?.source === 'submit'}
            disabled={missing.length > 0 || (Boolean(busy) && busy.source !== 'submit')}
          />
        </>
      )}
    </Disclosure>
  );
};

const TruckCard = ({ truck, tree, busy, onChanged, onEdit, onAssignDriver, onSetStatus, onDelete }) => {
  const { t } = useTranslation();
  const [assigning, setAssigning] = useState(false);
  const [driverPhone, setDriverPhone] = useState('+977');

  const driver = truck.assignedDriverId;
  const base = areaName(tree, truck.baseLocation);
  const pricing = pricingText(truck, t);
  const featureNames = TRUCK_FEATURES.filter((feature) => truck.features?.[feature.key]).map((feature) => truckFeatureLabel(feature.key, t, 'short'));
  const papers = [
    [t('trucks:fleet.card.bluebookTaxLabel'), paperStatus(truck.bluebookRenewedUntil, t)],
    [t('trucks:fleet.card.insuranceLabel'), paperStatus(truck.insurance?.validUntil, t)],
    [t('trucks:fleet.card.greenStickerLabel'), paperStatus(truck.emissionTestValidUntil, t)],
  ].filter(([, status]) => status);

  const tip = !base && !pricing
    ? t('trucks:fleet.card.tipBothMissing')
    : !base
      ? t('trucks:fleet.card.tipBaseMissing')
      : !pricing
        ? t('trucks:fleet.card.tipRateMissing')
        : null;

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.regRow}>
          <Text style={styles.reg}>{truck.registrationNumber}</Text>
          {truck.verified && <VerifiedBadge size={20} label={t('trucks:fleet.verification.verifiedTruckLabel')} />}
        </View>
        <StatusBadge status={truck.status} />
      </View>
      <Text style={styles.meta}>
        {[
          truckTypeLabel(truck.truckType, t),
          bodyTypeLabel(truck.bodyType, t),
          truck.capacity ? formatKg(truck.capacity) : null,
          truck.makeModel,
          truck.year ? String(truck.year) : null,
        ].filter(Boolean).join(' · ')}
      </Text>

      <DetailRow
        icon="pickup"
        label={t('trucks:fleet.baseLabel')}
        value={base ? `${base}${serviceAreaNote(truck.serviceArea, t) ? `, ${serviceAreaNote(truck.serviceArea, t)}` : ''}` : t('trucks:fleet.card.notSet')}
        muted={!base}
      />
      <DetailRow icon="price" label={t('trucks:fleet.card.pricingLabel')} value={pricing || t('trucks:fleet.card.noRateFallback')} muted={!pricing} />
      <DetailRow icon="checkmark" label={t('trucks:fleet.card.featuresLabel')} value={featureNames.length ? featureNames.join(', ') : t('trucks:fleet.card.noFeaturesListed')} muted={!featureNames.length} />
      <DetailRow
        icon="driver"
        label={t('trucks:fleet.card.driverLabel')}
        // Unverified drivers can be on a truck but can't be put on a booking yet.
        value={driver
          ? `${driver.firstName} ${driver.lastName}${driver.kycStatus === 'approved' ? '' : t('trucks:fleet.card.driverNotVerifiedSuffix')}`
          : t('trucks:fleet.card.driverUnassigned')}
        muted={!driver}
      />

      <View style={styles.papers}>
        {papers.length ? (
          papers.map(([name, status]) => (
            <StatusPill key={name} label={t('trucks:fleet.card.paperLine', { name, status: status.text })} tone={status.tone} />
          ))
        ) : (
          <StatusPill label={t('trucks:fleet.card.papersNotAdded')} />
        )}
      </View>

      {tip && (
        <View style={styles.tip}>
          <Icon name="info" size={iconSize.sm} color={colors.infoText} />
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      )}

      <TruckVerification truck={truck} onChanged={onChanged} />

      {assigning ? (
        <View style={styles.assign}>
          <Input
            label={t('trucks:fleet.card.driverPhoneLabel')}
            value={driverPhone}
            onChangeText={setDriverPhone}
            keyboardType="phone-pad"
            placeholder="+9779841234567"
            icon="phone"
          />
          <View style={styles.actionsRow}>
            <Button
              title={t('trucks:fleet.card.assignButton')}
              icon="checkmark"
              onPress={() => { setAssigning(false); onAssignDriver(driverPhone); }}
              loading={busy}
              style={styles.actionButton}
            />
            {driver && (
              <Button title={t('trucks:fleet.card.unassignButton')} icon="close" variant="destructive" onPress={() => { setAssigning(false); onAssignDriver(''); }} loading={busy} style={styles.actionButton} />
            )}
            <Button title={t('trucks:fleet.cancelButton')} variant="ghost" onPress={() => setAssigning(false)} style={styles.actionButton} />
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Button title={t('trucks:fleet.card.editDetailsButton')} icon="edit" variant="secondary" onPress={onEdit} style={styles.actionButton} />
          <Button
            title={driver ? t('trucks:fleet.card.changeDriverButton') : t('trucks:fleet.card.assignDriverButton')}
            icon="driver"
            variant="tertiary"
            onPress={() => setAssigning(true)}
            style={styles.actionButton}
          />
        </View>
      )}

      <View style={styles.actionsRow}>
        <Button
          title={truck.status === 'active' ? t('trucks:fleet.card.markInMaintenanceButton') : t('trucks:fleet.card.markActiveButton')}
          icon="settings"
          variant="tertiary"
          onPress={() => onSetStatus(truck.status === 'active' ? 'maintenance' : 'active')}
          loading={busy}
          style={styles.actionButton}
        />
        <Button title={t('trucks:fleet.removeButton')} icon="trash" variant="destructive" onPress={onDelete} style={styles.actionButton} />
      </View>
    </Card>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  heading: { ...type.h3, color: colors.textPrimary },
  headerHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  addButton: { minWidth: 130 },

  formWide: { padding: spacing.xxl },
  formTitle: { ...type.h2, color: colors.textPrimary },
  formIntro: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  block: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  blockFirst: { marginTop: spacing.lg },
  blockTitle: { ...type.h3, color: colors.textPrimary },
  blockHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  blockBody: { marginTop: spacing.md },

  fieldLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  required: { color: colors.errorText },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  half: { flex: 1, minWidth: 0 },
  third: { flex: 1, minWidth: 0 },

  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.md },
  optionCell: { padding: spacing.xs },
  option: {
    flexGrow: 1,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  optionIcon: { marginBottom: spacing.xs },
  optionSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  optionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.xs },
  optionLabel: { ...type.smallMedium, color: colors.textPrimary, flexShrink: 1 },
  optionLabelSelected: { color: colors.primaryText },
  optionDescription: { ...type.caption, fontWeight: '400', color: colors.textMuted, marginTop: spacing.xxs },
  optionExamples: { ...type.small, color: colors.textSecondary, marginTop: spacing.xxs, fontStyle: 'italic' },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  featureCell: { padding: spacing.xs },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  checkRowChecked: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  checkText: { flex: 1, minWidth: 0 },
  checkLabel: { ...type.bodyMedium, color: colors.textPrimary },
  checkDescription: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  hint: { ...type.small, color: colors.textMuted, marginBottom: spacing.md },
  errorText: { ...type.small, color: colors.errorText, marginBottom: spacing.sm },
  clearBase: { alignSelf: 'flex-start' },

  wizard: { marginTop: spacing.lg },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  reviewLabel: { ...type.body, color: colors.textMuted },
  reviewValue: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  reviewMuted: { color: colors.textMuted, fontWeight: '400' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xl },
  formAction: { minWidth: 140 },

  regRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  reg: { ...type.h3, color: colors.textPrimary, flexShrink: 1 },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningMuted,
  },
  warningText: { ...type.small, color: colors.warningText, flex: 1 },
  verification: { marginTop: spacing.md },
  rejection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.errorMuted,
  },
  rejectionText: { ...type.small, color: colors.errorText, flex: 1 },
  paper: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  paperHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  paperTitle: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  paperActions: { marginTop: spacing.xs },
  meta: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: spacing.xs },
  detailLabel: { ...type.small, color: colors.textMuted },
  detailValue: { ...type.smallMedium, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  detailMuted: { color: colors.textMuted, fontWeight: '400' },
  papers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.infoMuted,
  },
  tipText: { ...type.small, color: colors.infoText, flex: 1 },
  assign: { marginTop: spacing.sm },
  // Two buttons side by side when both fit (tablet and up); on a phone each
  // gets its own full-width row, so a long Nepali label stays readable.
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 160 },
}));

export default ManageFleet;
