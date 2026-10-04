import React from 'react';
import PublicLayout from '../components/PublicLayout';
import PageHero from '../components/PageHero';
import LegalDocument from '../components/LegalDocument';
import { formatDayKey } from '../../utils/nepalDate';
import { useCalendar } from '../../services/calendarPreference';
import { useContent, LEGAL_UPDATED } from '../content';

// Terms of Service and Privacy Policy share one page: the document's hero with
// its last-updated date (in the reader's own calendar) and reading time, then
// the document itself from legal.json.
const LegalScreen = ({ doc }) => {
  const { t, list } = useContent();
  const calendar = useCalendar();
  const date = formatDayKey(LEGAL_UPDATED, { calendar });

  return (
    <PublicLayout pageKey={doc}>
      <PageHero
        eyebrow={t(`legal:${doc}.hero.eyebrow`)}
        eyebrowIcon={doc === 'terms' ? 'terms' : 'privacy'}
        title={t(`legal:${doc}.hero.title`)}
        lead={t(`legal:${doc}.hero.lead`)}
        meta={[
          { icon: 'calendarCheck', label: t('site:legal.updated', { date }) },
          { icon: 'time', label: t('site:legal.readTime', { minutes: t(`legal:${doc}.readMinutes`) }) },
        ]}
      />
      <LegalDocument
        summaryTitle={t(`legal:${doc}.summaryTitle`)}
        summary={list(`legal:${doc}.summary`)}
        sections={list(`legal:${doc}.sections`)}
      />
    </PublicLayout>
  );
};

export const TermsScreen = () => <LegalScreen doc="terms" />;
export const PrivacyScreen = () => <LegalScreen doc="privacy" />;

export default LegalScreen;
