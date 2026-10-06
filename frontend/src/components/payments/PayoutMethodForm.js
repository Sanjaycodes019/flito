import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import BankLogo from './BankLogo';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { BANKS, OTHER_BANK, PAYOUT_KINDS, WALLETS, methodTitle } from '../../utils/banks';
import { pickImages, takePhoto } from '../../services/uploads';
import { savePayoutMethod } from '../../services/payments';
import { getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';

const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// The three kinds as big tiles, each with its badge.
const KindTile = ({ kind, selected, onPress, label }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={label}
    style={({ pressed }) => [styles.kindTile, selected && styles.kindTileSelected, pressed && styles.pressed]}
  >
    {kind === 'bank'
      ? <View style={styles.bankGlyph}><Icon name="bank" size={26} color={selected ? colors.primaryText : colors.textSecondary} /></View>
      : <View style={styles.bankGlyph}><BankLogo kind={kind} size={30} /></View>}
    <Text style={[styles.kindLabel, selected && styles.kindLabelSelected]}>{label}</Text>
  </Pressable>
);

const BankRow = ({ code, name, description, selected, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={name}
    style={({ pressed }) => [styles.bankRow, selected && styles.bankRowSelected, pressed && styles.pressed]}
  >
    <View style={styles.bankRowLogo}><BankLogo kind="bank" bankCode={code} size={30} /></View>
    <View style={styles.bankRowText}>
      <Text style={styles.bankRowName}>{name}</Text>
      {description ? <Text style={styles.bankRowDescription}>{description}</Text> : null}
    </View>
    {selected ? <Icon name="checkmark" size={iconSize.md} color={colors.primaryText} /> : null}
  </Pressable>
);

// Picking a bank: a field showing the chosen bank's badge, opening a
// searchable list of every bank with its badge.
const BankPicker = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = BANKS.find((bank) => bank.code === value);

  const visible = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return BANKS;
    return BANKS.filter((bank) => normalize(`${bank.name} ${bank.short}`).includes(needle));
  }, [query]);

  const choose = (code) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.label}>{t('payments:form.bank')}<Text style={styles.required}> *</Text></Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('payments:form.bank')}, ${chosen?.name || (value === OTHER_BANK ? t('payments:form.otherBank') : t('payments:form.chooseBank'))}`}
        style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}
      >
        {value ? <BankLogo kind="bank" bankCode={value} size={30} /> : <Icon name="bank" size={iconSize.md} color={colors.textMuted} />}
        <Text style={[styles.pickerValue, !value && styles.placeholder]} numberOfLines={1}>
          {chosen?.name || (value === OTHER_BANK ? t('payments:form.otherBank') : t('payments:form.chooseBank'))}
        </Text>
        <Icon name="chevronDown" size={iconSize.md} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} title={t('payments:form.chooseBank')} onClose={() => setOpen(false)} focusCloseOnOpen={false}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('common:selectField.searchPlaceholder', { label: t('payments:form.bank').toLowerCase() })}
          icon="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <View style={styles.bankList}>
          {visible.map((bank) => (
            <BankRow key={bank.code} code={bank.code} name={bank.name} selected={bank.code === value} onPress={() => choose(bank.code)} />
          ))}
          <BankRow
            code={OTHER_BANK}
            name={t('payments:form.otherBank')}
            description={t('payments:form.otherBankHint')}
            selected={value === OTHER_BANK}
            onPress={() => choose(OTHER_BANK)}
          />
        </View>
      </Modal>
    </View>
  );
};

const emptyDraft = (kind) => ({
  kind, bankCode: '', bankName: '', branch: '', accountNumber: '', accountName: '', walletId: '',
});

// Adding or editing one bank account or wallet. `method` is the one being
// edited, or null to add; `initialKind` preselects the type when adding.
// `onSave(id, fields, qr)` stores it (an owner's own accounts by default) and
// resolves to the fresh list, which goes to `onSaved`.
const PayoutMethodForm = ({ visible, method, initialKind = 'bank', onSave = savePayoutMethod, onClose, onSaved }) => {
  const { t } = useTranslation();
  const editing = Boolean(method);
  const [draft, setDraft] = useState(emptyDraft(initialKind));
  const [qr, setQr] = useState(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(method ? { ...emptyDraft(method.kind), ...Object.fromEntries(Object.entries(method).filter(([, v]) => v != null)) } : emptyDraft(initialKind));
    setQr(null);
    setRemoveQr(false);
  }, [visible, method, initialKind]);

  const set = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));
  const isBank = draft.kind === 'bank';
  const wallet = WALLETS[draft.kind]?.name;
  const qrPreview = qr?.uri || (!removeQr && method?.qrUrl) || null;

  const chooseQr = async (source) => {
    try {
      const [asset] = source === 'camera' ? await takePhoto() : await pickImages({ max: 1 });
      if (asset) {
        setQr(asset);
        setRemoveQr(false);
      }
    } catch (error) {
      notify(t('payments:form.photoFailed'), getErrorMessage(error));
    }
  };

  const missing = () => {
    if (isBank && !draft.bankCode) return t('payments:form.needBank');
    if (isBank && draft.bankCode === OTHER_BANK && !draft.bankName.trim()) return t('payments:form.needBankName');
    if (!draft.accountName.trim()) return t('payments:form.needName');
    if (isBank && !draft.accountNumber.trim() && !qrPreview) return t('payments:form.needAccountOrQr');
    if (!isBank && !draft.walletId.trim()) return t('payments:form.needWallet');
    return null;
  };

  const save = async () => {
    const problem = missing();
    if (problem) {
      notify(t('payments:form.missingTitle'), problem);
      return;
    }
    const fields = isBank
      ? {
        bankCode: draft.bankCode,
        bankName: draft.bankCode === OTHER_BANK ? draft.bankName : undefined,
        branch: draft.branch,
        accountNumber: draft.accountNumber,
        accountName: draft.accountName,
      }
      : { walletId: draft.walletId, accountName: draft.accountName };
    if (!editing) fields.kind = draft.kind;
    if (removeQr) fields.removeQr = 'true';

    setSaving(true);
    try {
      const list = await onSave(method?._id, fields, qr);
      onSaved(list);
    } catch (error) {
      notify(t('payments:methods.actionFailed'), getErrorMessage(error));
    }
    setSaving(false);
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnBackdrop={false}
      title={editing ? t('payments:form.editTitle', { name: methodTitle(method) }) : t('payments:form.addTitle')}
      footer={<Button title={t('payments:form.save')} icon="checkmark" onPress={save} loading={saving} style={styles.saveButton} />}
    >
      {!editing ? (
        <>
          <Text style={styles.label}>{t('payments:form.kind')}</Text>
          <View style={styles.kindRow} accessibilityRole="radiogroup">
            {PAYOUT_KINDS.map((kind) => (
              <KindTile
                key={kind}
                kind={kind}
                label={t(`payments:kinds.${kind}`)}
                selected={draft.kind === kind}
                onPress={() => setDraft((current) => ({ ...current, kind }))}
              />
            ))}
          </View>
        </>
      ) : null}

      {isBank ? (
        <>
          <BankPicker value={draft.bankCode} onChange={set('bankCode')} />
          {draft.bankCode === OTHER_BANK ? (
            <Input label={t('payments:form.bankName')} value={draft.bankName} onChangeText={set('bankName')} required />
          ) : null}
          <Input
            label={t('payments:form.accountName')}
            helperText={t('payments:form.accountNameHint')}
            value={draft.accountName}
            onChangeText={set('accountName')}
            icon="person"
            autoCapitalize="words"
            required
          />
          <Input
            label={t('payments:form.accountNumber')}
            helperText={t('payments:form.accountNumberHint')}
            value={draft.accountNumber}
            onChangeText={set('accountNumber')}
            icon="bank"
            keyboardType="number-pad"
            autoCorrect={false}
          />
          <Input label={t('payments:form.branch')} value={draft.branch} onChangeText={set('branch')} icon="location" />
        </>
      ) : (
        <>
          <Input
            label={t('payments:form.walletId', { wallet })}
            value={draft.walletId}
            onChangeText={set('walletId')}
            placeholder={t('payments:form.walletIdPlaceholder')}
            icon="phone"
            keyboardType="phone-pad"
            required
          />
          <Input
            label={t('payments:form.accountName')}
            helperText={t('payments:form.walletNameHint', { wallet })}
            value={draft.accountName}
            onChangeText={set('accountName')}
            icon="person"
            autoCapitalize="words"
            required
          />
        </>
      )}

      <View style={styles.qrBlock}>
        <Text style={styles.label}>
          {t('payments:form.qr')} <Text style={styles.optional}>{t('payments:form.qrOptional')}</Text>
        </Text>
        <Text style={styles.hint}>{isBank ? t('payments:form.qrBankHint') : t('payments:form.qrWalletHint', { wallet })}</Text>
        <View style={styles.qrRow}>
          <View style={styles.qrPreview}>
            {qrPreview
              ? <Image source={{ uri: qrPreview }} style={styles.qrImage} resizeMode="contain" accessibilityIgnoresInvertColors />
              : <Icon name="qr" size={44} color="rgba(30, 36, 43, 0.28)" />}
          </View>
          <View style={styles.qrButtons}>
            <Button title={t('payments:form.uploadQr')} icon="image" size="sm" variant="tertiary" onPress={() => chooseQr('library')} />
            <Button title={t('payments:form.takeQrPhoto')} icon="camera" size="sm" variant="ghost" onPress={() => chooseQr('camera')} />
            {qrPreview ? (
              <Button
                title={t('payments:form.removeQr')}
                icon="trash"
                size="sm"
                variant="ghost"
                onPress={() => { setQr(null); setRemoveQr(Boolean(method?.qrUrl)); }}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = themedStyles(() => ({
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  required: { color: colors.errorText },
  optional: { ...type.small, color: colors.textMuted },
  hint: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  pressed: { opacity: 0.8 },

  kindRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  kindTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kindTileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  bankGlyph: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  kindLabel: { ...type.smallMedium, color: colors.textPrimary, textAlign: 'center' },
  kindLabelSelected: { color: colors.primaryText },

  pickerBlock: { marginBottom: spacing.lg },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pickerValue: { ...type.body, color: colors.textPrimary, flex: 1 },
  placeholder: { color: colors.textMuted },
  bankList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  bankRowSelected: { backgroundColor: colors.primaryMuted },
  bankRowLogo: { width: 90, alignItems: 'flex-start' },
  bankRowText: { flex: 1 },
  bankRowName: { ...type.body, color: colors.textPrimary },
  bankRowDescription: { ...type.small, color: colors.textMuted },

  qrBlock: { marginTop: spacing.xs },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  qrPreview: {
    width: 112,
    height: 112,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrImage: { width: 100, height: 100 },
  qrButtons: { flex: 1, alignItems: 'flex-start', gap: spacing.xs },
  saveButton: { flex: 1 },
}));

export default PayoutMethodForm;
