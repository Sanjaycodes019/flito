import React, { useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
// Reusing the map's generic HTML-bridge host (WebView on native, iframe on
// web) — it just embeds a page and exchanges JSON messages, which is exactly
// what the signature pad needs too. See mapHtml.js's comment for why.
import MapCanvas from '../map/MapCanvas';
import Button from '../common/Button';
import { FLITO_COLORS } from '../../utils/colors';
import { notify } from '../../utils/alert';
import { buildSignaturePadHtml } from './signaturePadHtml';

const HTML = buildSignaturePadHtml(); // static page — built once, not per render

// A modal signature pad. `onSave(dataUrl)` is called with a data: URI PNG;
// the caller is responsible for uploading and closing the modal (so it can
// show its own loading/error state on the Save button while that happens).
const SignaturePad = ({ visible, onClose, onSave, saving }) => {
  const canvasRef = useRef(null);
  const [requestingSave, setRequestingSave] = useState(false);

  const handleSave = () => {
    setRequestingSave(true);
    canvasRef.current?.postMessage({ type: 'requestSave' });
  };

  const handleMessage = (msg) => {
    if (msg.type !== 'signature') return;
    setRequestingSave(false);
    if (msg.empty) {
      notify('Nothing signed', 'Draw a signature before saving');
      return;
    }
    onSave(msg.dataUrl);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipient Signature</Text>
        <Text style={styles.hint}>Have the recipient sign below to confirm delivery</Text>
      </View>

      <View style={styles.padContainer}>
        <MapCanvas ref={canvasRef} html={HTML} style={{ width: '100%', height: '100%' }} onMapMessage={handleMessage} />
      </View>

      <View style={styles.actions}>
        <Button
          title="Clear"
          variant="outline"
          onPress={() => canvasRef.current?.postMessage({ type: 'clear' })}
          style={styles.actionButton}
        />
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.actionButton} />
        <Button
          title="Save Signature"
          onPress={handleSave}
          loading={saving || requestingSave}
          style={styles.actionButton}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: { padding: 16, paddingTop: 32, backgroundColor: FLITO_COLORS.bgLight },
  title: { fontSize: 18, fontWeight: '700', color: FLITO_COLORS.secondary },
  hint: { fontSize: 13, color: FLITO_COLORS.textMuted, marginTop: 4 },
  padContainer: { flex: 1, margin: 16, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#DDD' },
  actions: { flexDirection: 'row', gap: 8, padding: 16 },
  actionButton: { flex: 1 },
});

export default SignaturePad;
