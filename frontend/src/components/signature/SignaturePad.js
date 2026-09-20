import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
// Reusing the map's generic HTML-bridge host (WebView on native, iframe on
// web). It just embeds a page and exchanges JSON messages, which is exactly
// what the signature pad needs too. See mapHtml.js's comment for why.
import MapCanvas from '../map/MapCanvas';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { notify } from '../../utils/alert';
import { buildSignaturePadHtml } from './signaturePadHtml';

const HTML = buildSignaturePadHtml(); // static page, built once, not per render

// A full-screen signature pad. `onSave(dataUrl)` is called with a data: URI
// PNG; the caller is responsible for uploading and closing the modal (so it
// can show its own loading/error state on the Save button while that happens).
const SignaturePad = ({ visible, onClose, onSave, saving }) => {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [requestingSave, setRequestingSave] = useState(false);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  const handleSave = () => {
    setRequestingSave(true);
    canvasRef.current?.postMessage({ type: 'requestSave' });
  };

  const handleMessage = (msg) => {
    if (msg.type !== 'signature') return;
    setRequestingSave(false);
    if (msg.empty) {
      notify(t('bookings:signaturePad.nothingSignedTitle'), t('bookings:signaturePad.nothingSignedMessage'));
      return;
    }
    onSave(msg.dataUrl);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>{t('bookings:signaturePad.title')}</Text>
            <Text style={styles.hint}>{t('bookings:signaturePad.hint')}</Text>
          </View>
          <Button title="" icon="close" variant="ghost" size="sm" onPress={onClose} accessibilityLabel={t('common:actions.close')} style={styles.closeButton} />
        </View>
      </View>

      <View style={styles.padContainer}>
        <MapCanvas ref={canvasRef} html={HTML} style={{ width: '100%', height: '100%' }} onMapMessage={handleMessage} />
      </View>

      <View style={styles.actions}>
        <Button
          title={t('common:actions.clear')}
          icon="refresh"
          variant="tertiary"
          onPress={() => canvasRef.current?.postMessage({ type: 'clear' })}
          style={styles.actionButton}
        />
        <Button title={t('common:actions.cancel')} variant="ghost" onPress={onClose} style={styles.actionButton} />
        <Button
          title={t('bookings:signaturePad.save')}
          icon="checkmark"
          onPress={handleSave}
          loading={saving || requestingSave}
          style={styles.actionButton}
        />
      </View>
    </Modal>
  );
};

const styles = themedStyles(() => ({
  header: { padding: spacing.lg, paddingTop: spacing.xxxl, backgroundColor: colors.surface },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTextCol: { flex: 1 },
  title: { ...type.h2, color: colors.textPrimary },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  closeButton: { width: 40, marginLeft: spacing.sm },
  padContainer: { flex: 1, margin: spacing.lg, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  actionButton: { flex: 1 },
}));

export default SignaturePad;
