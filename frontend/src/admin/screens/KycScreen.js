import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/common/StatusBadge';
import DocumentTile from '../../components/kyc/DocumentTile';
import { formatDate, kycDocumentLabel, kycIdTypeLabel } from '../../utils/helpers';
import api from '../../services/api';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, DocumentGrid } from '../components/AdminCard';
import ReviewActions from '../components/ReviewActions';
import { refreshAdminStats } from '../useAdminStats';
import { displayName } from '../format';

const FILTER_GROUPS = [
  {
    key: 'status',
    icon: 'info',
    labelKey: 'admin:filters.status',
    countKey: 'kyc.status',
    allowAll: false,
    options: ['pending', 'approved', 'rejected'].map((value) => ({ value, labelKey: `common:status.${value}` })),
  },
];

const KycCard = ({ user, list }) => {
  const { t } = useTranslation();
  const status = list.filters.status || 'pending';

  const decide = async (decision, reason) => {
    await api.patch(`/admin/kyc/${user._id}`, { decision, reason });
    await list.refresh();
    refreshAdminStats();
  };

  const name = displayName(user);
  return (
    <AdminCard
      person={name}
      title={name}
      subtitle={[t(`admin:roles.${user.role}`, user.role), user.companyName].filter(Boolean).join(' · ')}
      right={<StatusBadge status={status} />}
      footer={status === 'pending' ? <ReviewActions audience="user" onDecide={decide} /> : null}
    >
      <Fact icon="email">{user.email}</Fact>
      <Fact icon="phone">{user.phone}</Fact>
      <Fact icon="owner">
        {user.addedBy ? t('admin:kycQueue.addedBy', { name: user.addedBy.name, phone: user.addedBy.phone || '' }) : null}
      </Fact>
      <Fact icon="idCard">
        {user.identityDocuments?.length
          ? t('admin:kycQueue.identity', { list: user.identityDocuments.map((idType) => kycIdTypeLabel(idType, t)).join(', ') })
          : null}
      </Fact>
      <Fact icon="calendar">{user.submittedAt ? t('admin:common.submitted', { date: formatDate(user.submittedAt) }) : null}</Fact>
      <DocumentGrid>
        {user.documents.map((doc) => (
          <DocumentTile key={doc._id} doc={doc} label={kycDocumentLabel(doc.type, t)} />
        ))}
      </DocumentGrid>
    </AdminCard>
  );
};

const KycScreen = () => (
  <ResourceScreen
    page="kyc"
    endpoint="/admin/kyc"
    itemsKey="users"
    initialFilters={{ status: 'pending' }}
    filterGroups={FILTER_GROUPS}
    emptyIcon="verified"
    renderItem={(user, list) => <KycCard user={user} list={list} />}
  />
);

export default KycScreen;
