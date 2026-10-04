import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import DocumentTile from '../../components/kyc/DocumentTile';
import { formatDate, kycDocumentLabel, kycIdTypeLabel } from '../../utils/helpers';
import api from '../../services/api';
import ResourceScreen from '../components/ResourceScreen';
import AdminCard, { Fact, DocumentGrid, VerificationPill } from '../components/AdminCard';
import ReviewActions from '../components/ReviewActions';
import { refreshAdminStats } from '../useAdminStats';
import { displayName, formatPhone } from '../format';
import { openAdminRecord } from '../records';

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
  const navigation = useNavigation();
  const status = list.filters.status || 'pending';

  const decide = async (decision, reason) => {
    await api.patch(`/admin/kyc/${user._id}`, { decision, reason });
    await list.refresh();
    refreshAdminStats();
  };

  const name = displayName(user) || user.email || formatPhone(user.phone);
  return (
    <AdminCard
      person={name}
      title={name}
      subtitle={[t(`admin:roles.${user.role}`, user.role), user.companyName].filter(Boolean).join(' · ')}
      badges={<VerificationPill status={status} />}
      onPress={() => openAdminRecord(navigation, 'user', user._id)}
      footer={status === 'pending' ? <ReviewActions audience="user" onDecide={decide} /> : null}
    >
      <Fact icon="email">{user.email}</Fact>
      <Fact icon="phone">{formatPhone(user.phone)}</Fact>
      <Fact icon="owner" lines={2}>
        {user.addedBy ? t('admin:kycQueue.addedBy', { name: user.addedBy.name, phone: formatPhone(user.addedBy.phone) }) : null}
      </Fact>
      <Fact icon="idCard" lines={2}>
        {user.identityDocuments?.length
          ? t('admin:kycQueue.identity', { list: user.identityDocuments.map((idType) => kycIdTypeLabel(idType, t)).join(', ') })
          : null}
      </Fact>
      <Fact icon="time" label={t('admin:cards.sent')}>{user.submittedAt ? formatDate(user.submittedAt) : null}</Fact>
      {user.documents?.length ? (
        <DocumentGrid>
          {user.documents.map((doc) => (
            <DocumentTile key={doc._id} doc={doc} label={kycDocumentLabel(doc.type, t)} size={48} />
          ))}
        </DocumentGrid>
      ) : null}
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
