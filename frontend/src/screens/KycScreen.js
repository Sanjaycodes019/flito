import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import DocumentTile from '../components/kyc/DocumentTile';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { KYC_DOCUMENT_LABELS, KYC_ID_TYPE_OPTIONS, KYC_ID_TYPE_LABELS, MAX_DOCUMENT_BYTES } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/helpers';
import { notify, confirmAction } from '../utils/alert';
import api from '../services/api';
import { pickDocument, uploadFiles } from '../services/uploads';
import { setUser } from '../redux/slices/authSlice';
import useScreenLayout from '../hooks/useScreenLayout';

const STATUS_COPY = {
  not_submitted: {
    title: 'Verify your identity',
    body: 'Upload the documents below, then submit them for review.',
    color: colors.infoText,
    icon: 'unverified',
  },
  pending: {
    title: 'Under review',
    body: "Your documents are being checked. You can't change them until the review is finished.",
    color: colors.warningText,
    icon: 'pending',
  },
  approved: {
    title: 'Verified',
    body: 'Your identity has been verified.',
    color: colors.successText,
    icon: 'verified',
  },
  rejected: {
    title: 'Changes needed',
    body: 'Your documents were not approved. Fix the issue below and submit again.',
    color: colors.errorText,
    icon: 'unverified',
  },
};

const labelFor = (type) => KYC_DOCUMENT_LABELS[type] || type;

