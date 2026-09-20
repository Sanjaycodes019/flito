import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setUser } from '../redux/slices/authSlice';
import Avatar from '../components/common/Avatar';
import ProfileHero from '../components/profile/ProfileHero';
import ProfileChecklist from '../components/profile/ProfileChecklist';
import Modal from '../components/common/Modal';
import ActionList from '../components/common/ActionList';
import { SettingsSection, SettingsRow } from '../components/common/SettingsList';
import { colors, spacing, type, themedStyles } from '../theme/tokens';
import useScreenLayout from '../hooks/useScreenLayout';
import api from '../services/api';
import { authService } from '../services/auth';
import { pickImages, takePhoto, uploadFiles } from '../services/uploads';
import { ROLES, MAX_AVATAR_BYTES } from '../utils/constants';
import { getErrorMessage } from '../utils/helpers';
import { confirmAction, notify } from '../utils/alert';

// From this window width the hero sits beside the details.
const TWO_COLUMNS_FROM = 900;

const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const layout = useScreenLayout('medium', 'wide');
  const twoColumns = layout.width >= TWO_COLUMNS_FROM;
  const [photoBusy, setPhotoBusy] = useState(false);
  // The "Profile Photo" dialog: take one, upload one, or remove it.
  const [photoSheet, setPhotoSheet] = useState(false);

  // A review can finish while the app is open, so refresh on every visit.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      authService.me()
        .then(({ user: fresh }) => { if (active) dispatch(setUser(fresh)); })
        .catch(() => {});
      return () => { active = false; };
    }, [dispatch])
  );

  const goEdit = () => navigation.navigate('EditProfile');

  const handleChangePhoto = async (source) => {
    setPhotoSheet(false);
    let asset;
    try {
      // A selfie comes from the front camera; either way it's cropped square.
      [asset] = source === 'camera'
        ? await takePhoto({ square: true, facing: 'user' })
        : await pickImages({ max: 1, square: true });
    } catch (error) {
      notify(source === 'camera' ? t('profile:alerts.cameraOpenFailedTitle') : t('profile:alerts.photosOpenFailedTitle'), getErrorMessage(error));
      return;
    }
    if (!asset) return;

    const size = asset.fileSize || asset.file?.size;
    if (size && size > MAX_AVATAR_BYTES) {
      notify(t('profile:alerts.photoTooLargeTitle'), t('profile:alerts.photoTooLargeMessage'));
      return;
    }

    setPhotoBusy(true);
    try {
      const data = await uploadFiles('/users/me/avatar', [asset], { field: 'avatar' });
      dispatch(setUser(data.user));
    } catch (error) {
      notify(t('profile:alerts.updatePhotoFailedTitle'), getErrorMessage(error));
    }
    setPhotoBusy(false);
  };

  const handleRemovePhoto = () => confirmAction({
    title: t('profile:alerts.removePhotoTitle'),
    message: t('profile:alerts.removePhotoMessage'),
    confirmLabel: t('profile:alerts.removePhotoConfirmLabel'),
    destructive: true,
    onConfirm: async () => {
      setPhotoBusy(true);
      try {
        const { data } = await api.delete('/users/me/avatar');
        dispatch(setUser(data.user));
      } catch (error) {
        notify(t('profile:alerts.removePhotoFailedTitle'), getErrorMessage(error));
      }
      setPhotoBusy(false);
    },
  });

  const isOwner = user?.role === ROLES.OWNER;
  const verifies = user?.role !== ROLES.ADMIN;
  const hasPhoto = Boolean(user?.avatarUrl);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const address = user?.address?.formatted;
  const goAddress = () => navigation.navigate('Address');
  const kycStatusKey = ['pending', 'approved', 'rejected'].includes(user?.kycStatus) ? user.kycStatus : 'not_submitted';
  const kycRow = {
    value: t(`profile:kyc.${kycStatusKey}.value`),
    pill: { label: t(`profile:kyc.${kycStatusKey}.pill`), tone: { not_submitted: 'muted', pending: 'warning', approved: 'success', rejected: 'error' }[kycStatusKey] },
  };
  const strengthSteps = [
    { key: 'photo', done: hasPhoto, label: t('profile:strength.steps.photo'), onPress: () => setPhotoSheet(true) },
    user?.email && {
      key: 'email',
      done: Boolean(user.emailVerified),
      label: t('profile:strength.steps.verifyEmail'),
      onPress: () => navigation.navigate('VerifyEmail'),
    },
    { key: 'phone', done: Boolean(user?.phone), label: t('profile:strength.steps.phone'), onPress: goEdit },
    isOwner && { key: 'company', done: Boolean(user?.companyName), label: t('profile:strength.steps.company'), onPress: goEdit },
    { key: 'address', done: Boolean(address), label: t('profile:strength.steps.address'), onPress: goAddress },
    verifies && {
      key: 'identity',
      done: user?.kycStatus === 'approved',
      // Nothing for the user to do while documents are under review.
      waiting: user?.kycStatus === 'pending',
      label: user?.kycStatus === 'rejected' ? t('profile:strength.steps.identityFix') : t('profile:strength.steps.identityVerify'),
      onPress: () => navigation.navigate('Kyc'),
    },
  ].filter(Boolean);

  const hero = (
    <ProfileHero
      user={user}
      busy={photoBusy}
      onPhoto={() => setPhotoSheet(true)}
      onEdit={goEdit}
      onSettings={() => navigation.navigate('Settings')}
    />
  );
  const checklist = <ProfileChecklist steps={strengthSteps} />;

  const details = (
    <>
      <SettingsSection
        title={t('profile:sections.about.title')}
        description={t('profile:sections.about.description')}
        actionLabel={t('profile:sections.personalInfo.edit')}
        onAction={goEdit}
      >
        <SettingsRow icon="person" label={t('profile:rows.fullName')} value={fullName || t('profile:rows.notAdded')} valueMuted={!fullName} onPress={goEdit} />
        <SettingsRow icon="phone" label={t('profile:rows.phone')} value={user?.phone || t('profile:rows.notAdded')} valueMuted={!user?.phone} onPress={goEdit} />
        {isOwner && (
          <SettingsRow icon="owner" label={t('profile:rows.company')} value={user?.companyName || t('profile:rows.notAdded')} valueMuted={!user?.companyName} onPress={goEdit} />
        )}
        <SettingsRow icon="location" label={t('profile:rows.address')} value={address || t('profile:rows.notAdded')} valueMuted={!address} onPress={goAddress} />
      </SettingsSection>

      <SettingsSection title={t('profile:sections.verification.title')} description={t('profile:sections.verification.description')}>
        {user?.email ? (
          <SettingsRow
            icon="email"
            label={t('profile:rows.email')}
            value={user.email}
            pill={user.emailVerified ? { label: t('profile:rows.verified'), tone: 'success' } : { label: t('profile:rows.notVerified'), tone: 'warning' }}
            onPress={user.emailVerified ? undefined : () => navigation.navigate('VerifyEmail')}
          />
        ) : null}
        {verifies ? (
          <SettingsRow
            icon="idCard"
            label={t('profile:rows.identity')}
            value={user?.kycStatus === 'rejected' && user?.kycRejectionReason ? user.kycRejectionReason : kycRow.value}
            pill={kycRow.pill}
            onPress={() => navigation.navigate('Kyc')}
          />
        ) : null}
      </SettingsSection>

    </>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.sideColumn}>{hero}{checklist}</View>
          <View style={styles.mainColumn}>{details}</View>
        </View>
      ) : (
        <>
          {hero}
          <View style={styles.stackedChecklist}>{checklist}</View>
          <View style={styles.stackedDetails}>{details}</View>
        </>
      )}

      <Modal visible={photoSheet} size="sm" title={t('profile:photoMenu.title')} onClose={() => setPhotoSheet(false)}>
        <View style={styles.sheetHeader}>
          <Avatar uri={user?.avatarUrl} role={user?.role} size={56} />
          <Text style={styles.sheetHint}>{t('profile:photoMenu.hint')}</Text>
        </View>
        <ActionList
          dense
          actions={[
            { icon: 'camera', label: t('profile:photoMenu.takePhoto'), onPress: () => handleChangePhoto('camera') },
            { icon: 'image', label: t('profile:photoMenu.uploadPhoto'), onPress: () => handleChangePhoto('library') },
            hasPhoto && {
              icon: 'trash',
              label: t('profile:photoMenu.removePhoto'),
              destructive: true,
              onPress: () => { setPhotoSheet(false); handleRemovePhoto(); },
            },
          ]}
        />
        <Text style={styles.sheetNote}>{t('profile:photoMenu.note')}</Text>
      </Modal>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  sideColumn: { width: 380, gap: spacing.lg },
  mainColumn: { flex: 1, minWidth: 0, paddingTop: spacing.sm },
  stackedChecklist: { marginTop: spacing.lg },
  stackedDetails: { marginTop: spacing.xl },

  // Profile photo dialog
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  sheetHint: { ...type.small, color: colors.textSecondary, flex: 1 },
  sheetNote: { ...type.small, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
}));

export default ProfileScreen;
