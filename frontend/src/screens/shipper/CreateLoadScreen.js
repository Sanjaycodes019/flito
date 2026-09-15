import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import Disclosure from '../../components/common/Disclosure';
import PhotoStrip from '../../components/common/PhotoStrip';
import PhotoSourceButtons from '../../components/common/PhotoSourceButtons';
import { StatusPill } from '../../components/common/SettingsList';
import RouteStop, { emptyStop } from '../../components/loads/RouteStop';
import { isPlaceComplete, missingPlaceFields, shortPlaceName } from '../../components/address/NepalAddressFields';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import { MAX_LOAD_PHOTOS, MAX_LOAD_WEIGHT_KG, PICKUP_DAYS_SHOWN } from '../../utils/constants';
import { formatKg, getErrorMessage, isValidPhone } from '../../utils/helpers';
import { dayLabel, describeDay, upcomingDays } from '../../utils/nepalDate';
import useScreenLayout from '../../hooks/useScreenLayout';
import api from '../../services/api';
import { fetchLocations } from '../../services/locations';
import { pickImages, takePhoto, uploadPhotos } from '../../services/uploads';
import { notify } from '../../utils/alert';
import { addLoad } from '../../redux/slices/loadsSlice';

const PHONE_HINT = 'Use a +977 number, e.g. +9779841234567';

// Web only: the summary stays in view beside the form while it scrolls.
const stickyOnWeb = Platform.OS === 'web' ? { position: 'sticky', top: spacing.xxl } : null;

const weightProblem = (text) => {
  const value = text.trim();
  if (!value) return 'Enter the weight in kg';
  if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) return 'Enter the weight as a number of kg';
  if (Number(value) > MAX_LOAD_WEIGHT_KG) return `Loads can weigh up to ${formatKg(MAX_LOAD_WEIGHT_KG)}`;
  return null;
};

const stopPayload = ({ place, contactPerson, phone, coordinates }) => ({
  ...place,
  tole: place.tole.trim(),
  ...(contactPerson.trim() ? { contactPerson: contactPerson.trim() } : {}),
  ...(phone.trim() ? { phone: phone.trim() } : {}),
  ...(coordinates ? { coordinates } : {}),
});

const FormSection = ({ icon, title, description, wide, children }) => (
  <Card style={wide && styles.sectionWide}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Icon name={icon} size={iconSize.md} color={colors.primaryText} />
      </View>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
    </View>
    {children}
  </Card>
);

