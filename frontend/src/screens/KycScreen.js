import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import DocumentTile from '../components/kyc/DocumentTile';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { KYC_DOCUMENT_LABELS, MAX_DOCUMENT_BYTES } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/helpers';
import { notify, confirmAction } from '../utils/alert';
import api from '../services/api';
import { pickDocument, uploadFiles } from '../services/uploads';
import { setUser } from '../redux/slices/authSlice';

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
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
  content: { padding: spacing.lg },
  banner: { borderLeftWidth: 4 },
  bannerHeader: { flexDirection: 'row', alignItems: 'center' },
  bannerIcon: { marginRight: spacing.sm },
  bannerTitle: { ...type.h3 },
  bannerBody: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
  reason: { ...type.smallMedium, color: colors.errorText, marginTop: spacing.sm },
  meta: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
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
