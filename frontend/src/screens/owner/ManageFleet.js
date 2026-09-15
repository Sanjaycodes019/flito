import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SelectField from '../../components/common/SelectField';
import DateField from '../../components/common/DateField';
import Disclosure from '../../components/common/Disclosure';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { StatusPill } from '../../components/common/SettingsList';
import NepalAddressFields, { emptyPlace } from '../../components/address/NepalAddressFields';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import {
  BODY_TYPES,
  FLEET_TRUCK_TYPES,
  FUEL_TYPES,
  INSURANCE_TYPES,
  LEGACY_TRUCK_TYPES,
  SERVICE_AREAS,
  TRUCK_FEATURES,
  TRUCK_MAKES,
} from '../../utils/constants';
import {
  bodyTypeLabel, formatCurrency, formatKg, getErrorMessage, pluralize, truckTypeLabel,
} from '../../utils/helpers';
import { nepalDay } from '../../utils/nepalDate';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
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

const pricingText = (truck) => (truck.ratePerKm
  ? `${formatCurrency(truck.ratePerKm)} per km${truck.minimumCharge ? `, at least ${formatCurrency(truck.minimumCharge)}` : ''}`
  : null);

const dayKeyOf = (date) => (date ? String(date).slice(0, 10) : null);
const textOf = (value) => (value == null ? '' : String(value));

// Whether a paper with this end date is current, running out, or lapsed.
const paperStatus = (date) => {
  if (!date) return null;
  const days = Math.floor((Date.parse(`${dayKeyOf(date)}T00:00:00Z`) - Date.parse(`${nepalDay()}T00:00:00Z`)) / DAY_MS);
  if (days < 0) return { tone: 'error', text: 'expired' };
  if (days <= PAPER_WARNING_DAYS) return { tone: 'warning', text: days === 0 ? 'ends today' : `ends in ${days} ${days === 1 ? 'day' : 'days'}` };
  return { tone: 'success', text: 'current' };
};

