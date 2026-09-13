import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import DocumentTile from '../components/kyc/DocumentTile';
import { FLITO_COLORS } from '../utils/colors';
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
    color: FLITO_COLORS.info,
  },
  pending: {
    title: 'Under review',
    body: "Your documents are being checked. You can't change them until the review is finished.",
    color: FLITO_COLORS.warning,
  },
  approved: {
    title: 'Verified',
    body: 'Your identity has been verified.',
    color: FLITO_COLORS.success,
  },
  rejected: {
    title: 'Changes needed',
    body: 'Your documents were not approved. Fix the issue below and submit again.',
    color: FLITO_COLORS.error,
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={[styles.banner, { borderLeftColor: copy.color }]}>
        <Text style={[styles.bannerTitle, { color: copy.color }]}>{copy.title}</Text>
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
              <Text style={styles.docLabel}>{labelFor(type)}</Text>
              <Text style={[styles.docState, doc ? styles.docUploaded : null]}>
                {doc ? 'Uploaded' : required ? 'Required' : 'Optional'}
              </Text>
            </View>

            {doc && <DocumentTile doc={doc} label={`View ${labelFor(type).toLowerCase()}`} />}

            {kyc.canEdit && (
              <View style={styles.actionsRow}>
                <Button
                  title={doc ? 'Replace' : 'Upload'}
                  variant={doc ? 'outline' : 'primary'}
                  onPress={() => handleUpload(type)}
                  loading={busyType === type}
                  style={styles.actionButton}
                />
                {doc && (
                  <Button title="Remove" variant="outline" onPress={() => handleRemove(doc)} style={styles.actionButton} />
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
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  banner: { borderLeftWidth: 4 },
  bannerTitle: { fontSize: 18, fontWeight: '700' },
  bannerBody: { fontSize: 14, color: FLITO_COLORS.secondary, marginTop: 4 },
  reason: { fontSize: 14, color: FLITO_COLORS.error, fontWeight: '600', marginTop: 8 },
  meta: { fontSize: 12, color: FLITO_COLORS.textMuted, marginTop: 6 },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  docLabel: { fontSize: 15, fontWeight: '600', color: FLITO_COLORS.secondary },
  docState: { fontSize: 12, fontWeight: '600', color: FLITO_COLORS.textMuted },
  docUploaded: { color: FLITO_COLORS.success },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1 },
  hint: { textAlign: 'center', fontSize: 12, color: FLITO_COLORS.textMuted, marginBottom: 16 },
});

export default KycScreen;
