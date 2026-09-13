import React, { useEffect, useRef, useState } from 'react';
import { Modal as RNModal, View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { colors, spacing, radius, shadow, type, iconSize } from '../../theme/tokens';
import Icon from '../../theme/icons';

// react-native-web always renders a ScrollView as an overflow:scroll div, so
// a native OS scrollbar shows even when nothing overflows. `overflow` isn't
// a style RN validates, so it's passed as a raw object outside
// StyleSheet.create, which react-native-web forwards straight to CSS.
const webNoScrollbar = Platform.OS === 'web' ? { overflowY: 'auto', scrollbarWidth: 'none' } : null;

// The single modal/dialog shell for the whole app: a header (title + close),
// a scrollable body, and an optional footer, over a dismissible backdrop.
// Every confirmation, form sheet, and info dialog in FLITO should be built
// on this instead of a one-off View, so headers/footers/close behavior
// never drift between screens.
const Modal = ({
  visible,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  testID,
}) => {
  const closeButtonRef = useRef(null);
  const [closeFocused, setCloseFocused] = useState(false);

  // Escape-to-close and a basic focus landing point on open. RN's Modal has
  // no native affordance for either on web (react-native-web renders it as
  // a plain fixed-position div, not a <dialog>), so both are done by hand.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus?.();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        style={styles.backdrop}
        onPress={closeOnBackdrop ? onClose : undefined}
        accessibilityRole="none"
      >
        {/* Stop backdrop press-to-close from swallowing taps inside the sheet. */}
        <Pressable style={styles.sheetWrapper} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.sheet} accessibilityRole="none" accessibilityViewIsModal>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              <Pressable
                ref={closeButtonRef}
                onPress={onClose}
                onFocus={() => setCloseFocused(true)}
                onBlur={() => setCloseFocused(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                  closeFocused && styles.focusRing,
                ]}
              >
                <Icon name="close" size={iconSize.md} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={[styles.body, webNoScrollbar]}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheetWrapper: { width: '100%', maxWidth: 480 },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '90%',
    ...shadow.level3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { ...type.h2, color: colors.textPrimary, flex: 1, paddingRight: spacing.md },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: { backgroundColor: colors.surfaceMuted },
  focusRing: { borderWidth: 2, borderColor: colors.accent },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
});

export default Modal;