const ManageFleet = () => {
  const [trucks, setTrucks] = useState([]);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const layout = useScreenLayout('narrow');
  const wide = !layout.isPhone;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/trucks');
      setTrucks(data.trucks);
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
  }, []);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const runAction = async (truckId, fn) => {
    setBusyId(truckId);
    try {
      await fn();
      await load();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setBusyId(null);
  };

  const handleDelete = (truck) => {
    confirmAction({
      title: 'Remove truck',
      message: `Remove ${truck.registrationNumber} from your fleet?`,
      confirmLabel: 'Remove',
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
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{pluralize(trucks.length, 'truck')}</Text>
          <Text style={styles.headerHint}>
            Shippers see trucks that can carry their load. A base, a rate per km and current insurance help yours rank well.
          </Text>
        </View>
        {!adding && (
          <Button title="Add Truck" icon="add" size="sm" onPress={() => { setAdding(true); setEditingId(null); }} style={styles.addButton} />
        )}
      </View>

      {adding && <TruckForm tree={tree} wide={wide} onSaved={handleSaved} onCancel={() => setAdding(false)} />}

      {trucks.length === 0 && !adding && (
        <EmptyState icon="fleet" title="No trucks yet" message="Add a truck so shippers can find it and book it." />
      )}

      {trucks.map((truck) => (editingId === truck._id ? (
        <TruckForm key={truck._id} tree={tree} wide={wide} truck={truck} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
      ) : (
        <TruckCard
          key={truck._id}
          truck={truck}
          tree={tree}
          busy={busyId === truck._id}
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
    </ScrollView>
  );
};

// Cards to pick one option from, each with an optional description and examples.
const OptionGrid = ({ options, value, onChange, columns, allowClear = false }) => (
  <View style={styles.optionGrid} accessibilityRole="radiogroup">
    {options.map((option) => {
      const selected = value === option.value;
      return (
        <View key={option.value} style={[styles.optionCell, { width: `${100 / columns}%` }]}>
          <Pressable
            onPress={() => onChange(selected && allowClear ? null : option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[styles.option, selected && styles.optionSelected]}
          >
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

const FormBlock = ({ title, hint, first, children }) => (
  <View style={[styles.block, first && styles.blockFirst]}>
    <Text style={styles.blockTitle} accessibilityRole="header">{title}</Text>
    {hint ? <Text style={styles.blockHint}>{hint}</Text> : null}
    <View style={styles.blockBody}>{children}</View>
  </View>
);

// Adds a truck, or edits one when `truck` is given (the registration can't
// change). Filled in the way a truck is described on its bluebook in Nepal.
const TruckForm = ({ tree, truck, wide, onSaved, onCancel }) => {
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
  const [papersOpen, setPapersOpen] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const legacyType = LEGACY_TRUCK_TYPES.find((option) => option.value === truckType);
  const typeOptions = legacyType ? [...FLEET_TRUCK_TYPES, legacyType] : FLEET_TRUCK_TYPES;
  const makeOptions = TRUCK_MAKES.map((name) => ({ value: name, label: name }));
  const manufactureYears = Array.from({ length: year + 1 - 1990 + 1 }, (_, i) => year + 1 - i)
    .map((value) => ({ value, label: String(value) }));
  const expiryYears = Array.from({ length: 7 }, (_, i) => year - 1 + i);

  // A capacity still at the old class's usual figure follows the new class.
  const chooseType = (value) => {
    const previous = typeFor(truckType)?.capacity;
    if (!capacity.trim() || Number(capacity) === previous) setCapacity(textOf(typeFor(value)?.capacity));
    setTruckType(value);
  };

  const baseStarted = Boolean(base.provinceId || base.districtId || base.localLevelId);
  const baseComplete = Boolean(base.provinceId && base.districtId && base.localLevelId);
  const bedProblem = (text) => text.trim() && (!FEET.test(text.trim()) || Number(text) < 1 || Number(text) > MAX_CARGO_BED_FT)
    && `Feet, like 19 or 7.5`;
  const numberProblem = (text) => text.trim() && !DOCUMENT_NUMBER.test(text.trim()) && 'Letters and digits, as on the bluebook';

  const errors = {
    registrationNumber: !editing && !registrationNumber.trim() && 'Enter the registration number',
    capacity: (!/^\d+$/.test(capacity.trim()) || Number(capacity) < 100 || Number(capacity) > MAX_CAPACITY_KG)
      && `Enter the most it carries, from 100 to ${MAX_CAPACITY_KG.toLocaleString('en-NP')} kg`,
    lengthFt: bedProblem(bed.lengthFt),
    widthFt: bedProblem(bed.widthFt),
    heightFt: bedProblem(bed.heightFt),
    base: (baseStarted && !baseComplete && 'Choose the municipality too, or clear the base')
      || (serviceArea !== 'nepal' && !baseComplete && 'Set a base to limit where the truck works'),
    ratePerKm: ratePerKm.trim()
      && (!/^\d+(\.\d{1,2})?$/.test(ratePerKm.trim()) || Number(ratePerKm) <= 0 || Number(ratePerKm) > 1000)
      && 'Enter rupees per km, up to 1,000',
    minimumCharge: minimumCharge.trim() && !/^\d+$/.test(minimumCharge.trim()) && 'Enter whole rupees',
    chassisNumber: numberProblem(chassisNumber),
    engineNumber: numberProblem(engineNumber),
  };
  const shown = (key) => (triedToSave ? errors[key] || null : null);
  const papersHaveErrors = Boolean(errors.chassisNumber || errors.engineNumber);

  const handleSave = async () => {
    setTriedToSave(true);
    if (Object.values(errors).some(Boolean)) {
      if (papersHaveErrors) setPapersOpen(true);
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
      notify('Could not save the truck', getErrorMessage(error));
      setSaving(false);
      return;
    }
    setSaving(false);
    await onSaved();
  };

  const pair = wide ? styles.row : null;
  const half = wide ? styles.half : undefined;
  const papersAdded = [bluebookUntil, insuranceUntil, emissionUntil, chassisNumber.trim(), engineNumber.trim()].filter(Boolean).length;

  return (
    <Card style={wide && styles.formWide}>
      <Text style={styles.formTitle}>{editing ? `Edit ${truck.registrationNumber}` : 'Add a Truck'}</Text>
      <Text style={styles.formIntro}>Fill this in as it appears on the truck and its bluebook. Fields marked * are required.</Text>

      <FormBlock title="Vehicle" first>
        {!editing && (
          <Input
            label="Registration Number"
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder="e.g. BA 2 KHA 1234"
            autoCapitalize="characters"
            icon="truck"
            required
            maxLength={30}
            error={shown('registrationNumber')}
            helperText="As on the number plate and bluebook, in the zonal or provincial format."
          />
        )}

        <Text style={styles.fieldLabel}>
          Truck Type
          <Text style={styles.required}> *</Text>
        </Text>
        <OptionGrid options={typeOptions} value={truckType} onChange={chooseType} columns={wide ? 4 : 2} />

        <View style={pair}>
          <Input
            label="Capacity (kg)"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="numeric"
            placeholder="e.g. 10000"
            icon="weight"
            required
            error={shown('capacity')}
            helperText="The most it carries. Heavier loads aren't matched to it."
            containerStyle={half}
          />
          <SelectField
            label="Make"
            value={make}
            options={makeOptions}
            onChange={setMake}
            placeholder="Select make"
            containerStyle={half}
          />
        </View>

        <View style={pair}>
          <Input
            label="Model"
            value={model}
            onChangeText={setModel}
            placeholder={typeFor(truckType)?.examples ? `e.g. ${typeFor(truckType).examples.split(', ')[0].split(' ').slice(1).join(' ') || '1613'}` : 'e.g. 1613'}
            icon="truck"
            maxLength={40}
            containerStyle={half}
          />
          <SelectField
            label="Year of Manufacture"
            value={manufactured}
            options={manufactureYears}
            onChange={setManufactured}
            placeholder="Select year"
            containerStyle={half}
          />
        </View>

        <Text style={styles.fieldLabel}>Fuel</Text>
        <OptionGrid options={FUEL_TYPES} value={fuelType} onChange={setFuelType} columns={3} />
      </FormBlock>

      <FormBlock title="Body and Cargo Space" hint="Shippers look for the body that suits their goods, so pick the closest match.">
        <Text style={styles.fieldLabel}>
          Body Type
          <Text style={styles.required}> *</Text>
        </Text>
        <OptionGrid options={BODY_TYPES} value={bodyType} onChange={setBodyType} columns={wide ? 3 : 2} />

        <Text style={styles.fieldLabel}>Cargo bed inside size, in feet (optional)</Text>
        <View style={styles.row}>
          <Input
            label="Length (ft)"
            value={bed.lengthFt}
            onChangeText={(lengthFt) => setBed((current) => ({ ...current, lengthFt }))}
            keyboardType="numeric"
            placeholder="e.g. 19"
            error={shown('lengthFt')}
            containerStyle={styles.third}
          />
          <Input
            label="Width (ft)"
            value={bed.widthFt}
            onChangeText={(widthFt) => setBed((current) => ({ ...current, widthFt }))}
            keyboardType="numeric"
            placeholder="e.g. 7.5"
            error={shown('widthFt')}
            containerStyle={styles.third}
          />
          <Input
            label="Height (ft)"
            value={bed.heightFt}
            onChangeText={(heightFt) => setBed((current) => ({ ...current, heightFt }))}
            keyboardType="numeric"
            placeholder="e.g. 6"
            error={shown('heightFt')}
            containerStyle={styles.third}
          />
        </View>
      </FormBlock>

      <FormBlock title="Base and Service Area" hint="Where the truck is usually parked. It ranks higher for loads picked up nearby.">
        {tree ? (
          <NepalAddressFields
            tree={tree}
            value={base}
            onChange={setBase}
            columns={wide}
            labelPrefix="Base"
            includeWardAndTole={false}
            required={false}
          />
        ) : (
          <Text style={styles.hint}>The list of places could not be loaded. You can add the base later.</Text>
        )}
        {shown('base') ? <Text style={styles.errorText}>{shown('base')}</Text> : null}
        {baseStarted && (
          <Button title="Clear Base" icon="close" variant="ghost" size="sm" onPress={() => setBase(emptyPlace)} style={styles.clearBase} />
        )}

        <Text style={styles.fieldLabel}>Takes loads</Text>
        <OptionGrid options={SERVICE_AREAS} value={serviceArea} onChange={setServiceArea} columns={wide ? 3 : 1} />
      </FormBlock>

      <FormBlock
        title="Pricing"
        hint="With a rate, shippers see an asking price for every trip: the rate times the distance, never below your minimum. Without one, they make you offers."
      >
        <View style={pair}>
          <Input
            label="Rate per km (Rs.)"
            value={ratePerKm}
            onChangeText={setRatePerKm}
            keyboardType="numeric"
            placeholder="e.g. 80"
            icon="price"
            error={shown('ratePerKm')}
            containerStyle={half}
          />
          <Input
            label="Minimum Charge (Rs.)"
            value={minimumCharge}
            onChangeText={setMinimumCharge}
            keyboardType="numeric"
            placeholder="e.g. 5000"
            icon="price"
            error={shown('minimumCharge')}
            containerStyle={half}
          />
        </View>
      </FormBlock>

      <FormBlock title="Features" hint="Shippers see these on the truck.">
        <View style={styles.featureGrid}>
          {TRUCK_FEATURES.map((feature) => (
            <View key={feature.key} style={[styles.featureCell, { width: wide ? '50%' : '100%' }]}>
              <CheckRow
                label={feature.label}
                description={feature.description}
                checked={features[feature.key]}
                onToggle={() => setFeatures((current) => ({ ...current, [feature.key]: !current[feature.key] }))}
              />
            </View>
          ))}
        </View>
      </FormBlock>

      <View style={styles.block}>
        <Disclosure
          title="Papers"
          hint="Bluebook, insurance and pollution test. Private: shippers only see whether the insurance is current."
          icon="document"
          badge={<StatusPill label={papersAdded ? `${papersAdded} added` : 'Optional'} tone={papersAdded ? 'success' : 'muted'} />}
          open={papersOpen || (triedToSave && papersHaveErrors)}
          onToggle={setPapersOpen}
        >
          <View style={pair}>
            <Input
              label="Chassis Number"
              value={chassisNumber}
              onChangeText={setChassisNumber}
              autoCapitalize="characters"
              placeholder="As on the bluebook"
              maxLength={30}
              error={shown('chassisNumber')}
              containerStyle={half}
            />
            <Input
              label="Engine Number"
              value={engineNumber}
              onChangeText={setEngineNumber}
              autoCapitalize="characters"
              placeholder="As on the bluebook"
              maxLength={30}
              error={shown('engineNumber')}
              containerStyle={half}
            />
          </View>

          <DateField
            label="Bluebook tax paid until"
            value={bluebookUntil}
            onChange={setBluebookUntil}
            years={expiryYears}
            helperText="The yearly vehicle tax renewal, in A.D. (English calendar)."
          />

          <Text style={styles.fieldLabel}>Insurance</Text>
          <OptionGrid options={INSURANCE_TYPES} value={insuranceType} onChange={setInsuranceType} columns={2} allowClear />
          <View style={pair}>
            <Input
              label="Insurance Company"
              value={insuranceCompany}
              onChangeText={setInsuranceCompany}
              placeholder="e.g. Shikhar Insurance"
              maxLength={60}
              containerStyle={half}
            />
            <Input
              label="Policy Number"
              value={policyNumber}
              onChangeText={setPolicyNumber}
              placeholder="As on the policy"
              maxLength={40}
              containerStyle={half}
            />
          </View>
          <DateField
            label="Insurance valid until"
            value={insuranceUntil}
            onChange={setInsuranceUntil}
            years={expiryYears}
            helperText="In A.D. Current insurance shows shippers an Insured badge and helps the truck rank."
          />

          <DateField
            label="Pollution test (green sticker) valid until"
            value={emissionUntil}
            onChange={setEmissionUntil}
            years={expiryYears}
          />
        </Disclosure>
      </View>

      <View style={styles.formActions}>
        <Button title="Cancel" variant="ghost" onPress={onCancel} style={styles.formAction} />
        <Button
          title={editing ? 'Save Changes' : 'Add Truck'}
          icon={editing ? 'checkmark' : 'add'}
          onPress={handleSave}
          loading={saving}
          style={styles.formAction}
        />
      </View>
    </Card>
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

const SERVICE_AREA_NOTE = {
  province: 'within its province',
  district: 'within its district',
};

const TruckCard = ({ truck, tree, busy, onEdit, onAssignDriver, onSetStatus, onDelete }) => {
  const [assigning, setAssigning] = useState(false);
  const [driverPhone, setDriverPhone] = useState('+977');

  const driver = truck.assignedDriverId;
  const base = areaName(tree, truck.baseLocation);
  const pricing = pricingText(truck);
  const featureNames = TRUCK_FEATURES.filter((feature) => truck.features?.[feature.key]).map((feature) => feature.short);
  const papers = [
    ['Bluebook tax', paperStatus(truck.bluebookRenewedUntil)],
    ['Insurance', paperStatus(truck.insurance?.validUntil)],
    ['Green sticker', paperStatus(truck.emissionTestValidUntil)],
  ].filter(([, status]) => status);

  const tip = !base && !pricing
    ? 'Add a base and a rate so this truck ranks well for nearby loads and shows shippers a price.'
    : !base
      ? 'Add a base so this truck ranks well for loads nearby.'
      : !pricing
        ? 'Add a rate per km so shippers see an asking price.'
        : null;

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.reg}>{truck.registrationNumber}</Text>
        <StatusBadge status={truck.status} />
      </View>
      <Text style={styles.meta}>
        {[
          truckTypeLabel(truck.truckType),
          bodyTypeLabel(truck.bodyType),
          truck.capacity ? formatKg(truck.capacity) : null,
          truck.makeModel,
          truck.year ? String(truck.year) : null,
        ].filter(Boolean).join(' · ')}
      </Text>

      <DetailRow
        icon="pickup"
        label="Base"
        value={base ? `${base}${SERVICE_AREA_NOTE[truck.serviceArea] ? `, ${SERVICE_AREA_NOTE[truck.serviceArea]}` : ''}` : 'Not set'}
        muted={!base}
      />
      <DetailRow icon="price" label="Pricing" value={pricing || 'No rate: shippers make offers'} muted={!pricing} />
      <DetailRow icon="checkmark" label="Features" value={featureNames.length ? featureNames.join(', ') : 'None listed'} muted={!featureNames.length} />
      <DetailRow
        icon="driver"
        label="Driver"
        // Unverified drivers can be on a truck but can't be put on a booking yet.
        value={driver ? `${driver.firstName} ${driver.lastName}${driver.kycStatus === 'approved' ? '' : ' (not verified)'}` : 'Unassigned'}
        muted={!driver}
      />

      <View style={styles.papers}>
        {papers.length ? (
          papers.map(([name, status]) => <StatusPill key={name} label={`${name}: ${status.text}`} tone={status.tone} />)
        ) : (
          <StatusPill label="Papers not added" />
        )}
      </View>

      {tip && (
        <View style={styles.tip}>
          <Icon name="info" size={iconSize.sm} color={colors.infoText} />
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      )}

      {assigning ? (
        <View style={styles.assign}>
          <Input
            label="Driver Phone"
            value={driverPhone}
            onChangeText={setDriverPhone}
            keyboardType="phone-pad"
            placeholder="+9779841234567"
            icon="phone"
          />
          <View style={styles.actionsRow}>
            <Button
              title="Assign"
              icon="checkmark"
              onPress={() => { setAssigning(false); onAssignDriver(driverPhone); }}
              loading={busy}
              style={styles.actionButton}
            />
            {driver && (
              <Button title="Unassign" icon="close" variant="destructive" onPress={() => { setAssigning(false); onAssignDriver(''); }} loading={busy} style={styles.actionButton} />
            )}
            <Button title="Cancel" variant="ghost" onPress={() => setAssigning(false)} style={styles.actionButton} />
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Button title="Edit Details" icon="edit" variant="secondary" onPress={onEdit} style={styles.actionButton} />
          <Button
            title={driver ? 'Change Driver' : 'Assign Driver'}
            icon="driver"
            variant="tertiary"
            onPress={() => setAssigning(true)}
            style={styles.actionButton}
          />
        </View>
      )}

      <View style={styles.actionsRow}>
        <Button
          title={truck.status === 'active' ? 'Mark In Maintenance' : 'Mark Active'}
          icon="settings"
          variant="tertiary"
          onPress={() => onSetStatus(truck.status === 'active' ? 'maintenance' : 'active')}
          loading={busy}
          style={styles.actionButton}
        />
        <Button title="Remove" icon="trash" variant="destructive" onPress={onDelete} style={styles.actionButton} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
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
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  optionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.xs },
  optionLabel: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  optionLabelSelected: { color: colors.primaryText },
  optionDescription: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
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

  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xl },
  formAction: { minWidth: 140 },

  reg: { ...type.h3, color: colors.textPrimary },
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
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});

export default ManageFleet;
