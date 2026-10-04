import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, themedStyles } from '../../theme/tokens';
import useOpenPage from '../useOpenPage';
import useSiteStyle from '../siteStyle';
import { Section, useTone } from './Blocks';
import SiteButton from './SiteButton';

const CtaCopy = ({ title, lead, centred }) => {
  const tone = useTone();
  const site = useSiteStyle();
  return (
    <View style={[styles.copy, centred && styles.copyCentred]}>
      <Text style={[site.title, { color: tone.title }, centred && styles.centreText]} accessibilityRole="header" aria-level={2}>{title}</Text>
      {lead ? <Text style={[site.lead, styles.lead, { color: tone.body }, centred && styles.centreText]}>{lead}</Text> : null}
    </View>
  );
};

// The amber band that closes a page with its next step. Signed out that is
// joining or logging in; signed in (the app already open) it is getting help.
const CtaBand = ({ title, lead }) => {
  const { t } = useTranslation();
  const site = useSiteStyle();
  const { openAuth, openPage, signedIn } = useOpenPage();
  const side = site.isDesktop;

  const actions = signedIn ? (
    <>
      <SiteButton variant="dark" title={t('site:cta.helpCenter')} icon="help" onPress={() => openPage('help')} />
      <SiteButton variant="outlineDark" title={t('site:cta.contact')} icon="chat" onPress={() => openPage('contact')} />
    </>
  ) : (
    <>
      <SiteButton variant="dark" title={t('site:cta.signUp')} iconRight="arrowRight" onPress={() => openAuth('Signup')} />
      <SiteButton variant="outlineDark" title={t('site:cta.logIn')} icon="login" onPress={() => openAuth('Login')} />
    </>
  );

  return (
    <Section tone="brand" space={site.isPhone ? 56 : 80}>
      <View style={[styles.row, side && styles.rowSide]}>
        <CtaCopy title={title || t('site:cta.title')} lead={lead || t('site:cta.lead')} centred={!side} />
        <View style={[styles.actions, side ? styles.actionsSide : site.isPhone ? styles.actionsStacked : styles.actionsCentred]}>{actions}</View>
      </View>
    </Section>
  );
};

const styles = themedStyles(() => ({
  row: { gap: spacing.xxl },
  rowSide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copy: { maxWidth: 640 },
  copyCentred: { alignSelf: 'center', alignItems: 'center' },
  centreText: { textAlign: 'center' },
  lead: { marginTop: spacing.sm },
  actions: { gap: spacing.md },
  actionsSide: { flexDirection: 'row' },
  actionsCentred: { flexDirection: 'row', justifyContent: 'center' },
  actionsStacked: { alignSelf: 'stretch' },
}));

export default CtaBand;
