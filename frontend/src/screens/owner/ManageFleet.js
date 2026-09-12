import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import { FLITO_COLORS } from '../../utils/colors';
import { TRUCK_TYPES } from '../../utils/constants';
import { getErrorMessage, pluralize } from '../../utils/helpers';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';

const ManageFleet = () => {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

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
      await load();
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

  if (loading) return <Spinner />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{pluralize(trucks.length, 'truck')}</Text>
        <Button
          title={adding ? 'Cancel' : 'Add Truck'}
          variant={adding ? 'outline' : 'primary'}
          onPress={() => setAdding((v) => !v)}
          style={styles.addButton}
        />
      </View>

      {adding && <AddTruckForm onAdded={async () => { setAdding(false); await load(); }} />}

      {trucks.length === 0 && !adding && (
        <Text style={styles.empty}>No trucks yet. Add one to start assigning drivers.</Text>
      )}

      {trucks.map((truck) => (
        <TruckCard
          key={truck._id}
          truck={truck}
          busy={busyId === truck._id}
          onAssignDriver={(driverPhone) =>
            runAction(truck._id, () => api.patch(`/trucks/${truck._id}/driver`, { driverPhone }))
          }
          onSetStatus={(status) =>
            runAction(truck._id, () => api.patch(`/trucks/${truck._id}`, { status }))
          }
          onDelete={() => handleDelete(truck)}
        />
      ))}
    </ScrollView>
  );
};

const AddTruckForm = ({ onAdded }) => {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [truckType, setTruckType] = useState('10-ton');
  const [capacity, setCapacity] = useState('');
  const [makeModel, setMakeModel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!registrationNumber.trim()) {
      notify('Missing info', 'Enter the truck registration number');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/trucks', {
        registrationNumber: registrationNumber.trim(),
        truckType,
        capacity: capacity ? Number(capacity) : undefined,
        makeModel: makeModel || undefined,
      });
      await onAdded();
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <Text style={styles.sectionTitle}>Add a Truck</Text>

      <Text style={styles.label}>Registration Number *</Text>
      <TextInput
        style={styles.input}
        value={registrationNumber}
        onChangeText={setRegistrationNumber}
        placeholder="BA 2 KHA 1234"
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Truck Type</Text>
      <View style={styles.chipRow}>
        {TRUCK_TYPES.filter((t) => t !== 'any').map((t) => (
          <Button
            key={t}
            title={t}
            variant={truckType === t ? 'primary' : 'outline'}
            onPress={() => setTruckType(t)}
            style={styles.chip}
          />
        ))}
      </View>

      <Text style={styles.label}>Capacity (kg)</Text>
      <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholder="e.g. 10000" />

      <Text style={styles.label}>Make / Model</Text>
      <TextInput style={styles.input} value={makeModel} onChangeText={setMakeModel} placeholder="e.g. Tata 1613" />

      <Button title="Add Truck" onPress={handleSubmit} loading={submitting} />
    </Card>
  );
};

const TruckCard = ({ truck, busy, onAssignDriver, onSetStatus, onDelete }) => {
  const [assigning, setAssigning] = useState(false);
  const [driverPhone, setDriverPhone] = useState('+977');

  const driver = truck.assignedDriverId;

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.reg}>{truck.registrationNumber}</Text>
        <StatusBadge status={truck.status} />
      </View>
      <Text style={styles.meta}>
        {truck.truckType}
        {truck.capacity ? ` · ${truck.capacity.toLocaleString()} kg` : ''}
        {truck.makeModel ? ` · ${truck.makeModel}` : ''}
      </Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Driver</Text>
        <Text style={styles.detailValue}>
          {driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned'}
        </Text>
      </View>

      {assigning ? (
        <View>
          <Text style={styles.label}>Driver Phone</Text>
          <TextInput
            style={styles.input}
            value={driverPhone}
            onChangeText={setDriverPhone}
            keyboardType="phone-pad"
            placeholder="+9779841234567"
          />
          <View style={styles.actionsRow}>
            <Button
              title="Assign"
              onPress={() => { setAssigning(false); onAssignDriver(driverPhone); }}
              loading={busy}
              style={styles.actionButton}
            />
            <Button title="Cancel" variant="outline" onPress={() => setAssigning(false)} style={styles.actionButton} />
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Button
            title={driver ? 'Change Driver' : 'Assign Driver'}
            variant="secondary"
            onPress={() => setAssigning(true)}
            style={styles.actionButton}
          />
          {driver && (
            <Button title="Unassign" variant="outline" onPress={() => onAssignDriver('')} loading={busy} style={styles.actionButton} />
          )}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Button
          title={truck.status === 'active' ? 'Mark In Maintenance' : 'Mark Active'}
          variant="outline"
          onPress={() => onSetStatus(truck.status === 'active' ? 'maintenance' : 'active')}
          loading={busy}
          style={styles.actionButton}
        />
        <Button title="Remove" variant="outline" onPress={onDelete} style={styles.actionButton} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heading: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary },
  addButton: { minWidth: 120, marginVertical: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reg: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary },
  meta: { fontSize: 13, color: FLITO_COLORS.textMuted, marginTop: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  detailLabel: { fontSize: 13, color: FLITO_COLORS.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: FLITO_COLORS.secondary },
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
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { flex: 1 },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 30, fontSize: 14 },
});

export default ManageFleet;
