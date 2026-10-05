import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import BankLogo from './BankLogo';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { StatusPill } from '../common/SettingsList';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, shadow, themedStyles } from '../../theme/tokens';
import { WALLETS, bankByCode, groupDigits, methodTitle } from '../../utils/banks';

// A QR code is only scannable dark-on-white, so it always sits on a white
// panel, in dark mode too.
const QrImage = ({ uri, size }) => (
  <View style={[styles.qrFrame, { width: size + spacing.md * 2 }]}>
    <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
  </View>
);

const Field = ({ label, value, mono = false }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {/* Selectable, so a number can be copied into a bank app. */}
    <Text style={[styles.fieldValue, mono && styles.fieldMono]} selectable>{value}</Text>
  </View>
);

// One bank account or wallet, laid out like the account card in a bank app:
// the bank's colour along the top, its badge and name, the details a payer
// types in, and the QR to scan. `actions` are the owner's buttons (edit,
// make primary, remove); a shipper's view has none.
const PayoutMethodCard = ({ method, actions = null, compact = false }) => {
  const { t } = useTranslation();
  const [qrOpen, setQrOpen] = useState(false);
  const title = methodTitle(method);
  const brandColor = method.kind === 'bank' ? bankByCode(method.bankCode)?.color : WALLETS[method.kind]?.color;
  const wallet = WALLETS[method.kind]?.name;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.band, { backgroundColor: brandColor || colors.borderStrong }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <BankLogo kind={method.kind} bankCode={method.bankCode} size={compact ? 36 : 44} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {method.kind === 'bank'
                ? method.branch || t('payments:kinds.bank')
                : t('payments:card.walletId', { wallet })}
            </Text>
          </View>
          {method.primary && !compact ? <StatusPill label={t('payments:methods.primary')} tone="success" icon="star" /> : null}
        </View>

        <View style={styles.details}>
          <View style={styles.fields}>
            <Field label={t('payments:card.accountName')} value={method.accountName} />
            {method.kind === 'bank' ? (
              method.accountNumber
                ? <Field label={t('payments:card.accountNumber')} value={groupDigits(method.accountNumber)} mono />
                : <Text style={styles.qrOnly}>{t('payments:card.qrOnly')}</Text>
            ) : (
              <Field label={t('payments:card.walletId', { wallet })} value={method.walletId} mono />
            )}
          </View>

          {method.qrUrl ? (
            <Pressable
              onPress={() => setQrOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('payments:card.qrTitle', { name: title })}
              style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
            >
              <QrImage uri={method.qrUrl} size={compact ? 76 : 92} />
              <View style={styles.qrCaption}>
                <Icon name="qrScan" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.qrCaptionText}>{t('payments:card.tapToEnlarge')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>

      <Modal visible={qrOpen} title={t('payments:card.qrTitle', { name: title })} onClose={() => setQrOpen(false)}>
        <View style={styles.qrLarge}>
          {method.qrUrl ? <QrImage uri={method.qrUrl} size={260} /> : null}
          <Text style={styles.qrLargeName}>{method.accountName}</Text>
          <Text style={styles.qrHint}>{t('payments:card.qrHint', { name: method.accountName })}</Text>
          <Button title={t('common:actions.close')} variant="tertiary" onPress={() => setQrOpen(false)} />
        </View>
      </Modal>
    </View>
  );
};

const styles = themedStyles(() => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.level1,
  },
  cardCompact: { shadowOpacity: 0, elevation: 0 },
  band: { height: 5 },
  body: { padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...type.bodyMedium, color: colors.textPrimary },
  subtitle: { ...type.small, color: colors.textMuted },
  details: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginTop: spacing.md },
  fields: { flex: 1, minWidth: 0, gap: spacing.sm },
  field: {},
  fieldLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue: { ...type.bodyMedium, color: colors.textPrimary },
  fieldMono: { fontVariant: ['tabular-nums'], letterSpacing: 0.6 },
  qrOnly: { ...type.small, color: colors.textSecondary },
  qrButton: { alignItems: 'center', borderRadius: radius.md },
  pressed: { opacity: 0.8 },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 36, 43, 0.14)',
    alignItems: 'center',
  },
  qrCaption: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
  qrCaptionText: { ...type.caption, fontWeight: '400', color: colors.textMuted },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  qrLarge: { alignItems: 'center', gap: spacing.md },
  qrLargeName: { ...type.h3, color: colors.textPrimary, textAlign: 'center' },
  qrHint: { ...type.small, color: colors.textSecondary, textAlign: 'center' },
}));

export default PayoutMethodCard;
