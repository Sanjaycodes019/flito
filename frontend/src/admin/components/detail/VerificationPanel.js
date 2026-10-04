import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import { spacing, themedStyles } from '../../../theme/tokens';
import { formatDate } from '../../../utils/helpers';
import ReviewActions from '../ReviewActions';
import ReasonModal from './ReasonModal';
import { Panel, Notice, Muted } from './DetailParts';

// Where a verification stands (a person's identity, or a truck's papers),
// and what an admin can do about it:
//   pending       approve, or reject with a reason
//   approved      remove the verification ("unverify") with a reason
//   rejected      the reason they were given; they can send documents again
//   not_submitted what is still missing
//
// `onDecide(decision, reason)` and `onRevoke(reason)` return promises; a
// failure is shown where the admin acted.
const VerificationPanel = ({
  title, audience, status, rejectionReason, submittedAt, reviewedAt, reviewedBy, missing = [], onDecide, onRevoke,
}) => {
  const { t } = useTranslation();
  const [revoking, setRevoking] = useState(false);
  const pending = status === 'pending';
  const reviewer = reviewedBy?.name;

  return (
    <Panel
      icon="verified"
      title={title}
      tone={pending ? 'attention' : undefined}
      action={<StatusBadge status={status} />}
    >
      {status === 'approved' ? (
        <>
          <Notice tone="success" title={t(`admin:verification.approvedTitle.${audience}`)}>
            {reviewedAt
              ? (reviewer ? t('admin:verification.reviewedBy', { date: formatDate(reviewedAt), name: reviewer }) : t('admin:verification.reviewedOn', { date: formatDate(reviewedAt) }))
              : null}
          </Notice>
          <Button
            title={t('admin:verification.revokeButton')}
            icon="unverified"
            variant="tertiary"
            onPress={() => setRevoking(true)}
            style={styles.revoke}
          />
          <ReasonModal
            visible={revoking}
            title={t('admin:verification.revokeTitle')}
            message={t(`admin:verification.revokeMessage.${audience}`)}
            confirmLabel={t('admin:verification.revokeConfirm')}
            destructive
            onConfirm={onRevoke}
            onClose={() => setRevoking(false)}
          />
        </>
      ) : null}

      {pending ? (
        <>
          <Notice tone="warning" title={t('admin:verification.pendingTitle')}>
            {submittedAt ? t('admin:verification.submittedOn', { date: formatDate(submittedAt) }) : null}
          </Notice>
          <Muted>{t(`admin:verification.pendingHint.${audience}`)}</Muted>
          <View style={styles.review}>
            <ReviewActions audience={audience} onDecide={onDecide} />
          </View>
        </>
      ) : null}

      {status === 'rejected' ? (
        <Notice tone="error" title={t('admin:verification.rejectedTitle')}>
          {[rejectionReason, reviewedAt ? (reviewer
            ? t('admin:verification.reviewedBy', { date: formatDate(reviewedAt), name: reviewer })
            : t('admin:verification.reviewedOn', { date: formatDate(reviewedAt) })) : null].filter(Boolean).join('\n')}
        </Notice>
      ) : null}

      {status === 'not_submitted' || !status ? (
        <Notice tone="info" title={t(`admin:verification.notSubmittedTitle.${audience}`)}>
          {missing.length ? t('admin:verification.missing', { list: missing.join(', ') }) : null}
        </Notice>
      ) : null}
    </Panel>
  );
};

const styles = themedStyles(() => ({
  revoke: { alignSelf: 'stretch' },
  review: { marginTop: spacing.xs },
}));

export default VerificationPanel;
