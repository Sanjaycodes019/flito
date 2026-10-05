import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import PayoutMethodCard from '../../components/payments/PayoutMethodCard';
import PayoutMethodForm from '../../components/payments/PayoutMethodForm';
import BankLogo from '../../components/payments/BankLogo';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import useScreenLayout from '../../hooks/useScreenLayout';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, shadow, themedStyles } from '../../theme/tokens';
import { PAYOUT_KINDS } from '../../utils/banks';
import { getErrorMessage } from '../../utils/helpers';
import { confirmAction, notify } from '../../utils/alert';
import {
  listPayoutMethods, makePrimaryPayoutMethod, deletePayoutMethod,
} from '../../services/payments';

// Matches the server's limit (controllers/payoutMethodsController).
const MAX_METHODS = 5;

const TRUST_POINTS = [
  { key: 'direct', icon: 'wallet' },
  { key: 'private', icon: 'shieldLock' },
  { key: 'confirm', icon: 'paymentCheck' },
];

// One big "add" tile per kind, for the empty page and the end of the list.
const AddTile = ({ kind, label, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
  >
    {kind === 'bank'
      ? <View style={styles.addBankGlyph}><Icon name="bank" size={24} color={colors.primaryText} /></View>
      : <BankLogo kind={kind} size={32} />}
    <Text style={styles.addTileLabel} numberOfLines={2}>{label}</Text>
    <Icon name="add" size={iconSize.sm} color={colors.primaryText} />
  </Pressable>
);

// Where a truck owner says how shippers pay them: bank accounts with their
// QR, eSewa and Khalti. Shippers see these on their bookings with the owner.
const PaymentMethodsScreen = () => {
  const { t } = useTranslation();
  const layout = useScreenLayout('medium', 'wide');
  const [methods, setMethods] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null); // { method } or { kind }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMethods(await listPayoutMethods());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (id, action) => {
    setBusyId(id);
    try {
      setMethods(await action());
    } catch (error) {
      notify(t('payments:methods.actionFailed'), getErrorMessage(error));
    }
    setBusyId(null);
  };

  const remove = (method) => confirmAction({
    title: t('payments:methods.removeTitle'),
    message: t('payments:methods.removeMessage'),
    confirmLabel: t('payments:methods.removeConfirm'),
    destructive: true,
    onConfirm: () => run(method._id, () => deletePayoutMethod(method._id)),
  });

  const onSaved = (list) => {
    setMethods(list);
    setForm(null);
    notify(t('payments:form.savedTitle'), t('payments:form.savedMessage'));
  };

  const canAdd = (methods?.length || 0) < MAX_METHODS;
  const addTiles = (
    <View style={styles.addRow}>
      {PAYOUT_KINDS.map((kind) => (
        <AddTile key={kind} kind={kind} label={t(`payments:kinds.${kind}`)} onPress={() => setForm({ kind })} />
      ))}
    </View>
  );

  const hero = (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}><Icon name="shieldLock" size={26} color={colors.textOnPrimary} /></View>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>{t('payments:methods.heroEyebrow')}</Text>
          <Text style={styles.heroTitle} accessibilityRole="header">{t('payments:methods.heroTitle')}</Text>
        </View>
      </View>
      <Text style={styles.heroBody}>{t('payments:methods.heroText')}</Text>
      <View style={styles.trustRow}>
        {TRUST_POINTS.map((point) => (
          <View key={point.key} style={styles.trustItem}>
            <Icon name={point.icon} size={iconSize.sm} color={colors.primary} />
            <Text style={styles.trustText}>{t(`payments:methods.trust.${point.key}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  let content;
  if (loadError) {
    content = (
      <View style={styles.message}>
        <Text style={styles.messageText}>{loadError}</Text>
        <Button title={t('payments:methods.retry')} icon="refresh" variant="tertiary" onPress={load} />
      </View>
    );
  } else if (!methods) {
    content = <Spinner />;
  } else if (!methods.length) {
    content = (
      <View style={styles.emptyCard}>
        <Text style={styles.sectionTitle}>{t('payments:methods.emptyTitle')}</Text>
        <Text style={styles.sectionHint}>{t('payments:methods.emptyText')}</Text>
        {addTiles}
      </View>
    );
  } else {
    content = (
      <>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{t('payments:methods.yourAccounts')}</Text>
            <Text style={styles.sectionHint}>{t('payments:methods.yourAccountsHint')}</Text>
          </View>
        </View>
        <View style={layout.isDesktop ? styles.grid : null}>
          {methods.map((method) => (
            <View key={method._id} style={layout.isDesktop ? styles.gridCell : null}>
              <PayoutMethodCard
                method={method}
                actions={(
                  <>
                    <Button title={t('payments:methods.edit')} icon="edit" size="sm" variant="tertiary" onPress={() => setForm({ method })} />
                    {!method.primary ? (
                      <Button
                        title={t('payments:methods.makePrimary')}
                        icon="starOutline"
                        size="sm"
                        variant="ghost"
                        loading={busyId === method._id}
                        onPress={() => run(method._id, () => makePrimaryPayoutMethod(method._id))}
                      />
                    ) : null}
                    <Button title={t('payments:methods.remove')} icon="trash" size="sm" variant="ghost" onPress={() => remove(method)} />
                  </>
                )}
              />
            </View>
          ))}
        </View>
        {canAdd ? (
          <>
            <Text style={styles.addHeading}>{t('payments:methods.addTitle')}</Text>
            {addTiles}
          </>
        ) : <Text style={styles.sectionHint}>{t('payments:methods.limitReached')}</Text>}
      </>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      {hero}
      <View style={styles.content}>{content}</View>
      <View style={styles.safety}>
        <Icon name="warning" size={iconSize.sm} color={colors.warningText} />
        <Text style={styles.safetyText}>{t('payments:methods.safetyNote')}</Text>
      </View>

      <PayoutMethodForm
        visible={Boolean(form)}
        method={form?.method || null}
        initialKind={form?.kind}
        onClose={() => setForm(null)}
        onSaved={onSaved}
      />
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  pressed: { opacity: 0.8 },

  hero: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, ...shadow.level2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroEyebrow: { ...type.caption, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { ...type.h2, color: colors.textInverse },
  heroBody: { ...type.body, color: colors.textInverseMuted, marginTop: spacing.md },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    maxWidth: '100%',
  },
  trustText: { ...type.small, color: colors.textInverse, flexShrink: 1 },

  content: { marginTop: spacing.xl },
  sectionHeader: { marginBottom: spacing.md },
  sectionHeading: {},
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  sectionHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm },
  gridCell: { width: '50%', paddingHorizontal: spacing.sm },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, ...shadow.level1 },
  addHeading: { ...type.smallMedium, color: colors.textSecondary, marginTop: spacing.sm },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  addTile: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryText,
    backgroundColor: colors.surface,
  },
  addBankGlyph: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center',
  },
  addTileLabel: { ...type.bodyMedium, color: colors.textPrimary, flex: 1, minWidth: 0 },
  message: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  messageText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },

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
