import React, { useEffect, useRef, useState } from 'react';
import { Modal as RNModal, View, Text, Pressable, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';
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
// `size="sm"` is a compact dialog (a short menu or a quick choice): narrower,
// with tighter padding and a smaller title.
const Modal = ({
  visible,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  size = 'md',
  // A dialog that puts the cursor in its own field (a search box) turns this
  // off, so opening it doesn't pull focus to the close button instead.
  focusCloseOnOpen = true,
  testID,
}) => {
  const closeButtonRef = useRef(null);
  const focusedOnOpen = useRef(false);
  const [closeFocused, setCloseFocused] = useState(false);
  const small = size === 'sm';
  // Capped against the window, not the parent: a percentage max height
  // resolved against the sheet's own content-sized wrapper, so every dialog
  // lost a tenth of its height and scrolled (hiding its last line) even with
  // plenty of room on screen.
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.min(windowHeight * 0.9, windowHeight - spacing.lg * 2);

  // Escape-to-close and a basic focus landing point on open. RN's Modal has
  // no native affordance for either on web (react-native-web renders it as
  // a plain fixed-position div, not a <dialog>), so both are done by hand.
  //
  // The effect runs only when the dialog opens. Depending on `onClose` made it
  // run again on every parent re-render (a new function each time), which
  // pulled focus back to the close button after each key typed into a field
  // inside the dialog. The latest `onClose` is read through a ref instead.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    if (focusCloseOnOpen) {
      focusedOnOpen.current = true;
      closeButtonRef.current?.focus?.();
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, focusCloseOnOpen]);

  // The focus placed on open is only a landing point for keyboard users, so
  // it doesn't draw the focus ring (which looked like a stray highlighted
  // button to everyone else). Tabbing back to the close button still does.
  const handleCloseFocus = () => {
    if (focusedOnOpen.current) {
      focusedOnOpen.current = false;
      return;
    }
    setCloseFocused(true);
  };

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
        <Pressable style={[styles.sheetWrapper, small && styles.sheetWrapperSm]} onPress={(e) => e.stopPropagation?.()}>
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]} accessibilityRole="none" accessibilityViewIsModal>
            <View style={[styles.header, small && styles.headerSm]}>
              <Text style={[styles.title, small && styles.titleSm]} numberOfLines={2}>{title}</Text>
              <Pressable
                ref={closeButtonRef}
                onPress={onClose}
                onFocus={handleCloseFocus}
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
              contentContainerStyle={[styles.bodyContent, small && styles.bodyContentSm]}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer && <View style={[styles.footer, small && styles.footerSm]}>{footer}</View>}
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
  sheetWrapperSm: { maxWidth: 380 },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
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
  headerSm: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { ...type.h2, color: colors.textPrimary, flex: 1, paddingRight: spacing.md },
  titleSm: { ...type.h3 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: { backgroundColor: colors.surfaceMuted },
  focusRing: { borderWidth: 2, borderColor: colors.focusRing },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  bodyContentSm: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  footerSm: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});

export default Modal;