const DayChip = ({ day, today, selected, onPress, width }) => {
  const [hovered, setHovered] = useState(false);
  const { name, date } = describeDay(day, today);
  return (
    <View style={[styles.dayCell, { width }]}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${name}, ${date}`}
        style={[styles.dayChip, hovered && styles.dayChipHovered, selected && styles.dayChipSelected]}
      >
        <Text style={[styles.dayName, selected && styles.dayTextSelected]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.dayDate, selected && styles.dayTextSelected]} numberOfLines={1}>{date}</Text>
      </Pressable>
    </View>
  );
};

const RoutePoint = ({ kind, value }) => (
  <View style={styles.routePoint}>
    <View style={[styles.routeDot, kind === 'pickup' ? styles.routeDotPickup : styles.routeDotDropoff]} />
    <View style={styles.routeText}>
      <Text style={styles.routeLabel}>{kind === 'pickup' ? 'Pickup' : 'Dropoff'}</Text>
      <Text style={[styles.routeValue, !value && styles.muted]} numberOfLines={2}>{value || 'Not chosen yet'}</Text>
    </View>
  </View>
);

const SummaryRow = ({ label, value, empty = 'Not set' }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, !value && styles.muted]} numberOfLines={1}>{value || empty}</Text>
  </View>
);

// Step one of booking a truck: only what matching needs (what, how heavy,
// where from and to, and when). Contacts, a map pin, a description and photos
// are optional and folded away. Posting opens the trucks that can carry it.
const CreateLoadScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const savedAddress = useSelector((state) => state.auth.user?.address);
  // A single column up to tablet; on a laptop the form and a summary sit side by side.
  const layout = useScreenLayout('narrow', 'wide');
  const wide = !layout.isPhone;
  const twoColumns = layout.isDesktop;

  const days = upcomingDays(PICKUP_DAYS_SHOWN);

  const [tree, setTree] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [goodsType, setGoodsType] = useState('');
  const [weight, setWeight] = useState('');
  const [stops, setStops] = useState({ pickup: emptyStop, dropoff: emptyStop });
  const [pickupDay, setPickupDay] = useState(days[0]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  // Which photo source is working: 'camera', 'library' or null.
  const [photoBusy, setPhotoBusy] = useState(null);
  const [posting, setPosting] = useState(false);
  const [triedToPost, setTriedToPost] = useState(false);

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

  const updateStop = (key) => (change) => setStops((current) => ({ ...current, [key]: change(current[key]) }));

  const handleAddPhotos = async (source) => {
    setPhotoBusy(source);
    try {
      const assets = source === 'camera'
        ? await takePhoto()
        : await pickImages({ max: MAX_LOAD_PHOTOS - photos.length });
      if (assets.length) setPhotos((current) => [...current, ...assets].slice(0, MAX_LOAD_PHOTOS));
    } catch (error) {
      notify('Could not add photos', getErrorMessage(error));
    }
    setPhotoBusy(null);
  };

  const removePhoto = (_, index) => setPhotos((current) => current.filter((__, i) => i !== index));

  const phoneInvalid = (stop) => Boolean(stop.phone.trim()) && !isValidPhone(stop.phone.trim());
  const stillNeeded = [
    !goodsType.trim() && 'goods type',
    !weight.trim() && 'weight',
    !isPlaceComplete(stops.pickup.place) && 'pickup address',
    !isPlaceComplete(stops.dropoff.place) && 'dropoff address',
  ].filter(Boolean);
  const hasInvalidField = Boolean(weight.trim() && weightProblem(weight))
    || phoneInvalid(stops.pickup) || phoneInvalid(stops.dropoff);

  // Errors show only once the user has tried to post, not while they fill in.
  const shown = (message) => (triedToPost ? message || null : null);
  const stopErrors = (stop) => (triedToPost
    ? { ...missingPlaceFields(stop.place, 'the'), phone: phoneInvalid(stop) ? PHONE_HINT : null }
    : {});

  const handleFindTrucks = async () => {
    setTriedToPost(true);
    if (stillNeeded.length || hasInvalidField) return;

    setPosting(true);
    try {
      const { data } = await api.post('/loads', {
        goodsType: goodsType.trim(),
        weight: Number(weight),
        pickupDate: pickupDay,
        description: description.trim() || undefined,
        pickupLocation: stopPayload(stops.pickup),
        dropoffLocation: stopPayload(stops.dropoff),
      });

      // The load is saved before its photos, so a failed upload never loses
      // the posting. Photos can be retried from the load's page.
      let load = data.load;
      let photoError = null;
      if (photos.length) {
        try {
          load = (await uploadPhotos(`/loads/${load._id}/photos`, photos)).load;
        } catch (error) {
          photoError = getErrorMessage(error);
        }
      }

      dispatch(addLoad(load));
      setPosting(false);
      const openMatches = () => navigation.replace('TruckMatches', { loadId: load._id });

      if (photoError) {
        notify('Load posted, but photos failed', `${photoError}. You can add them from the load's page.`, openMatches);
      } else {
        openMatches();
      }
    } catch (error) {
      notify('Could not post the load', getErrorMessage(error));
      setPosting(false);
    }
  };

  const halfRow = wide ? styles.row : null;
  const hasExtras = Boolean(description.trim()) || photos.length > 0;

  const stillNeededText = [
    stillNeeded.length ? `Still needed: ${stillNeeded.join(', ')}.` : null,
    hasInvalidField ? 'Fix the highlighted fields.' : null,
  ].filter(Boolean).join(' ');

  const summary = (
    <Card style={wide && styles.sectionWide}>
      <Text style={styles.summaryTitle} accessibilityRole="header">Summary</Text>
      <RoutePoint kind="pickup" value={shortPlaceName(tree, stops.pickup.place)} />
      <View style={styles.routeConnector} />
      <RoutePoint kind="dropoff" value={shortPlaceName(tree, stops.dropoff.place)} />

      <View style={styles.summaryDivider} />
      <SummaryRow label="Goods" value={goodsType.trim()} />
      <SummaryRow label="Weight" value={weight.trim() && !weightProblem(weight) ? formatKg(Number(weight)) : null} />
      <SummaryRow label="Pickup" value={dayLabel(pickupDay, days[0])} />
      <SummaryRow label="Photos" value={photos.length ? String(photos.length) : null} empty="None" />

      {triedToPost && stillNeededText ? (
        <View style={styles.stillNeeded}>
          <Icon name="warning" size={iconSize.sm} color={colors.errorText} />
          <Text style={styles.stillNeededText}>{stillNeededText}</Text>
        </View>
      ) : null}

      <Button title="Find Trucks" icon="search" onPress={handleFindTrucks} loading={posting} style={styles.postButton} />
      <Text style={styles.footnote}>Next, you will see trucks that can carry this load and send your price.</Text>
    </Card>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Tell us what you are sending and where. Next, choose from trucks that can carry it.</Text>

      <View style={twoColumns ? styles.columns : null}>
        <View style={twoColumns ? styles.main : null}>
          <FormSection icon="load" title="Shipment" description="Trucks are matched to the weight, so give your best estimate." wide={wide}>
            <View style={halfRow}>
              <Input
                label="Goods Type"
                value={goodsType}
                onChangeText={setGoodsType}
                placeholder="Rice, cement, furniture..."
                icon="load"
                required
                maxLength={100}
                error={shown(!goodsType.trim() && 'Enter what you are shipping')}
                containerStyle={wide ? styles.grow2 : undefined}
              />
              <Input
                label="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="e.g. 6000"
                icon="weight"
                required
                error={shown(weightProblem(weight))}
                containerStyle={wide ? styles.grow1 : undefined}
              />
            </View>
          </FormSection>

          <FormSection icon="route" title="Route" description="Choose each address from Nepal's official lists." wide={wide}>
            <RouteStop
              kind="pickup"
              stop={stops.pickup}
              onChange={updateStop('pickup')}
              tree={tree}
              errors={stopErrors(stops.pickup)}
              wide={wide}
              inlineActions={layout.isDesktop}
              savedAddress={savedAddress}
            />
            <View style={styles.stopDivider} />
            <RouteStop
              kind="dropoff"
              stop={stops.dropoff}
              onChange={updateStop('dropoff')}
              tree={tree}
              errors={stopErrors(stops.dropoff)}
              wide={wide}
              inlineActions={layout.isDesktop}
              savedAddress={savedAddress}
            />
          </FormSection>

          <FormSection icon="calendar" title="Pickup Date" description="When the truck should collect the goods." wide={wide}>
            <View style={styles.dayGrid} accessibilityRole="radiogroup">
              {days.map((day) => (
                <DayChip
                  key={day}
                  day={day}
                  today={days[0]}
                  selected={pickupDay === day}
                  onPress={() => setPickupDay(day)}
                  width={layout.isPhone ? '25%' : `${100 / days.length}%`}
                />
              ))}
            </View>
          </FormSection>

          <Card style={wide && styles.sectionWide}>
            <Disclosure
              bordered={false}
              icon="image"
              title="Description and Photos"
              hint={`Packaging, handling needs, and up to ${MAX_LOAD_PHOTOS} photos.`}
              badge={hasExtras
                ? <StatusPill label="Added" tone="success" icon="checkmark" />
                : <StatusPill label="Optional" />}
              open={moreOpen}
              onToggle={setMoreOpen}
            >
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Packaging, handling needs, loading help"
                multiline
                maxLength={1000}
                icon="document"
                style={styles.multiline}
              />
              <Text style={styles.fieldLabel}>{`Photos (${photos.length} of ${MAX_LOAD_PHOTOS})`}</Text>
              <PhotoStrip photos={photos} onRemove={removePhoto} />
              {photos.length < MAX_LOAD_PHOTOS && (
                <PhotoSourceButtons
                  onTakePhoto={() => handleAddPhotos('camera')}
                  onChoose={() => handleAddPhotos('library')}
                  chooseLabel="Choose Photos"
                  busy={photoBusy}
                  style={wide ? styles.photoButtonsWide : undefined}
                />
              )}
            </Disclosure>
          </Card>

          {!twoColumns && summary}
        </View>

        {twoColumns && <View style={[styles.side, stickyOnWeb]}>{summary}</View>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  intro: { ...type.body, color: colors.textMuted, marginBottom: spacing.xs },

  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  main: { flex: 1, minWidth: 0 },
  side: { width: 340 },

  sectionWide: { padding: spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: { flex: 1, minWidth: 0 },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  sectionDescription: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  row: { flexDirection: 'row', gap: spacing.lg },
  grow2: { flex: 2, minWidth: 0 },
  grow1: { flex: 1, minWidth: 0 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  fieldLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm },

  stopDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xxl },

  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  dayCell: { padding: spacing.xs },
  dayChip: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dayChipHovered: { borderColor: colors.borderStrong },
  dayChipSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  dayName: { ...type.smallMedium, color: colors.textPrimary },
  dayDate: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  dayTextSelected: { color: colors.primaryText },

  photoButtonsWide: { maxWidth: 440 },

  summaryTitle: { ...type.h3, color: colors.textPrimary, marginBottom: spacing.lg },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  routeDot: { width: 12, height: 12, borderRadius: radius.pill, marginTop: 4 },
  routeDotPickup: { backgroundColor: colors.accent },
  routeDotDropoff: { backgroundColor: colors.primary },
  routeConnector: { width: 2, height: 18, marginLeft: 5, marginVertical: spacing.xxs, backgroundColor: colors.border },
  routeText: { flex: 1, minWidth: 0 },
  routeLabel: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { ...type.bodyMedium, color: colors.textPrimary },
  muted: { color: colors.textMuted, fontWeight: '400' },

  summaryDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  summaryLabel: { ...type.small, color: colors.textMuted },
  summaryValue: { ...type.smallMedium, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },

  stillNeeded: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorMuted,
  },
  stillNeededText: { ...type.small, color: colors.errorText, flex: 1 },
  postButton: { marginTop: spacing.lg },
  footnote: { ...type.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});

export default CreateLoadScreen;
