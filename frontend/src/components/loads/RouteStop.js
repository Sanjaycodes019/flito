import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button';
import Input from '../common/Input';
import Disclosure from '../common/Disclosure';
import { StatusPill } from '../common/SettingsList';
import LocationPickerMap from '../map/LocationPickerMap';
import NepalAddressFields, {
  AREA_FIELDS,
  DetectedLocationNotice,
  emptyPlace,
  isPlaceComplete,
  mergeDetectedPlace,
} from '../address/NepalAddressFields';
import useCurrentPlace from '../../hooks/useCurrentPlace';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

const CONTACT_NAME_MAX_LENGTH = 60;

export const emptyStop = { place: emptyPlace, contactPerson: '', phone: '', coordinates: null, detected: null };

// Icon/tint stay fixed per stop; the text is resolved from translations
// inside RouteStop, keyed by `kind`.
const STOP_STYLE = {
  pickup: { icon: 'pickup', tint: colors.accentMuted, ink: colors.accentText },
  dropoff: { icon: 'dropoff', tint: colors.primaryMuted, ink: colors.primaryText },
};

// The map stays folded away until someone wants to pin the exact spot.
const MapPin = ({ title, coordinates, onChange, wide }) => {
  const { t } = useTranslation();
  return (
    <Disclosure
      title={t('loads:routeStop.mapPin.title')}
      hint={coordinates
        ? t('loads:routeStop.mapPin.pinnedAt', { lat: coordinates.lat.toFixed(5), lng: coordinates.lng.toFixed(5) })
        : t('loads:routeStop.mapPin.hint')}
      icon="route"
      badge={coordinates ? <StatusPill label={t('loads:routeStop.mapPin.pinnedBadge')} tone="success" icon="checkmark" /> : null}
      accessibilityLabel={t('loads:routeStop.mapPin.accessibilityLabel', { title })}
    >
      <LocationPickerMap value={coordinates} onChange={onChange} height={wide ? 300 : 240} showLocateButton={false} />
      {coordinates && (
        <Button title={t('loads:routeStop.mapPin.removePin')} icon="trash" variant="ghost" size="sm" onPress={() => onChange(null)} style={styles.removePin} />
      )}
    </Disclosure>
  );
};

