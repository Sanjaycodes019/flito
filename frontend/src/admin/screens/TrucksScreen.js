import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import DocumentTile from '../../components/kyc/DocumentTile';
import { TRUCK_DOCUMENT_LABELS } from '../../utils/constants';
import { bodyTypeLabel, formatDate, formatKg, truckTypeLabel } from '../../utils/helpers';
import api from '../../services/api';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, Pill, DocumentGrid, VerificationPill } from '../components/AdminCard';
import ReviewActions from '../components/ReviewActions';
import { refreshAdminStats } from '../useAdminStats';
import { partyName, formatPhone } from '../format';
import { openAdminRecord } from '../records';

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
  const navigation = useNavigation();
  const owner = truck.owner;

  const decide = async (decision, reason) => {
    await api.patch(`/admin/trucks/${truck._id}`, { decision, reason });
    await list.refresh();
    refreshAdminStats();
  };

  const specs = [truckTypeLabel(truck.truckType, t), bodyTypeLabel(truck.bodyType, t), truck.capacity ? formatKg(truck.capacity) : null]
    .filter(Boolean).join(' · ');
  const papers = [
    { key: 'bluebookTax', date: truck.bluebookRenewedUntil },
    { key: 'insurance', date: truck.insurance?.validUntil },
    { key: 'emissionTest', date: truck.emissionTestValidUntil },
  ];

  return (
    <AdminCard
      icon="truck"
      title={truck.registrationNumber}
      subtitle={[specs, truck.makeModel, truck.year].filter(Boolean).join(' · ')}
      badges={(
        <>
          <VerificationPill status={truck.verificationStatus || 'not_submitted'} kind="papers" />
          {owner?.verified ? <Pill icon="owner" tone="success">{t('admin:cards.ownerVerified')}</Pill> : null}
        </>
      )}
      onPress={() => openAdminRecord(navigation, 'truck', truck._id)}
      footer={truck.verificationStatus === 'pending' ? <ReviewActions audience="owner" onDecide={decide} /> : null}
    >
      <Fact icon="owner" label={t('admin:detail.truck.owner')}>{partyName(owner) || '—'}</Fact>
      <Fact icon="phone">{formatPhone(owner?.phone)}</Fact>
      {papers.map(({ key, date }) => {
        if (!date) return null;
        const expired = new Date(date).getTime() < Date.now();
        return (
          <Fact key={key} icon="document" label={t(`admin:detail.truck.${key}`)} tone={expired ? 'warning' : undefined}>
            {expired ? t('admin:detail.truck.expiredOn', { date: formatDate(date) }) : formatDate(date)}
          </Fact>
        );
      })}
      <Fact icon="time" label={t('admin:cards.sent')}>{truck.submittedAt ? formatDate(truck.submittedAt) : null}</Fact>
      {truck.documents?.length ? (
        <DocumentGrid>
          {truck.documents.map((doc) => (
            <DocumentTile key={doc._id} doc={doc} label={documentLabel(doc.type, t)} size={48} />
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
