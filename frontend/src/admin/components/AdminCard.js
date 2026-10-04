import React from 'react';
import { useTranslation } from 'react-i18next';
import RecordCard, { Pill } from '../../components/common/RecordCard';

// The admin lists use the app's one record card (components/common/
// RecordCard), plus a pill for where a verification stands.
export {
  Fact, Pill, RouteLine, PillRow, ActionRow, DocumentGrid,
} from '../../components/common/RecordCard';

const VERIFICATION_PILLS = {
  approved: { tone: 'success', icon: 'verified' },
  pending: { tone: 'warning', icon: 'time' },
  rejected: { tone: 'error', icon: 'unverified' },
  not_submitted: { tone: 'muted', icon: 'unverified' },
};

// Where a verification stands, worded for what is verified: a person's
// identity (`kind="identity"`) or a truck's papers (`kind="papers"`).
export const VerificationPill = ({ status, kind = 'identity' }) => {
  const { t } = useTranslation();
  const key = VERIFICATION_PILLS[status] ? status : 'not_submitted';
  const { tone, icon } = VERIFICATION_PILLS[key];
  return <Pill tone={tone} icon={icon}>{t(`admin:cards.${kind}.${key}`)}</Pill>;
};

export default RecordCard;
