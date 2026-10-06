import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import PaymentHero from '../../components/payments/PaymentHero';
import PayoutMethodsManager from '../../components/payments/PayoutMethodsManager';
import useScreenLayout from '../../hooks/useScreenLayout';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import {
  listPayoutMethods, savePayoutMethod, makePrimaryPayoutMethod, deletePayoutMethod,
} from '../../services/payments';

// The owner's own accounts, where shippers pay them.
const OWN_ACCOUNTS = {
  list: listPayoutMethods,
  save: savePayoutMethod,
  makePrimary: makePrimaryPayoutMethod,
  remove: deletePayoutMethod,
};

// Where a truck owner says how shippers pay them: bank accounts with their
// QR, eSewa and Khalti. Shippers see these on their bookings with the owner.
const PaymentMethodsScreen = () => {
  const { t } = useTranslation();
  const layout = useScreenLayout('medium', 'wide');

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      <PaymentHero
        eyebrow={t('payments:methods.heroEyebrow')}
        title={t('payments:methods.heroTitle')}
        body={t('payments:methods.heroText')}
        points={[
          { icon: 'wallet', label: t('payments:methods.trust.direct') },
          { icon: 'shieldLock', label: t('payments:methods.trust.private') },
          { icon: 'paymentCheck', label: t('payments:methods.trust.confirm') },
        ]}
      />
      <View style={styles.content}>
        <PayoutMethodsManager api={OWN_ACCOUNTS} />
      </View>
      <View style={styles.safety}>
        <Icon name="warning" size={iconSize.sm} color={colors.warningText} />
        <Text style={styles.safetyText}>{t('payments:methods.safetyNote')}</Text>
      </View>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { marginTop: spacing.xl },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningMuted,
  },
  safetyText: { ...type.small, color: colors.textPrimary, flex: 1 },
}));

export default PaymentMethodsScreen;