const KycScreen = () => {
  const dispatch = useDispatch();
  const [kyc, setKyc] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyType, setBusyType] = useState(null);
  const [busyIdType, setBusyIdType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const layout = useScreenLayout('narrow');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me/kyc');
      setKyc(data.kyc);
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
  }, []);

  // Document links expire after 10 minutes, so refresh them whenever the screen shows.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!kyc) return <Spinner />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleUpload = async (type) => {
    let asset;
    try {
      asset = await pickDocument();
    } catch (error) {
      notify('Could not open files', getErrorMessage(error));
      return;
    }
    if (!asset) return;
    if (asset.size && asset.size > MAX_DOCUMENT_BYTES) {
      notify('File too large', 'Documents must be 10 MB or smaller');
      return;
    }

    setBusyType(type);
    try {
      const data = await uploadFiles('/users/me/kyc/documents', [asset], { field: 'document', fields: { type } });
      setKyc(data.kyc);
    } catch (error) {
      notify('Upload failed', getErrorMessage(error));
    }
    setBusyType(null);
  };

  const handleRemove = (doc) => confirmAction({
    title: 'Remove document',
    message: `Remove your ${labelFor(doc.type).toLowerCase()}?`,
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: async () => {
      setBusyType(doc.type);
      try {
        const { data } = await api.delete(`/users/me/kyc/documents/${doc._id}`);
        setKyc(data.kyc);
      } catch (error) {
        notify('Error', getErrorMessage(error));
      }
      setBusyType(null);
    },
  });

  // Switching the identity document drops uploads the new choice doesn't use,
  // so the user confirms first whenever that would remove something.
  const handleIdTypeChange = (idType) => {
    if (idType === kyc.idType || busyIdType) return;

    const keeps = kyc.idTypeDocuments?.[idType] || [];
    const removed = kyc.documents.filter((doc) => !keeps.includes(doc.type));

    const change = async () => {
      setBusyIdType(idType);
      try {
        const { data } = await api.patch('/users/me/kyc/id-type', { idType });
        setKyc(data.kyc);
      } catch (error) {
        notify('Could not change document', getErrorMessage(error));
      }
      setBusyIdType(null);
    };

    if (!removed.length) {
      change();
      return;
    }
    confirmAction({
      title: 'Change identity document',
      message: `Switching to ${KYC_ID_TYPE_LABELS[idType] || idType} removes your uploaded ${removed.map((doc) => labelFor(doc.type).toLowerCase()).join(' and ')}.`,
      confirmLabel: 'Switch',
      destructive: true,
      onConfirm: change,
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    let submitted = false;
    try {
      const { data } = await api.post('/users/me/kyc/submit');
      setKyc(data.kyc);
      dispatch(setUser(data.user));
      submitted = true;
    } catch (error) {
      notify('Could not submit', getErrorMessage(error));
    }
    setSubmitting(false);
    if (submitted) notify('Submitted for review', "You'll be able to see the result here once your documents are checked.");
  };

  const copy = STATUS_COPY[kyc.status] || STATUS_COPY.not_submitted;
  const documentsByType = Object.fromEntries(kyc.documents.map((doc) => [doc.type, doc]));
  const types = [...kyc.requiredDocuments, ...kyc.optionalDocuments];
  const ready = kyc.missingDocuments.length === 0;
  // Only offer choices the server knows about.
  const idTypeOptions = KYC_ID_TYPE_OPTIONS.filter((option) => !kyc.idTypeDocuments || kyc.idTypeDocuments[option.value]);
  const idTypeLabel = KYC_ID_TYPE_LABELS[kyc.idType] || kyc.idType;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Card style={[styles.banner, { borderLeftColor: copy.color }]}>
        <View style={styles.bannerHeader}>
          <Icon name={copy.icon} size={iconSize.md} color={copy.color} style={styles.bannerIcon} />
          <Text style={[styles.bannerTitle, { color: copy.color }]}>{copy.title}</Text>
        </View>
        <Text style={styles.bannerBody}>{copy.body}</Text>
        {kyc.rejectionReason ? <Text style={styles.reason}>Reason: {kyc.rejectionReason}</Text> : null}
        {kyc.status === 'pending' && kyc.submittedAt ? (
          <Text style={styles.meta}>Submitted {formatDate(kyc.submittedAt)}</Text>
        ) : null}
      </Card>

      {kyc.idType ? (
        <Card>
          <Text style={styles.sectionTitle}>Identity document</Text>
          {kyc.canEdit ? (
            <>
              <Text style={styles.sectionHint}>Choose the document you want to verify with.</Text>
              <View style={styles.idTypeGrid} accessibilityRole="radiogroup">
                {idTypeOptions.map((option) => {
                  const selected = option.value === kyc.idType;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleIdTypeChange(option.value)}
                      disabled={Boolean(busyIdType)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected, disabled: Boolean(busyIdType) }}
                      aria-checked={selected}
                      accessibilityLabel={option.label}
                      style={[styles.idTypeOption, selected && styles.idTypeOptionSelected]}
                    >
                      <Icon name={option.icon} size={iconSize.md} color={selected ? colors.primaryText : colors.textMuted} />
                      <Text style={[styles.idTypeLabel, selected && styles.idTypeLabelSelected]}>{option.label}</Text>
                      {busyIdType === option.value ? (
                        <ActivityIndicator size="small" color={colors.primaryText} />
                      ) : selected ? (
                        <Icon name="success" size={iconSize.sm} color={colors.primaryText} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.sectionHint}>Verifying with: {idTypeLabel}</Text>
          )}
        </Card>
      ) : null}

      {types.map((type) => {
        const doc = documentsByType[type];
        const required = kyc.requiredDocuments.includes(type);
        return (
          <Card key={type}>
            <View style={styles.docHeader}>
              <View style={styles.docHeaderLeft}>
                <Icon name="idCard" size={iconSize.sm} color={colors.textMuted} style={styles.docIcon} />
                <Text style={styles.docLabel}>{labelFor(type)}</Text>
              </View>
              <View style={[styles.stateBadge, doc && styles.stateBadgeUploaded]}>
                <Text style={[styles.docState, doc ? styles.docUploaded : null]}>
                  {doc ? 'Uploaded' : required ? 'Required' : 'Optional'}
                </Text>
              </View>
            </View>

            {doc && <DocumentTile doc={doc} label={`View ${labelFor(type).toLowerCase()}`} />}

            {kyc.canEdit && (
              <View style={styles.actionsRow}>
                <Button
                  title={doc ? 'Replace' : 'Upload'}
                  icon={doc ? 'refresh' : 'upload'}
                  variant={doc ? 'tertiary' : 'primary'}
                  onPress={() => handleUpload(type)}
                  loading={busyType === type}
                  style={styles.actionButton}
                />
                {doc && (
                  <Button title="Remove" icon="trash" variant="tertiary" onPress={() => handleRemove(doc)} style={styles.actionButton} />
                )}
              </View>
            )}
          </Card>
        );
      })}

      {kyc.canEdit && (
        <>
          <Button
            title={kyc.status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
            icon="checkmark"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!ready}
          />
          {!ready && <Text style={styles.hint}>Upload every required document to submit.</Text>}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: { borderLeftWidth: 4 },
  bannerHeader: { flexDirection: 'row', alignItems: 'center' },
  bannerIcon: { marginRight: spacing.sm },
  bannerTitle: { ...type.h3 },
  bannerBody: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
  reason: { ...type.smallMedium, color: colors.errorText, marginTop: spacing.sm },
  meta: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { ...type.bodyMedium, color: colors.textPrimary },
  sectionHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  idTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  // Two per row on most phones; each option wraps to its own row when the
  // screen is too narrow for two labels side by side.
  idTypeOption: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  idTypeOptionSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  idTypeLabel: { ...type.smallMedium, color: colors.textPrimary, flex: 1 },
  idTypeLabelSelected: { color: colors.primaryText },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  docHeaderLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  docIcon: { marginRight: spacing.xs },
  docLabel: { ...type.bodyMedium, color: colors.textPrimary },
  stateBadge: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  stateBadgeUploaded: { backgroundColor: colors.successMuted },
  docState: { ...type.caption, color: colors.textMuted },
  docUploaded: { color: colors.successText },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { flex: 1 },
  hint: { textAlign: 'center', ...type.small, color: colors.textMuted, marginBottom: spacing.lg },
});

export default KycScreen;
