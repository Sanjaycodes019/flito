import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import CalendarToggle from '../../components/common/CalendarToggle';
import Input from '../../components/common/Input';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import StepWizard from '../../components/common/StepWizard';
import ChoiceTile, { ChoiceGrid } from '../../components/common/ChoiceTile';
import PhotoStrip from '../../components/common/PhotoStrip';
import PhotoSourceButtons from '../../components/common/PhotoSourceButtons';
import RouteStop, { emptyStop } from '../../components/loads/RouteStop';
import { isPlaceComplete, missingPlaceFields, shortPlaceName } from '../../components/address/NepalAddressFields';
import { colors, spacing, radius, type, themedStyles } from '../../theme/tokens';
import { MAX_LOAD_PHOTOS, MAX_LOAD_WEIGHT_KG, PICKUP_DAYS_SHOWN } from '../../utils/constants';
import { formatKg, getErrorMessage, isValidPhone } from '../../utils/helpers';
import { dayLabel, describeDay, upcomingDays } from '../../utils/nepalDate';
import useScreenLayout from '../../hooks/useScreenLayout';
import api from '../../services/api';
import { fetchLocations } from '../../services/locations';
import { pickImages, takePhoto, uploadPhotos } from '../../services/uploads';
import { notify } from '../../utils/alert';
import { addLoad } from '../../redux/slices/loadsSlice';

// Quick picks so most people never have to type. "Other" clears the box for their own words.
const GOODS_CHOICES = [
  { key: 'cement', icon: 'goodsCement' },
  { key: 'food', icon: 'goodsFood' },
  { key: 'furniture', icon: 'goodsFurniture' },
  { key: 'produce', icon: 'goodsProduce' },
  { key: 'stone', icon: 'goodsStone' },
  { key: 'fuel', icon: 'goodsFuel' },
  { key: 'machine', icon: 'goodsMachine' },
  { key: 'other', icon: 'goodsOther' },
];
const WEIGHT_CHOICES = [500, 1000, 2000, 5000, 10000, 20000];

const weightProblem = (text, t) => {
  const value = text.trim();
  if (!value) return t('loads:createLoad.errors.enterWeightKg');
  if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) return t('loads:createLoad.errors.enterWeightNumber');
  if (Number(value) > MAX_LOAD_WEIGHT_KG) return t('loads:createLoad.errors.maxWeight', { max: formatKg(MAX_LOAD_WEIGHT_KG) });
  return null;
};

const stopPayload = ({ place, contactPerson, phone, coordinates }) => ({
  ...place,
  tole: place.tole.trim(),
  ...(contactPerson.trim() ? { contactPerson: contactPerson.trim() } : {}),
  ...(phone.trim() ? { phone: phone.trim() } : {}),
  ...(coordinates ? { coordinates } : {}),
});

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

const RoutePoint = ({ kind, value }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.routePoint}>
      <View style={[styles.routeDot, kind === 'pickup' ? styles.routeDotPickup : styles.routeDotDropoff]} />
      <View style={styles.routeText}>
        <Text style={styles.routeLabel}>{kind === 'pickup' ? t('loads:common.pickup') : t('loads:common.dropoff')}</Text>
        <Text style={[styles.routeValue, !value && styles.muted]} numberOfLines={2}>{value || t('loads:createLoad.summary.notChosenYet')}</Text>
      </View>
    </View>
  );
};

const SummaryRow = ({ label, value, empty }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, !value && styles.muted]} numberOfLines={1}>{value || empty || t('loads:createLoad.summary.notSet')}</Text>
    </View>
  );
};

