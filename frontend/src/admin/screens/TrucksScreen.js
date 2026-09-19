import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/common/StatusBadge';
import DocumentTile from '../../components/kyc/DocumentTile';
import { TRUCK_DOCUMENT_LABELS } from '../../utils/constants';
import { bodyTypeLabel, formatDate, formatKg, truckTypeLabel } from '../../utils/helpers';
import api from '../../services/api';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, DocumentGrid } from '../components/AdminCard';
import ReviewActions from '../components/ReviewActions';
import { refreshAdminStats } from '../useAdminStats';
import { partyName } from '../format';

const FILTER_GROUPS = [
  {
    key: 'status',
    icon: 'verified',
    labelKey: 'admin:filters.verification',
    countKey: 'trucks.status',
    options: ['pending', 'approved', 'rejected', 'not_submitted'].map((value) => ({ value, labelKey: `common:status.${value}` })),
  },
];

// Truck document labels already live in the trucks namespace (translated by
// the group that owns it); reuse it rather than duplicating the strings here.
const documentLabel = (docType, t) => t(`trucks:documents.${docType}`, TRUCK_DOCUMENT_LABELS[docType] || docType);

const TruckCard = ({ truck, list }) => {
  const { t } = useTranslation();
  const owner = truck.owner;

  const decide = async (decision, reason) => {
    await api.patch(`/admin/trucks/${truck._id}`, { decision, reason });
    await list.refresh();
    refreshAdminStats();
  };

  const specs = [truckTypeLabel(truck.truckType, t), bodyTypeLabel(truck.bodyType, t), truck.capacity ? formatKg(truck.capacity) : null]
    .filter(Boolean).join(' · ');

  return (
    <AdminCard
      icon="truck"
      title={truck.registrationNumber}
      subtitle={[specs, truck.makeModel, truck.year].filter(Boolean).join(' · ')}
      right={<StatusBadge status={truck.verificationStatus || 'pending'} />}
      footer={truck.verificationStatus === 'pending' ? <ReviewActions audience="owner" onDecide={decide} /> : null}
    >
      <Fact icon="owner">
        {t('admin:truckQueue.owner', { details: [partyName(owner), owner?.phone, owner?.email].filter(Boolean).join(' · ') }) +
          (owner?.verified ? t('admin:truckQueue.verifiedSuffix') : t('admin:truckQueue.notVerifiedSuffix'))}
      </Fact>
      <Fact icon="document">
        {truck.chassisNumber || truck.engineNumber
          ? t('admin:truckQueue.chassisEngine', { chassis: truck.chassisNumber || '-', engine: truck.engineNumber || '-' })
          : null}
      </Fact>
      <Fact icon="calendar">{truck.bluebookRenewedUntil ? t('admin:truckQueue.bluebookTax', { date: formatDate(truck.bluebookRenewedUntil) }) : null}</Fact>
      <Fact icon="calendar">
        {truck.insurance?.validUntil
          ? t('admin:truckQueue.insuranceUntil', { date: formatDate(truck.insurance.validUntil) }) +
            (truck.insurance.company ? t('admin:truckQueue.insuranceCompanySuffix', { company: truck.insurance.company }) : '')
          : null}
      </Fact>
      <Fact icon="calendar">{truck.emissionTestValidUntil ? t('admin:truckQueue.greenSticker', { date: formatDate(truck.emissionTestValidUntil) }) : null}</Fact>
      <Fact icon="time">{truck.submittedAt ? t('admin:common.submitted', { date: formatDate(truck.submittedAt) }) : null}</Fact>
      {truck.documents?.length ? (
        <DocumentGrid>
          {truck.documents.map((doc) => (
            <DocumentTile key={doc._id} doc={doc} label={documentLabel(doc.type, t)} />
          ))}
        </DocumentGrid>
      ) : null}
    </AdminCard>
  );
};

const TrucksScreen = () => (
  <ResourceScreen
    page="trucks"
    endpoint="/admin/trucks"
    itemsKey="trucks"
    filterGroups={FILTER_GROUPS}
    emptyIcon="truck"
    renderItem={(truck, list) => <TruckCard truck={truck} list={list} />}
  />
);

export default TrucksScreen;
