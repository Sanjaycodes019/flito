import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import PhotoSourceButtons from '../components/common/PhotoSourceButtons';
import { StatusPill } from '../components/common/SettingsList';
import DocumentTile from '../components/kyc/DocumentTile';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { KYC_DOCUMENT_LABELS, KYC_ID_TYPE_OPTIONS, MAX_DOCUMENT_BYTES } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/helpers';
import { notify, confirmAction } from '../utils/alert';
import useScreenLayout from '../hooks/useScreenLayout';
import api from '../services/api';
import { pickDocument, takePhoto, uploadFiles } from '../services/uploads';
import { setUser } from '../redux/slices/authSlice';

// Stands for "no identity document is complete yet" in missingDocuments.
const IDENTITY_REQUIREMENT = 'identity';

const STATUS_COPY = {
  not_submitted: {
    title: 'Verify your identity',
    body: 'Upload your documents below, then submit them for review.',
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

const ID_OPTION = Object.fromEntries(KYC_ID_TYPE_OPTIONS.map((option) => [option.value, option]));

const labelFor = (docType) => KYC_DOCUMENT_LABELS[docType] || docType;

// A document name for use inside a sentence ("your citizenship card"), keeping
// initialisms such as PAN in capitals.
const inSentence = (docType) => {
  const label = labelFor(docType);
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
};

// One document slot: its name and state, the uploaded file, and the ways to
// add, replace or remove it.
const DocumentRow = ({ docType, doc, emptyPill, canEdit, busy, onUpload, onRemove, first }) => (
  <View style={[styles.docRow, !first && styles.docRowDivider]}>
    <View style={styles.docHeader}>
      <Text style={styles.docLabel}>{labelFor(docType)}</Text>
      {doc ? <StatusPill label="Uploaded" tone="success" icon="success" /> : emptyPill ? <StatusPill {...emptyPill} /> : null}
    </View>

    {doc && <DocumentTile doc={doc} label={`View ${inSentence(docType)}`} />}

    {canEdit && (
      <>
        <PhotoSourceButtons
          onTakePhoto={() => onUpload(docType, 'camera')}
          onChoose={() => onUpload(docType, 'library')}
          takeLabel={doc ? 'Retake Photo' : 'Take Photo'}
          chooseLabel={doc ? 'Replace File' : 'Upload File'}
          chooseIcon="upload"
          busy={busy?.type === docType ? busy.source : null}
          disabled={Boolean(busy) && busy.type !== docType}
          style={styles.sourceButtons}
        />
        {doc && (
          <Button
            title="Remove"
            icon="trash"
            variant="ghost"
            size="sm"
            onPress={() => onRemove(doc)}
            loading={busy?.type === docType && busy.source === 'remove'}
            disabled={Boolean(busy)}
            style={styles.removeButton}
          />
        )}
      </>
    )}
  </View>
);

// One identity document as an expandable row: its status at a glance, and
// the upload slot for each of its sides when opened. `optional` marks a
// document with nothing uploaded that isn't needed to submit.
const IdentityOption = ({ option, documentsByType, optional, expanded, onToggle, children }) => {
  const [hovered, setHovered] = useState(false);
  const meta = ID_OPTION[option.idType] || { label: option.idType, icon: 'idCard' };
  const uploadedCount = option.documents.filter((docType) => documentsByType[docType]).length;

  let pill = null;
  if (option.complete) pill = { label: 'Complete', tone: 'success', icon: 'success' };
  else if (uploadedCount > 0) pill = { label: `${uploadedCount} of ${option.documents.length} uploaded`, tone: 'warning' };
  else if (optional) pill = { label: 'Optional', tone: 'muted' };

  return (
    <View style={styles.option}>
      <Pressable
        onPress={onToggle}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={meta.label}
        style={[styles.optionHeader, hovered && styles.optionHeaderHovered]}
      >
        <View style={[styles.optionIcon, option.complete && styles.optionIconComplete]}>
          <Icon name={meta.icon} size={iconSize.md} color={option.complete ? colors.successText : colors.textSecondary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>{meta.label}</Text>
          <Text style={styles.optionDetail}>{option.documents.length > 1 ? 'Front and back' : 'One photo'}</Text>
        </View>
        {pill && <StatusPill {...pill} />}
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={iconSize.md} color={colors.textMuted} />
      </Pressable>
      {expanded && <View style={styles.optionBody}>{children}</View>}
    </View>
  );
};

const KycScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [kyc, setKyc] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // The document being worked on and how: { type, source } with source
  // 'camera', 'library' or 'remove'.
  const [busy, setBusy] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Identity documents the user has opened or closed; others follow a default.
  const [expanded, setExpanded] = useState({});
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

  // `source` is 'camera' (photograph the document now) or 'library' (an
  // existing image or PDF file).
  const handleUpload = async (docType, source) => {
    let asset;
    try {
      asset = source === 'camera' ? (await takePhoto())[0] : await pickDocument();
    } catch (error) {
      notify(source === 'camera' ? 'Could not open the camera' : 'Could not open files', getErrorMessage(error));
      return;
    }
    if (!asset) return;
    const size = asset.size || asset.fileSize;
    if (size && size > MAX_DOCUMENT_BYTES) {
      notify('File too large', 'Documents must be 10 MB or smaller');
      return;
    }

    setBusy({ type: docType, source });
    try {
      const data = await uploadFiles('/users/me/kyc/documents', [asset], { field: 'document', fields: { type: docType } });
      setKyc(data.kyc);
    } catch (error) {
      notify('Upload failed', getErrorMessage(error));
    }
    setBusy(null);
  };

  const handleRemove = (doc) => confirmAction({
    title: 'Remove document',
    message: `Remove your ${inSentence(doc.type)}?`,
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: async () => {
      setBusy({ type: doc.type, source: 'remove' });
      try {
        const { data } = await api.delete(`/users/me/kyc/documents/${doc._id}`);
        setKyc(data.kyc);
      } catch (error) {
        notify('Error', getErrorMessage(error));
      }
      setBusy(null);
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
  // Reviewers check the address alongside the documents, so it's needed to submit.
  const addressMissing = kyc.addressComplete === false;
  const ready = kyc.missingDocuments.length === 0 && !addressMissing;
  const identity = kyc.identity || { required: true, complete: false, options: [] };
  // False for a driver: their required driving license is their identity
  // document, so citizenship, NID and passport are all optional extras.
  const identityRequired = identity.required !== false;

  const hasUpload = (option) => option.documents.some((docType) => documentsByType[docType]);
  // Once submitted, only the identity documents actually uploaded are shown.
  const identityOptions = kyc.canEdit ? identity.options : identity.options.filter(hasUpload);
  const isExpanded = (option) => (kyc.canEdit ? expanded[option.idType] ?? hasUpload(option) : true);
  const toggle = (option) => setExpanded((current) => ({ ...current, [option.idType]: !isExpanded(option) }));

  const rowProps = { canEdit: kyc.canEdit, busy, onUpload: handleUpload, onRemove: handleRemove };

  const missingNames = kyc.missingDocuments.map((item) => (
    item === IDENTITY_REQUIREMENT ? 'an identity document' : inSentence(item)
  ));
  const toDo = [];
  if (addressMissing) toDo.push('add your address');
  if (missingNames.length) toDo.push(`upload ${missingNames.join(' and ')}`);
  const toDoText = toDo.join(' and ');
  const submitHint = toDoText ? `${toDoText[0].toUpperCase()}${toDoText.slice(1)} to submit.` : null;

  let identityHint = 'The identity documents you submitted.';
  if (kyc.canEdit) {
    identityHint = identityRequired
      ? 'Upload at least one. Cards need both sides. Once one is complete, the others are optional.'
      : 'Optional. Your driving license is your identity document, but you can add these too.';
  }

  let identityPill = null;
  if (kyc.canEdit) {
    if (!identityRequired) identityPill = { label: 'Optional', tone: 'muted' };
    else if (identity.complete) identityPill = { label: 'Complete', tone: 'success', icon: 'success' };
    else identityPill = { label: 'Required', tone: 'warning' };
  }

  const identitySection = identityOptions.length > 0 && (
    <Card style={styles.section} key="identity">
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {identityRequired ? 'Identity Document' : 'Other Identity Documents'}
          </Text>
          <Text style={styles.sectionHint}>{identityHint}</Text>
        </View>
        {identityPill && <StatusPill {...identityPill} />}
      </View>

      {identityOptions.map((option) => (
        <IdentityOption
          key={option.idType}
          option={option}
          documentsByType={documentsByType}
          optional={!identityRequired || identity.complete}
          expanded={isExpanded(option)}
          onToggle={() => toggle(option)}
        >
          {option.documents.map((docType, index) => (
            <DocumentRow
              key={docType}
              docType={docType}
              doc={documentsByType[docType]}
              first={index === 0}
              {...rowProps}
            />
          ))}
        </IdentityOption>
      ))}
    </Card>
  );

  const requiredSection = kyc.requiredDocuments.length > 0 && (
    <Card style={styles.section} key="required">
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Required Documents</Text>
          <Text style={styles.sectionHint}>Needed for your account type.</Text>
        </View>
      </View>
      <View style={styles.sectionRows}>
        {kyc.requiredDocuments.map((docType, index) => (
          <DocumentRow
            key={docType}
            docType={docType}
            doc={documentsByType[docType]}
            emptyPill={{ label: 'Required', tone: 'warning' }}
            first={index === 0}
            {...rowProps}
          />
        ))}
      </View>
    </Card>
  );

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

      {kyc.canEdit && addressMissing && (
        <Card style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <View style={styles.addressIcon}>
              <Icon name="location" size={iconSize.md} color={colors.warningText} />
            </View>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Add your address</Text>
              <Text style={styles.sectionHint}>Reviewers check it along with your documents, so it&apos;s needed before you submit.</Text>
            </View>
          </View>
          <Button title="Add Address" icon="location" variant="tertiary" onPress={() => navigation.navigate('Address')} />
        </Card>
      )}

      {/* What must be uploaded always comes first: the identity document for
          most roles, the required documents for a driver. */}
      {identityRequired ? [identitySection, requiredSection] : [requiredSection, identitySection]}

      {kyc.optionalDocuments.length > 0 && (kyc.canEdit || kyc.optionalDocuments.some((docType) => documentsByType[docType])) && (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Optional Documents</Text>
              <Text style={styles.sectionHint}>Not needed to get verified, but they help.</Text>
            </View>
          </View>
          <View style={styles.sectionRows}>
            {kyc.optionalDocuments.map((docType, index) => (
              <DocumentRow
                key={docType}
                docType={docType}
                doc={documentsByType[docType]}
                emptyPill={{ label: 'Optional', tone: 'muted' }}
                first={index === 0}
                {...rowProps}
              />
            ))}
          </View>
        </Card>
      )}

      {kyc.canEdit && (
        <>
          <Button
            title={kyc.status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
            icon="checkmark"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!ready}
            style={styles.submit}
          />
          {!ready && submitHint && <Text style={styles.hint}>{submitHint}</Text>}
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

  section: { padding: 0, overflow: 'hidden' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionHeading: { flex: 1 },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  sectionHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  sectionRows: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider },

  option: { borderTopWidth: 1, borderTopColor: colors.divider },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionHeaderHovered: { backgroundColor: colors.surfaceMuted },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconComplete: { backgroundColor: colors.successMuted },
  optionText: { flex: 1, minWidth: 0 },
  optionLabel: { ...type.bodyMedium, color: colors.textPrimary },
  optionDetail: { ...type.small, color: colors.textMuted, marginTop: 1 },
  optionBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  docRow: { paddingVertical: spacing.md },
  docRowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  docLabel: { ...type.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  sourceButtons: { marginTop: spacing.xs },
  removeButton: { alignSelf: 'flex-start' },

  addressCard: { borderLeftWidth: 4, borderLeftColor: colors.warning },
  addressHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.warningMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: spacing.sm },
  hint: { textAlign: 'center', ...type.small, color: colors.textMuted, marginBottom: spacing.lg },
});

export default KycScreen;
