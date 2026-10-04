import React from 'react';
import { View, Text, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import VerifiedBadge from '../../../components/common/VerifiedBadge';
import DocumentTile from '../../../components/kyc/DocumentTile';
import { colors, spacing, radius, type, themedStyles } from '../../../theme/tokens';
import { TRUCK_DOCUMENT_LABELS } from '../../../utils/constants';
import {
  bodyTypeLabel, formatCurrency, formatDate, formatKg, insuranceTypeLabel, serviceAreaLabel, truckFeatureLabel, truckTypeLabel,
} from '../../../utils/helpers';
import { dayLabel } from '../../../utils/nepalDate';
import api from '../../../services/api';
import useAdminRecord from '../../useAdminRecord';
import { refreshAdminStats } from '../../useAdminStats';
import { formatWhen } from '../../format';
import DetailPage from '../../components/detail/DetailPage';
import { Hero, Lead, Panel, InfoGrid, InfoItem, Muted } from '../../components/detail/DetailParts';
import VerificationPanel from '../../components/detail/VerificationPanel';
import RelatedList from '../../components/detail/RelatedList';
import HistoryTimeline from '../../components/detail/HistoryTimeline';
import { BookingRow, PersonRow } from '../../components/detail/rows';

const documentLabel = (docType, t) => t(`trucks:documents.${docType}`, TRUCK_DOCUMENT_LABELS[docType] || docType);

// A paper's expiry: the date, and a warning once it has passed or is close.
const SOON_MS = 30 * 24 * 60 * 60 * 1000;
const expiry = (date, t) => {
  if (!date) return { value: null };
  const left = new Date(date).getTime() - Date.now();
  if (left < 0) return { value: t('admin:detail.truck.expiredOn', { date: formatDate(date) }), tone: 'warning' };
  if (left < SOON_MS) return { value: t('admin:detail.truck.expiresSoon', { date: formatDate(date) }), tone: 'warning' };
  return { value: t('admin:detail.truck.validUntil', { date: formatDate(date) }), tone: 'success' };
};

const PersonPanel = ({ icon, title, person, role, emptyText }) => {
  const { t } = useTranslation();
  return (
    <Panel icon={icon} title={title}>
      {person ? (
        <>
          <PersonRow first person={person} role={role} />
          {person.phone ? (
            <Button title={t('admin:detail.call')} icon="phone" variant="secondary" size="sm" onPress={() => Linking.openURL(`tel:${person.phone}`)} />
          ) : null}
        </>
      ) : <Muted>{emptyText}</Muted>}
    </Panel>
  );
};

// One truck: what it is, its papers and whether they are current, where it
// works and for how much, who owns and drives it, its verification with the
// papers sent, its bookings, and what admins have done to it.
const TruckDetailScreen = ({ route }) => {
  const { t } = useTranslation();
  const { truckId } = route.params;
  const record = useAdminRecord(`/admin/trucks/${truckId}`);
  const { truck, counts = {}, history = [] } = record.data || {};

  const decide = async (decision, reason) => {
    await api.patch(`/admin/trucks/${truckId}`, { decision, reason });
    await record.refresh();
    refreshAdminStats();
  };
  const revoke = async (reason) => {
    await api.post(`/admin/trucks/${truckId}/revoke`, { reason });
    await record.refresh();
    refreshAdminStats();
  };

  if (!truck) return <DetailPage kind="truck" record={record} />;

  const verification = truck.verification;
  const features = Object.entries(truck.features || {}).filter(([, on]) => on).map(([key]) => truckFeatureLabel(key, t, 'short'));
  const bluebook = expiry(truck.bluebookRenewedUntil, t);
  const insurance = expiry(truck.insurance?.validUntil, t);
  const emission = expiry(truck.emissionTestValidUntil, t);
  const bed = truck.cargoBed;

  return (
    <DetailPage
      kind="truck"
      record={record}
      title={truck.registrationNumber}
      hero={(
        <Hero
          lead={<Lead icon="truck" size={72} />}
          kicker={truckTypeLabel(truck.truckType, t)}
          title={truck.registrationNumber}
          subtitle={[truck.makeModel, truck.year, truck.capacity ? t('admin:detail.truck.carries', { capacity: formatKg(truck.capacity) }) : null].filter(Boolean).join(' · ')}
          badges={(
            <>
              {verification.status === 'approved' ? <VerifiedBadge size={22} label={t('loads:common.verifiedTruck')} /> : <StatusBadge status={verification.status} />}
              <StatusBadge status={truck.status} />
            </>
          )}
          stats={[
            { icon: 'truckDelivery', value: counts.bookings ?? 0, label: t('admin:detail.stats.bookings', { count: counts.bookings ?? 0 }) },
            { icon: 'route', value: counts.activeBookings ?? 0, label: t('admin:detail.stats.active') },
            { icon: 'success', value: counts.completedBookings ?? 0, label: t('admin:detail.stats.completed') },
            { icon: 'calendar', value: truck.bookedDays.length, label: t('admin:detail.stats.bookedDays', { count: truck.bookedDays.length }) },
          ]}
        />
      )}
      side={(
        <>
          <VerificationPanel
            title={t('admin:detail.truck.verification')}
            audience="owner"
            status={verification.status}
            rejectionReason={verification.rejectionReason}
            submittedAt={verification.submittedAt}
            reviewedAt={verification.reviewedAt}
            reviewedBy={verification.reviewedBy}
            missing={verification.missingDocuments.map((type) => documentLabel(type, t))}
            onDecide={decide}
            onRevoke={revoke}
          />
          <PersonPanel icon="owner" title={t('admin:detail.truck.owner')} person={truck.owner} role={t('admin:roles.owner')} />
          <PersonPanel icon="driver" title={t('admin:detail.truck.driver')} person={truck.driver} role={t('admin:roles.driver')} emptyText={t('admin:detail.truck.noDriver')} />
          <HistoryTimeline entries={history} />
        </>
      )}
    >
      <Panel icon="truck" title={t('admin:detail.truck.specs')}>
        <InfoGrid>
          <InfoItem label={t('admin:detail.truck.type')} value={truckTypeLabel(truck.truckType, t)} />
          <InfoItem label={t('admin:detail.truck.body')} value={bodyTypeLabel(truck.bodyType, t)} />
          <InfoItem label={t('admin:detail.truck.capacity')} value={truck.capacity ? formatKg(truck.capacity) : null} />
          <InfoItem label={t('admin:detail.truck.makeModel')} value={truck.makeModel || [truck.make, truck.model].filter(Boolean).join(' ')} />
          <InfoItem label={t('admin:detail.truck.year')} value={truck.year} />
          <InfoItem label={t('admin:detail.truck.fuel')} value={truck.fuelType ? t(`trucks:fuelTypes.${truck.fuelType}.label`, truck.fuelType) : null} />
          <InfoItem
            label={t('admin:detail.truck.cargoBed')}
            value={bed ? [bed.lengthFt, bed.widthFt, bed.heightFt].filter(Boolean).join(' × ') + ' ft' : null}
          />
          <InfoItem label={t('admin:detail.truck.features')} value={features.join(', ')} />
        </InfoGrid>
      </Panel>

      <Panel icon="route" title={t('admin:detail.truck.operations')}>
        <InfoGrid>
          <InfoItem icon="location" label={t('admin:detail.truck.base')} value={truck.base ? `${truck.base.localLevel}, ${truck.base.district}` : null} />
          <InfoItem label={t('admin:detail.truck.serviceArea')} value={serviceAreaLabel(truck.serviceArea, t)} />
          <InfoItem label={t('admin:detail.truck.ratePerKm')} value={truck.ratePerKm ? t('admin:detail.truck.perKm', { price: formatCurrency(truck.ratePerKm) }) : null} />
          <InfoItem label={t('admin:detail.truck.minimumCharge')} value={truck.minimumCharge ? formatCurrency(truck.minimumCharge) : null} />
          <InfoItem label={t('admin:detail.truck.added')} value={formatWhen(truck.createdAt)} />
          <InfoItem label={t('admin:detail.truck.updated')} value={formatWhen(truck.updatedAt)} />
          <InfoItem label={t('admin:detail.truck.bookedDays')} wide>
            {truck.bookedDays.length ? (
              <View style={styles.days}>
                {truck.bookedDays.map((day) => <Text key={day} style={styles.day}>{dayLabel(day)}</Text>)}
              </View>
            ) : null}
          </InfoItem>
        </InfoGrid>
      </Panel>

      <Panel icon="document" title={t('admin:detail.truck.papers')}>
        <InfoGrid>
          <InfoItem label={t('admin:detail.truck.chassis')} value={truck.chassisNumber} />
          <InfoItem label={t('admin:detail.truck.engine')} value={truck.engineNumber} />
          <InfoItem label={t('admin:detail.truck.bluebookTax')} value={bluebook.value} tone={bluebook.tone} />
          <InfoItem label={t('admin:detail.truck.emissionTest')} value={emission.value} tone={emission.tone} />
          <InfoItem label={t('admin:detail.truck.insurance')} value={insurance.value} tone={insurance.tone} />
          <InfoItem
            label={t('admin:detail.truck.insurer')}
            value={truck.insurance ? [truck.insurance.company, truck.insurance.type ? insuranceTypeLabel(truck.insurance.type, t) : null, truck.insurance.policyNumber].filter(Boolean).join(' · ') : null}
          />
        </InfoGrid>
      </Panel>

      <Panel icon="idCard" title={t('admin:detail.truck.documents')} count={verification.documents.length}>
        {verification.documents.length ? (
          <View style={styles.documents}>
            {verification.documents.map((doc) => (
              <View key={doc._id} style={styles.document}>
                <DocumentTile doc={doc} label={documentLabel(doc.type, t)} size={64} />
              </View>
            ))}
          </View>
        ) : <Muted>{t('admin:detail.truck.noDocuments')}</Muted>}
      </Panel>

      <RelatedList
        icon="truckDelivery"
        title={t('admin:detail.related.bookings')}
        endpoint="/admin/bookings"
        itemsKey="bookings"
        filters={{ truckId: truck._id }}
        emptyText={t('admin:detail.related.noBookings')}
        renderRow={(booking, first) => <BookingRow booking={booking} first={first} />}
      />
    </DetailPage>
  );
};

const styles = themedStyles(() => ({
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xxs },
  day: {
    ...type.smallMedium,
    color: colors.primaryText,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  documents: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm },
  document: { width: '100%', maxWidth: 360, flexGrow: 1, flexBasis: 240, paddingHorizontal: spacing.sm },
}));

export default TruckDetailScreen;
