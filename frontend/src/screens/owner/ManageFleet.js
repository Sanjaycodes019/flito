import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { FLITO_COLORS } from '../../utils/colors';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import { notify } from '../../utils/alert';

// A lightweight driver directory: look a driver up by phone before assigning
// them to a specific booking (done from BookingDetailScreen). FLITO doesn't
// yet model owned trucks/a driver roster — that's a natural next feature
// once bookings and driver assignment are validated in real use.
const ManageFleet = () => {
  const [phone, setPhone] = useState('+977');
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setDriver(null);
    try {
      const { data } = await api.get('/users/lookup', { params: { phone } });
      setDriver(data.driver);
    } catch (error) {
      if (error.response?.status !== 404) {
        notify('Error', getErrorMessage(error));
      }
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>Look up a driver by phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+9779841234567"
          keyboardType="phone-pad"
        />
        <Button title="Search" onPress={handleSearch} loading={loading} />
      </Card>

      {searched && !loading && !driver && (
        <Text style={styles.empty}>No driver found with that phone number</Text>
      )}

      {driver && (
        <Card>
          <Text style={styles.name}>{driver.firstName} {driver.lastName}</Text>
          <Detail label="Phone" value={driver.phone} />
          <Detail label="KYC Status" value={driver.kycStatus} />
          <Detail label="Rating" value={driver.rating ? `${driver.rating.toFixed(1)} ★` : 'No ratings yet'} />
          <Detail label="Account Status" value={driver.status} />
          <Text style={styles.hint}>To assign this driver, open a pending booking and use "Assign a Driver" there.</Text>
        </Card>
      )}
    </ScrollView>
  );
};

const Detail = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  name: { fontSize: 18, fontWeight: '700', color: FLITO_COLORS.secondary, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  detailLabel: { fontSize: 13, color: FLITO_COLORS.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: FLITO_COLORS.secondary, textTransform: 'capitalize' },
  hint: { fontSize: 12, color: FLITO_COLORS.textMuted, marginTop: 12, fontStyle: 'italic' },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 20, fontSize: 14 },
});

export default ManageFleet;
