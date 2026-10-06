import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import PayoutMethodCard from './PayoutMethodCard';
import PayoutMethodForm from './PayoutMethodForm';
import BankLogo from './BankLogo';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import useScreenLayout from '../../hooks/useScreenLayout';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, shadow, themedStyles } from '../../theme/tokens';
import { PAYOUT_KINDS } from '../../utils/banks';
import { getErrorMessage } from '../../utils/helpers';
import { confirmAction, notify } from '../../utils/alert';

// Matches the server's limit (controllers/payoutMethodsController).
const MAX_METHODS = 5;

// One big "add" tile per kind, for the empty list and the end of the list.
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

// A list of bank accounts and wallets that can be edited: the cards, add
// tiles for each kind, and the add/edit form. `api` is where they live:
// { list(), save(id, fields, qr), makePrimary(id), remove(id) }, each
// resolving to the fresh list. `copy` replaces the default wording:
// { title, hint, emptyTitle, emptyText, savedMessage, removeMessage }, and
// `heading={false}` leaves out the list's title for a page that has its own.
const PayoutMethodsManager = ({ api, copy = {}, heading = true }) => {
  const { t } = useTranslation();
  const layout = useScreenLayout('medium', 'wide');
  const [methods, setMethods] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null); // { method } or { kind }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMethods(await api.list());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, [api]);

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
    message: copy.removeMessage || t('payments:methods.removeMessage'),
    confirmLabel: t('payments:methods.removeConfirm'),
    destructive: true,
    onConfirm: () => run(method._id, () => api.remove(method._id)),
  });

  const onSaved = (list) => {
    setMethods(list);
    setForm(null);
    notify(t('payments:form.savedTitle'), copy.savedMessage || t('payments:form.savedMessage'));
  };

  const canAdd = (methods?.length || 0) < MAX_METHODS;
  const addTiles = (
    <View style={styles.addRow}>
      {PAYOUT_KINDS.map((kind) => (
        <AddTile key={kind} kind={kind} label={t(`payments:kinds.${kind}`)} onPress={() => setForm({ kind })} />
      ))}
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
        <Text style={styles.sectionTitle}>{copy.emptyTitle || t('payments:methods.emptyTitle')}</Text>
        <Text style={styles.sectionHint}>{copy.emptyText || t('payments:methods.emptyText')}</Text>
        {addTiles}
      </View>
    );
  } else {
    content = (
      <>
        {heading ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{copy.title || t('payments:methods.yourAccounts')}</Text>
            <Text style={styles.sectionHint}>{copy.hint || t('payments:methods.yourAccountsHint')}</Text>
          </View>
        ) : null}
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
                        onPress={() => run(method._id, () => api.makePrimary(method._id))}
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
    <>
      {content}
      <PayoutMethodForm
        visible={Boolean(form)}
        method={form?.method || null}
        initialKind={form?.kind}
        onSave={api.save}
        onClose={() => setForm(null)}
        onSaved={onSaved}
      />
    </>
  );
};

const styles = themedStyles(() => ({
  pressed: { opacity: 0.8 },
  sectionHeader: { marginBottom: spacing.md },
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
}));

export default PayoutMethodsManager;