// Step one of booking a truck, one question at a time: what, how heavy, where
// from, where to, and when. Photos and a note are optional. The last step shows
// everything back and posting opens the trucks that can carry it.
const CreateLoadScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const savedAddress = useSelector((state) => state.auth.user?.address);
  // A single column up to tablet; on a laptop the form and a summary sit side by side.
  const layout = useScreenLayout('narrow');

  const days = upcomingDays(PICKUP_DAYS_SHOWN);

  const [tree, setTree] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [goodsType, setGoodsType] = useState('');
  const [weight, setWeight] = useState('');
  const [stops, setStops] = useState({ pickup: emptyStop, dropoff: emptyStop });
  const [pickupDay, setPickupDay] = useState(days[0]);
  const scrollRef = useRef(null);
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
        <EmptyState icon="offline" tone="error" title={t('loads:createLoad.couldNotLoadAddressOptionsTitle')} message={loadError} actionLabel={t('loads:common.tryAgain')} onAction={loadTree} />
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
      notify(t('loads:createLoad.couldNotAddPhotosTitle'), getErrorMessage(error));
    }
    setPhotoBusy(null);
  };

  const removePhoto = (_, index) => setPhotos((current) => current.filter((__, i) => i !== index));

  const phoneInvalid = (stop) => Boolean(stop.phone.trim()) && !isValidPhone(stop.phone.trim());
  const stillNeeded = [
    !goodsType.trim() && t('loads:createLoad.missing.goodsType'),
    !weight.trim() && t('loads:createLoad.missing.weight'),
    !isPlaceComplete(stops.pickup.place) && t('loads:createLoad.missing.pickupAddress'),
    !isPlaceComplete(stops.dropoff.place) && t('loads:createLoad.missing.dropoffAddress'),
  ].filter(Boolean);
  const hasInvalidField = Boolean(weight.trim() && weightProblem(weight, t))
    || phoneInvalid(stops.pickup) || phoneInvalid(stops.dropoff);

  // Errors show only once the user has tried to post, not while they fill in.
  const shown = (message) => (triedToPost ? message || null : null);
  const stopErrors = (stop) => (triedToPost
    ? { ...missingPlaceFields(stop.place, 'the'), phone: phoneInvalid(stop) ? t('loads:createLoad.phoneHint') : null }
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
        notify(t('loads:createLoad.loadPostedPhotosFailedTitle'), t('loads:createLoad.loadPostedPhotosFailedMessage', { error: photoError }), openMatches);
      } else {
        openMatches();
      }
    } catch (error) {
      notify(t('loads:createLoad.couldNotPostLoadTitle'), getErrorMessage(error));
      setPosting(false);
    }
  };

  const hasExtras = Boolean(description.trim()) || photos.length > 0;

  const stepTitle = (key) => t(`loads:createLoad.steps.${key}.title`);
  const stepHint = (key) => t(`loads:createLoad.steps.${key}.hint`);

  const goodsChoices = GOODS_CHOICES.map((choice) => ({ ...choice, label: t(`loads:createLoad.goodsChoices.${choice.key}`) }));
  const weightChoices = WEIGHT_CHOICES.map((kg) => ({ kg, label: formatKg(kg) }));
  const stopDone = (stop) => isPlaceComplete(stop.place) && !phoneInvalid(stop);

  const steps = [
    {
      key: 'goods',
      icon: 'load',
      title: stepTitle('goods'),
      hint: stepHint('goods'),
      check: () => Boolean(goodsType.trim()),
      content: (
        <>
          <ChoiceGrid>
            {goodsChoices.map((choice) => (
              <ChoiceTile
                key={choice.key}
                icon={choice.icon}
                label={choice.label}
                columns={4}
                selected={choice.key !== 'other' && goodsType === choice.label}
                onPress={() => setGoodsType(choice.key === 'other' ? '' : choice.label)}
              />
            ))}
          </ChoiceGrid>
          <Input
            label={t('loads:createLoad.goodsTypeLabel')}
            value={goodsType}
            onChangeText={setGoodsType}
            placeholder={t('loads:createLoad.goodsTypePlaceholder')}
            icon="load"
            required
            maxLength={100}
            error={shown(!goodsType.trim() && t('loads:createLoad.errors.enterGoodsType'))}
          />
        </>
      ),
    },
    {
      key: 'weight',
      icon: 'weight',
      title: stepTitle('weight'),
      hint: stepHint('weight'),
      check: () => !weightProblem(weight, t),
      content: (
        <>
          <ChoiceGrid>
            {weightChoices.map((choice) => (
              <ChoiceTile
                key={choice.kg}
                label={choice.label}
                columns={3}
                selected={weight.trim() === String(choice.kg)}
                onPress={() => setWeight(String(choice.kg))}
              />
            ))}
          </ChoiceGrid>
          <Input
            label={t('loads:createLoad.weightLabel')}
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            placeholder={t('loads:createLoad.weightPlaceholder')}
            icon="weight"
            required
            error={shown(weightProblem(weight, t))}
            helperText={t('loads:createLoad.weightHelper')}
          />
        </>
      ),
    },
    {
      key: 'pickup',
      icon: 'pickup',
      title: stepTitle('pickup'),
      hint: stepHint('pickup'),
      check: () => stopDone(stops.pickup),
      content: (
        <RouteStop kind="pickup" stop={stops.pickup} onChange={updateStop('pickup')} tree={tree} errors={stopErrors(stops.pickup)} savedAddress={savedAddress} />
      ),
    },
    {
      key: 'dropoff',
      icon: 'dropoff',
      title: stepTitle('dropoff'),
      hint: stepHint('dropoff'),
      check: () => stopDone(stops.dropoff),
      content: (
        <RouteStop kind="dropoff" stop={stops.dropoff} onChange={updateStop('dropoff')} tree={tree} errors={stopErrors(stops.dropoff)} savedAddress={savedAddress} />
      ),
    },
    {
      key: 'date',
      icon: 'calendar',
      title: stepTitle('date'),
      hint: stepHint('date'),
      content: (
        <>
          <CalendarToggle compact style={styles.calendarToggle} />
          <View style={styles.dayGrid} accessibilityRole="radiogroup">
            {days.map((day) => (
              <DayChip key={day} day={day} today={days[0]} selected={pickupDay === day} onPress={() => setPickupDay(day)} width={layout.isPhone ? '25%' : `${100 / days.length}%`} />
            ))}
          </View>
        </>
      ),
    },
    {
      key: 'extras',
      icon: 'image',
      title: stepTitle('extras'),
      hint: stepHint('extras'),
      optional: true,
      isEmpty: () => !hasExtras,
      content: (
        <>
          <Input
            label={t('loads:createLoad.descriptionLabel')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('loads:createLoad.descriptionPlaceholder')}
            multiline
            maxLength={1000}
            icon="document"
            style={styles.multiline}
          />
          <Text style={styles.fieldLabel}>{t('loads:createLoad.photosCount', { count: photos.length, max: MAX_LOAD_PHOTOS })}</Text>
          <PhotoStrip photos={photos} onRemove={removePhoto} />
          {photos.length < MAX_LOAD_PHOTOS && (
            <PhotoSourceButtons
              onTakePhoto={() => handleAddPhotos('camera')}
              onChoose={() => handleAddPhotos('library')}
              chooseLabel={t('loads:common.choosePhotos')}
              busy={photoBusy}
            />
          )}
        </>
      ),
    },
    {
      key: 'review',
      icon: 'success',
      title: stepTitle('review'),
      hint: stepHint('review'),
      content: (
        <Card>
          <RoutePoint kind="pickup" value={shortPlaceName(tree, stops.pickup.place)} />
          <View style={styles.routeConnector} />
          <RoutePoint kind="dropoff" value={shortPlaceName(tree, stops.dropoff.place)} />
          <View style={styles.summaryDivider} />
          <SummaryRow label={t('loads:createLoad.summary.goods')} value={goodsType.trim()} />
          <SummaryRow label={t('loads:createLoad.summary.weight')} value={weight.trim() && !weightProblem(weight, t) ? formatKg(Number(weight)) : null} />
          <SummaryRow label={t('loads:createLoad.summary.pickup')} value={dayLabel(pickupDay, days[0])} />
          <SummaryRow label={t('loads:createLoad.summary.photos')} value={photos.length ? String(photos.length) : null} empty={t('loads:createLoad.summary.none')} />
          <Text style={styles.footnote}>{t('loads:createLoad.footnote')}</Text>
        </Card>
      ),
    },
  ];

  return (
    <View style={styles.container}>
      <StepWizard
        fixedFooter
        scrollRef={scrollRef}
        contentStyle={layout.contentStyle}
        steps={steps}
        finishLabel={t('loads:createLoad.findTrucksButton')}
        finishIcon="search"
        onFinish={handleFindTrucks}
        finishing={posting}
        onBlocked={() => setTriedToPost(true)}
        onAdvance={() => setTriedToPost(false)}
        onStepChange={() => scrollRef.current?.scrollTo({ y: 0, animated: false })}
      />
    </View>
  );
};

const styles = themedStyles(() => ({
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

  calendarToggle: { marginBottom: spacing.sm },
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
  dayName: { ...type.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.textPrimary },
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
}));

export default CreateLoadScreen;
