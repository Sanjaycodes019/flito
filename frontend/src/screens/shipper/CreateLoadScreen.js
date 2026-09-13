import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import PhotoStrip from '../../components/common/PhotoStrip';
import LocationPickerMap from '../../components/map/LocationPickerMap';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize } from '../../theme/tokens';
import { TRUCK_TYPES, MAX_LOAD_PHOTOS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import { pickImages, uploadPhotos } from '../../services/uploads';
import { notify } from '../../utils/alert';
import { addLoad } from '../../redux/slices/loadsSlice';

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <Icon name={icon} size={iconSize.sm} color={colors.primary} style={styles.sectionIcon} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const CreateLoadScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [goodsType, setGoodsType] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [truckType, setTruckType] = useState('any');
  const [budgetEstimate, setBudgetEstimate] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAddPhotos = async () => {
    try {
      const assets = await pickImages({ max: MAX_LOAD_PHOTOS - photos.length });
      if (assets.length) setPhotos((current) => [...current, ...assets].slice(0, MAX_LOAD_PHOTOS));
    } catch (error) {
      notify('Could not add photos', getErrorMessage(error));
    }
  };

  const removePhoto = (_, index) => setPhotos((current) => current.filter((__, i) => i !== index));

  const handleSubmit = async () => {
    if (!goodsType || !pickupAddress || !dropoffAddress) {
      notify('Missing info', 'Goods type, pickup address, and dropoff address are required');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/loads', {
        goodsType,
        description,
        weight: weight ? Number(weight) : undefined,
        pickupLocation: { address: pickupAddress, phone: pickupPhone, coordinates: pickupCoords || undefined },
        dropoffLocation: { address: dropoffAddress, phone: dropoffPhone, coordinates: dropoffCoords || undefined },
        truckTypePreference: truckType,
        budgetEstimate: budgetEstimate ? Number(budgetEstimate) : undefined,
      });

      // The load is saved before its photos, so a failed upload never loses
      // the posting — photos can be retried from the load's page.
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
      const openLoad = () => navigation.replace('LoadDetail', { loadId: load._id });

      if (photoError) {
        notify('Load posted, but photos failed', `${photoError}. You can add them from the load's page.`, openLoad);
      } else {
        notify('Load posted', 'Truck owners can now submit quotes', openLoad);
      }
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Input label="Goods Type" value={goodsType} onChangeText={setGoodsType} placeholder="Rice, cement, furniture..." icon="load" required />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optional details" multiline icon="document" />
        <Input label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 500" icon="weight" />

        <SectionHeader icon="pickup" title="Pickup" />
        <Input label="Pickup Address" value={pickupAddress} onChangeText={setPickupAddress} placeholder="Kathmandu, Balaju" icon="pickup" required />
        <Input label="Pickup Contact Phone" value={pickupPhone} onChangeText={setPickupPhone} keyboardType="phone-pad" placeholder="+9779841234567" icon="phone" />
        <Text style={styles.mapLabel}>Pickup Point on Map (optional)</Text>
        <LocationPickerMap value={pickupCoords} onChange={setPickupCoords} />

        <SectionHeader icon="dropoff" title="Dropoff" />
        <Input label="Dropoff Address" value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Pokhara, Lakeside" icon="dropoff" required />
        <Input label="Dropoff Contact Phone" value={dropoffPhone} onChangeText={setDropoffPhone} keyboardType="phone-pad" placeholder="+9779841234567" icon="phone" />
        <Text style={styles.mapLabel}>Dropoff Point on Map (optional)</Text>
        <LocationPickerMap value={dropoffCoords} onChange={setDropoffCoords} />

        <Text style={styles.label}>Preferred Truck Type</Text>
        <View style={styles.chipRow}>
          {TRUCK_TYPES.map((t) => (
            <Button
              key={t}
              title={t}
              size="sm"
              variant={truckType === t ? 'primary' : 'tertiary'}
              onPress={() => setTruckType(t)}
              style={styles.chip}
            />
          ))}
        </View>

        <Input label="Budget Estimate (Rs.)" value={budgetEstimate} onChangeText={setBudgetEstimate} keyboardType="numeric" placeholder="Optional" icon="price" />

        <Text style={styles.label}>Photos ({photos.length}/{MAX_LOAD_PHOTOS})</Text>
        <PhotoStrip photos={photos} onRemove={removePhoto} />
        {photos.length < MAX_LOAD_PHOTOS && (
          <Button title="Add Photos" icon="camera" variant="tertiary" onPress={handleAddPhotos} />
        )}

        <Button title="Post Load" icon="load" onPress={handleSubmit} loading={loading} style={styles.submit} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
  mapLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sectionIcon: { marginRight: spacing.xs },
  sectionTitle: { ...type.smallMedium, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { minWidth: 90 },
  submit: { marginTop: spacing.md },
});

export default CreateLoadScreen;
