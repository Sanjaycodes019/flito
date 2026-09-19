import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import useBreakpoint from '../../hooks/useBreakpoint';

export const PAGE_SIZES = [12, 24, 48];

// Page numbers to show: the first, the last, and a window around the current
// page, with '…' where pages are skipped. e.g. 1 … 4 5 6 … 20
const pageWindow = (page, totalPages, room) => {
  if (totalPages <= room + 2) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(page - Math.floor(room / 2), totalPages - room));
  const middle = Array.from({ length: room }, (_, i) => start + i).filter((n) => n < totalPages);
  return [1, ...(start > 2 ? ['gap-start'] : []), ...middle, ...(middle[middle.length - 1] < totalPages - 1 ? ['gap-end'] : []), totalPages];
};

const Step = ({ icon, label, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.cell, disabled && styles.cellDisabled]}
  >
    <Icon name={icon} size={iconSize.sm} color={colors.textSecondary} />
  </Pressable>
);

// Numbered pagination with previous/next, "Showing 1–12 of 48" and a page-size
// choice. Numbers collapse to prev/next plus "Page 2 of 5" on a phone.
const Pagination = ({ page, totalPages, total, pageSize, loading, onChange, onPageSize }) => {
  const { t } = useTranslation();
  const { isPhone } = useBreakpoint();
  if (!total) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (n) => !loading && n >= 1 && n <= totalPages && n !== page && onChange(n);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.summary, isPhone && styles.summaryPhone]}>{t('admin:pagination.showing', { from, to, total })}</Text>

      <View style={[styles.controls, isPhone && styles.controlsPhone]}>
        {totalPages > 1 ? (
          <View style={[styles.pages, isPhone && styles.pagesPhone]}>
            <Step icon="back" label={t('admin:pagination.previous')} disabled={page <= 1 || loading} onPress={() => go(page - 1)} />
            {isPhone ? (
              <Text style={styles.pageOf}>{t('admin:pagination.pageOf', { page, totalPages })}</Text>
            ) : (
              pageWindow(page, totalPages, 3).map((entry) => (typeof entry === 'string' ? (
                <Text key={entry} style={styles.gap}>…</Text>
              ) : (
                <Pressable
                  key={entry}
                  onPress={() => go(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin:pagination.goTo', { page: entry })}
                  accessibilityState={{ selected: entry === page }}
                  style={[styles.cell, entry === page && styles.cellActive]}
                >
                  <Text style={[styles.cellText, entry === page && styles.cellTextActive]}>{entry}</Text>
                </Pressable>
              )))
            )}
            <Step icon="forward" label={t('admin:pagination.next')} disabled={page >= totalPages || loading} onPress={() => go(page + 1)} />
          </View>
        ) : null}

        {!isPhone ? (
        <View style={styles.sizes}>
          <Text style={styles.perPage}>{t('admin:pagination.perPage')}</Text>
          {PAGE_SIZES.map((size) => (
            <Pressable
              key={size}
              onPress={() => size !== pageSize && onPageSize(size)}
              accessibilityRole="button"
              accessibilityState={{ selected: size === pageSize }}
              style={[styles.size, size === pageSize && styles.cellActive]}
            >
              <Text style={[styles.cellText, size === pageSize && styles.cellTextActive]}>{size}</Text>
            </Pressable>
          ))}
        </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summary: { ...type.small, color: colors.textMuted },
  summaryPhone: { width: '100%', textAlign: 'center' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  controlsPhone: { width: '100%' },
  pages: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pagesPhone: { flex: 1, justifyContent: 'space-between' },
  cell: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDisabled: { opacity: 0.4 },
  cellActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryText },
  cellText: { ...type.smallMedium, color: colors.textSecondary },
  cellTextActive: { color: colors.primaryText },
  gap: { ...type.small, color: colors.textMuted, paddingHorizontal: spacing.xs },
  pageOf: { ...type.small, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  sizes: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  perPage: { ...type.small, color: colors.textMuted, marginRight: spacing.xs },
  size: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Pagination;
