import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';
import { colors, spacing, type } from '../../theme/tokens';

// Bridges the imperative notify()/confirmAction() calls in utils/alert.js
// (used throughout the app, called from outside any component) to this
// branded modal, so every alert and confirmation shares FLITO's own visual
// language instead of the OS-native alert / browser window.confirm, which
// looked like a different app entirely.
//
// Judgment call: this changes the internal implementation of notify/
// confirmAction, not their call signature, so no call site or test
// (they mock the whole module) needed to change.
let bridge = null;
export const _setAlertBridge = (fns) => { bridge = fns; };
export const _getAlertBridge = () => bridge;

const AlertHost = () => {
  const { t } = useTranslation();
  const [state, setState] = useState(null);

  useEffect(() => {
    _setAlertBridge({
      notify: (title, message, onDismiss) => setState({ kind: 'notify', title, message, onDismiss }),
      confirm: (options) => setState({ kind: 'confirm', ...options }),
    });
    return () => _setAlertBridge(null);
  }, []);

  if (!state) return null;

  const dismiss = (after) => {
    setState(null);
    after?.();
  };

  return (
    <Modal
      visible
      title={state.title}
      onClose={() => dismiss(state.kind === 'notify' ? state.onDismiss : undefined)}
      footer={
        <View style={styles.actions}>
          {state.kind === 'confirm' && (
            <Button
              title={t('common:actions.cancel')}
              variant="ghost"
              size="sm"
              style={styles.actionButton}
              onPress={() => dismiss()}
            />
          )}
          <Button
            title={state.kind === 'confirm' ? (state.confirmLabel || t('common:actions.confirm')) : t('common:actions.ok')}
            variant={state.kind === 'confirm' && state.destructive ? 'destructive' : 'primary'}
            size="sm"
            style={styles.actionButton}
            onPress={() => dismiss(state.kind === 'confirm' ? state.onConfirm : state.onDismiss)}
          />
        </View>
      }
    >
      {!!state.message && <Text style={styles.message}>{state.message}</Text>}
    </Modal>
  );
};

const styles = StyleSheet.create({
  message: { ...type.body, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { minWidth: 96 },
});

export default AlertHost;