// One end of a load's route: the address from Nepal's official lists, and,
// folded away as optional, a contact at that end and a pin on the map.
// `onChange` takes a function of the current stop, so a location that arrives
// while the user is typing never overwrites what they typed. `wide` puts fields
// in pairs; `inlineActions` puts the location buttons beside the title, which
// needs more room than a tablet gives.
const RouteStop = ({ kind, stop, onChange, tree, errors = {}, wide = false, inlineActions = wide, savedAddress }) => {
  const { t } = useTranslation();
  const style = STOP_STYLE[kind];
  const meta = {
    ...style,
    title: t(`loads:common.${kind}`),
    hint: t(`loads:routeStop.${kind}.hint`),
    example: t(`loads:routeStop.${kind}.example`),
  };
  const { detect, detecting } = useCurrentPlace();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const update = (patch) => onChange((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));

  // A pin or detected point belongs to the area it was set in.
  const handlePlaceChange = (place, key) => update(AREA_FIELDS.includes(key)
    ? { place, coordinates: null, detected: null }
    : { place });

  const handleUseCurrentLocation = async () => {
    const result = await detect();
    if (!result) return;
    update((current) => ({ place: mergeDetectedPlace(current.place, result), coordinates: result.coordinates, detected: result }));
  };

  const canUseSaved = Boolean(savedAddress) && isPlaceComplete(savedAddress);
  const handleUseSaved = () => update({
    place: {
      provinceId: savedAddress.provinceId,
      districtId: savedAddress.districtId,
      localLevelId: savedAddress.localLevelId,
      ward: savedAddress.ward,
      tole: savedAddress.tole,
    },
    coordinates: null,
    detected: null,
  });

  const lower = meta.title.toLowerCase();
  const actions = (
    <View style={[styles.actions, inlineActions && styles.actionsInline]}>
      {canUseSaved && (
        <Button
          title={t('loads:routeStop.useMyAddress')}
          icon="home"
          variant="ghost"
          size="sm"
          onPress={handleUseSaved}
          accessibilityLabel={t('loads:routeStop.useMyAddressFor', { stop: lower })}
        />
      )}
      <Button
        title={t('loads:routeStop.useCurrentLocation')}
        icon="gps"
        variant="tertiary"
        size="sm"
        onPress={handleUseCurrentLocation}
        loading={detecting}
        accessibilityLabel={t('loads:routeStop.useCurrentLocationFor', { stop: lower })}
      />
    </View>
  );

  const toleIsSuggestion = Boolean(stop.detected?.areaName) && stop.place.tole === stop.detected.areaName;
  const halfStyle = wide ? styles.half : undefined;

  const added = [stop.contactPerson.trim(), stop.phone.trim(), stop.coordinates && t('loads:routeStop.pinnedOnMap')].filter(Boolean);
  // A problem inside keeps the details open, so the error can be seen.
  const showDetails = detailsOpen || Boolean(errors.phone);

  return (
    <View>
      <View style={styles.header}>
        <View style={[styles.marker, { backgroundColor: meta.tint }]}>
          <Icon name={meta.icon} size={iconSize.md} color={meta.ink} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">{meta.title}</Text>
          <Text style={styles.hint}>{meta.hint}</Text>
        </View>
        {inlineActions && actions}
      </View>
      {!inlineActions && actions}

      {stop.detected && (
        <DetectedLocationNotice detected={stop.detected} hint={t('loads:routeStop.detectedHint')} />
      )}

      <NepalAddressFields
        tree={tree}
        value={stop.place}
        onChange={handlePlaceChange}
        errors={errors}
        columns={wide}
        labelPrefix={meta.title}
        tolePlaceholder={meta.example}
        toleHelperText={toleIsSuggestion ? t('loads:routeStop.toleSuggestionHelperText') : undefined}
      />

      <Disclosure
        title={t('loads:routeStop.contactAndExactPoint')}
        hint={added.length ? added.join(' · ') : t('loads:routeStop.contactHint')}
        icon="phone"
        badge={<StatusPill label={added.length ? t('loads:routeStop.addedBadge') : t('loads:routeStop.optionalBadge')} tone={added.length ? 'success' : 'muted'} />}
        open={showDetails}
        onToggle={setDetailsOpen}
        accessibilityLabel={t('loads:routeStop.contactAndExactPointFor', { title: meta.title })}
      >
        <View style={wide ? styles.row : null}>
          <Input
            label={t('loads:routeStop.contactNameLabel')}
            accessibilityLabel={t('loads:routeStop.contactNameFor', { title: meta.title })}
            value={stop.contactPerson}
            onChangeText={(contactPerson) => update({ contactPerson })}
            placeholder={t('loads:routeStop.contactNamePlaceholder')}
            icon="person"
            maxLength={CONTACT_NAME_MAX_LENGTH}
            containerStyle={halfStyle}
          />
          <Input
            label={t('loads:routeStop.contactPhoneLabel')}
            accessibilityLabel={t('loads:routeStop.contactPhoneFor', { title: meta.title })}
            value={stop.phone}
            onChangeText={(phone) => update({ phone })}
            placeholder="+9779841234567"
            keyboardType="phone-pad"
            icon="phone"
            maxLength={14}
            error={errors.phone}
            containerStyle={halfStyle}
          />
        </View>
        <MapPin title={meta.title} coordinates={stop.coordinates} onChange={(coordinates) => update({ coordinates })} wide={wide} />
        <View style={styles.detailsEnd} />
      </Disclosure>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  marker: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, minWidth: 0 },
  title: { ...type.h3, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },

  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  actionsInline: { marginBottom: 0, justifyContent: 'flex-end' },

  row: { flexDirection: 'row', gap: spacing.lg },
  half: { flex: 1, minWidth: 0 },

  removePin: { alignSelf: 'flex-end' },
  detailsEnd: { height: spacing.md },
});

export default RouteStop;
