import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import PhotoStrip from '../../components/common/PhotoStrip';
import LocationPickerMap from '../../components/map/LocationPickerMap';
import { FLITO_COLORS } from '../../utils/colors';
import { TRUCK_TYPES, MAX_LOAD_PHOTOS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import { pickImages, uploadPhotos } from '../../services/uploads';
import { notify } from '../../utils/alert';
import { addLoad } from '../../redux/slices/loadsSlice';

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
        <Text style={styles.label}>Goods Type *</Text>
        <TextInput style={styles.input} value={goodsType} onChangeText={setGoodsType} placeholder="Rice, cement, furniture..." />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Optional details" multiline />

        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 500" />

        <Text style={styles.label}>Pickup Address *</Text>
        <TextInput style={styles.input} value={pickupAddress} onChangeText={setPickupAddress} placeholder="Kathmandu, Balaju" />

        <Text style={styles.label}>Pickup Contact Phone</Text>
        <TextInput style={styles.input} value={pickupPhone} onChangeText={setPickupPhone} keyboardType="phone-pad" placeholder="+9779841234567" />

        <Text style={styles.label}>Pickup Point on Map (optional)</Text>
        <LocationPickerMap value={pickupCoords} onChange={setPickupCoords} />

        <Text style={styles.label}>Dropoff Address *</Text>
        <TextInput style={styles.input} value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Pokhara, Lakeside" />

        <Text style={styles.label}>Dropoff Contact Phone</Text>
        <TextInput style={styles.input} value={dropoffPhone} onChangeText={setDropoffPhone} keyboardType="phone-pad" placeholder="+9779841234567" />

        <Text style={styles.label}>Dropoff Point on Map (optional)</Text>
        <LocationPickerMap value={dropoffCoords} onChange={setDropoffCoords} />

        <Text style={styles.label}>Preferred Truck Type</Text>
        <View style={styles.chipRow}>
          {TRUCK_TYPES.map((t) => (
            <Button
              key={t}
              title={t}
              variant={truckType === t ? 'primary' : 'outline'}
              onPress={() => setTruckType(t)}
              style={styles.chip}
            />
          ))}
        </View>

        <Text style={styles.label}>Budget Estimate (Rs.)</Text>
        <TextInput style={styles.input} value={budgetEstimate} onChangeText={setBudgetEstimate} keyboardType="numeric" placeholder="Optional" />

        <Text style={styles.label}>Photos ({photos.length}/{MAX_LOAD_PHOTOS})</Text>
        <PhotoStrip photos={photos} onRemove={removePhoto} />
        {photos.length < MAX_LOAD_PHOTOS && (
          <Button title="Add Photos" variant="outline" onPress={handleAddPhotos} />
        )}

        <Button title="Post Load" onPress={handleSubmit} loading={loading} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { minWidth: 90, marginVertical: 4 },
});

export default CreateLoadScreen;
