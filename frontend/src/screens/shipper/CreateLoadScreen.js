import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { FLITO_COLORS } from '../../utils/colors';
import { TRUCK_TYPES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import { notify } from '../../utils/alert';
import { addLoad } from '../../redux/slices/loadsSlice';

const CreateLoadScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [goodsType, setGoodsType] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');
  const [truckType, setTruckType] = useState('any');
  const [budgetEstimate, setBudgetEstimate] = useState('');
  const [loading, setLoading] = useState(false);

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
        pickupLocation: { address: pickupAddress, phone: pickupPhone },
        dropoffLocation: { address: dropoffAddress, phone: dropoffPhone },
        truckTypePreference: truckType,
        budgetEstimate: budgetEstimate ? Number(budgetEstimate) : undefined,
      });
      dispatch(addLoad(data.load));
      notify('Load posted', 'Truck owners can now submit quotes', () =>
        navigation.replace('LoadDetail', { loadId: data.load._id })
      );
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

        <Text style={styles.label}>Dropoff Address *</Text>
        <TextInput style={styles.input} value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Pokhara, Lakeside" />

        <Text style={styles.label}>Dropoff Contact Phone</Text>
        <TextInput style={styles.input} value={dropoffPhone} onChangeText={setDropoffPhone} keyboardType="phone-pad" placeholder="+9779841234567" />

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
