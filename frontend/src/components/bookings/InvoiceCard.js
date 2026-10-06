import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import { downloadInvoice } from '../../services/invoices';

// A completed trip's invoice, for the shipper and the truck owner: its number
// and a button that downloads it as a one-page PDF.
const InvoiceCard = ({ booking }) => {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const invoice = booking.invoice;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoice(booking._id);
    } catch (error) {
      notify(t('bookings:invoice.failedTitle'), getErrorMessage(error));
    }
    setDownloading(false);
  };

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name="invoice" size={iconSize.md} color={colors.primaryText} style={styles.titleIcon} />
        <Text style={styles.title}>{t('bookings:invoice.title')}</Text>
      </View>

      <View style={styles.document}>
        <View style={styles.fileBadge}>
          <Icon name="invoice" size={iconSize.lg} color={colors.primaryText} />
        </View>
        <View style={styles.documentText}>
          <Text style={styles.number} numberOfLines={1}>
            {invoice?.number || t('bookings:invoice.pending')}
          </Text>
          {invoice?.issuedAt ? (
            <Text style={styles.meta}>{t('bookings:invoice.issued', { date: formatDate(invoice.issuedAt) })}</Text>
          ) : null}
          <Text style={styles.meta}>{t('bookings:invoice.format')}</Text>
        </View>
      </View>

      <Text style={styles.hint}>{t('bookings:invoice.hint')}</Text>
      <Button
        title={t('bookings:invoice.download')}
        icon="download"
        onPress={handleDownload}
        loading={downloading}
        accessibilityLabel={t('bookings:invoice.downloadAccessibilityLabel')}
      />
    </Card>
  );
};

const styles = themedStyles(() => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  titleIcon: { marginRight: spacing.xs },
  title: { ...type.h3, color: colors.textPrimary },
  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  fileBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  documentText: { flex: 1, minWidth: 0 },
  number: { ...type.bodyMedium, color: colors.textPrimary },
  meta: { ...type.small, color: colors.textMuted },
  hint: { ...type.small, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
}));

export default InvoiceCard;
