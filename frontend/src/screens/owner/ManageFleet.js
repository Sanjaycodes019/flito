import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Spinner from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize } from '../../theme/tokens';
import { TRUCK_TYPES } from '../../utils/constants';
import { getErrorMessage, pluralize } from '../../utils/helpers';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
import useScreenLayout from '../../hooks/useScreenLayout';

const ManageFleet = () => {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const layout = useScreenLayout('narrow');

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
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{pluralize(trucks.length, 'truck')}</Text>
        <Button
          title={adding ? 'Cancel' : 'Add Truck'}
          icon={adding ? 'close' : 'add'}
          variant={adding ? 'tertiary' : 'primary'}
          size="sm"
          onPress={() => setAdding((v) => !v)}
          style={styles.addButton}
        />
      </View>

      {adding && <AddTruckForm onAdded={async () => { setAdding(false); await load(); }} />}

      {trucks.length === 0 && !adding && (
        <EmptyState icon="fleet" title="No trucks yet" message="Add one to start assigning drivers." />
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

      <Input
        label="Registration Number"
        value={registrationNumber}
        onChangeText={setRegistrationNumber}
        placeholder="BA 2 KHA 1234"
        autoCapitalize="characters"
        icon="truck"
        required
      />

      <Text style={styles.label}>Truck Type</Text>
      <View style={styles.chipRow}>
        {TRUCK_TYPES.filter((t) => t !== 'any').map((t) => (
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

      <Input label="Capacity (kg)" value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholder="e.g. 10000" icon="weight" />
      <Input label="Make / Model" value={makeModel} onChangeText={setMakeModel} placeholder="e.g. Tata 1613" icon="truck" />

      <Button title="Add Truck" icon="add" onPress={handleSubmit} loading={submitting} />
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
        <View style={styles.detailLabelRow}>
          <Icon name="driver" size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />
          <Text style={styles.detailLabel}>Driver</Text>
        </View>
        <Text style={styles.detailValue}>
          {driver
            // Unverified drivers can be on a truck but can't be put on a booking yet.
            ? `${driver.firstName} ${driver.lastName}${driver.kycStatus === 'approved' ? '' : ' (not verified)'}`
            : 'Unassigned'}
        </Text>
      </View>

      {assigning ? (
        <View>
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
            <Button title="Cancel" variant="ghost" onPress={() => setAssigning(false)} style={styles.actionButton} />
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Button
            title={driver ? 'Change Driver' : 'Assign Driver'}
            icon="driver"
            variant="secondary"
            onPress={() => setAssigning(true)}
            style={styles.actionButton}
          />
          {driver && (
            <Button title="Unassign" icon="close" variant="destructive" onPress={() => onAssignDriver('')} loading={busy} style={styles.actionButton} />
          )}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  heading: { ...type.h3, color: colors.textPrimary },
  addButton: { minWidth: 130 },
  sectionTitle: { ...type.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reg: { ...type.h3, color: colors.textPrimary },
  meta: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: spacing.xs },
  detailLabel: { ...type.small, color: colors.textMuted },
  detailValue: { ...type.smallMedium, color: colors.textPrimary },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { minWidth: 90 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});

export default ManageFleet;
