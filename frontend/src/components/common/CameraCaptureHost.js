import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// Laptop browsers ignore a file input's camera hint and simply open a file
// chooser, so "Take Photo" there opens this window instead. It follows the
// capture flow of video-call and account apps (Google Meet, Zoom): a live
// preview, a round shutter button, a camera switch when there is more than
// one camera, and a review step (Retake / Use Photo) before anything uploads.
//
// Like AlertHost, it is mounted once at the app root and opened through a
// bridge by services/uploads.js (takePhoto). Phones, in the app or a phone
// browser, use their own camera app and never open it.
let bridge = null;
export const _getCameraBridge = () => bridge;

const CAMERA_ERROR_KEYS = {
  NotAllowedError: 'notAllowed',
  NotFoundError: 'notFound',
  NotReadableError: 'notReadable',
};

const CameraCaptureHost = () => {
  const { t } = useTranslation();
  // { square, facing, resolve } while the window is open.
  const [request, setRequest] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  // A captured photo waiting for Retake or Use Photo.
  const [shot, setShot] = useState(null);
  const [canSwitch, setCanSwitch] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // The stream and the <video> can arrive in either order (the dialog mounts
  // its content a moment after opening, and again after a retake), so
  // whichever comes second connects them.
  const attach = useCallback(() => {
    const video = videoRef.current;
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    bridge = {
      open: (options) => new Promise((resolve) => {
        setError(null);
        setReady(false);
        setShot(null);
        setRequest({ ...options, resolve });
      }),
    };
    return () => { bridge = null; };
  }, []);

  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          const err = new Error('unsupported');
          err.name = 'NotFoundError';
          throw err;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: request.facing, width: { ideal: 1600 }, height: { ideal: 1200 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        attach();

        const devices = await navigator.mediaDevices.enumerateDevices?.() || [];
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch (err) {
        if (!cancelled) {
          const key = CAMERA_ERROR_KEYS[err?.name];
          setError(key ? t(`common:camera.${key}`) : t('common:camera.genericError'));
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // `attempt` restarts the camera after "Try Again".
  }, [request, attempt, attach, stopStream]);

  const discardShot = () => {
    if (shot?.uri) URL.revokeObjectURL(shot.uri);
    setShot(null);
  };

  const finish = (asset) => {
    const resolve = request?.resolve;
    stopStream();
    setRequest(null);
    setShot(null);
    resolve?.(asset);
  };

  const cancel = () => {
    discardShot();
    finish(null);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;

    const { videoWidth: width, videoHeight: height } = video;
    const side = Math.min(width, height);
    // A square photo keeps the centered square the preview shows; anything
    // else keeps the whole frame.
    const [sx, sy, sw, sh] = request.square
      ? [(width - side) / 2, (height - side) / 2, side, side]
      : [0, 0, width, height];

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError(t('common:camera.captureError'));
        return;
      }
      const fileName = `photo-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      setShot({
        uri: URL.createObjectURL(file),
        file,
        fileName,
        mimeType: 'image/jpeg',
        fileSize: file.size,
        width: sw,
        height: sh,
      });
    }, 'image/jpeg', 0.92);
  };

  const retake = () => {
    discardShot();
    setReady(false);
  };

  const switchCamera = () => {
    setReady(false);
    setRequest((current) => ({ ...current, facing: current.facing === 'user' ? 'environment' : 'user' }));
  };

  const tryAgain = () => {
    setError(null);
    setReady(false);
    setAttempt((n) => n + 1);
  };

  if (Platform.OS !== 'web' || !request) return null;

  let footer;
  if (error) {
    footer = (
      <View style={styles.footerEnd}>
        <Button title={t('common:camera.cancel')} variant="ghost" size="sm" onPress={cancel} style={styles.footerButton} />
        <Button title={t('common:camera.tryAgain')} icon="refresh" size="sm" onPress={tryAgain} style={styles.footerButton} />
      </View>
    );
  } else if (shot) {
    footer = (
      <View style={styles.footerEnd}>
        <Button title={t('common:camera.retake')} icon="refresh" variant="tertiary" size="sm" onPress={retake} style={styles.footerButton} />
        <Button title={t('common:camera.usePhoto')} icon="checkmark" size="sm" onPress={() => finish(shot)} style={styles.footerButton} />
      </View>
    );
  } else {
    footer = (
      <View style={styles.controls}>
        <View style={styles.controlSide}>
          <Button title={t('common:camera.cancel')} variant="ghost" size="sm" onPress={cancel} />
        </View>
        <Pressable
          onPress={capture}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel={t('common:camera.capturePhoto')}
          style={[styles.shutter, !ready && styles.shutterDisabled]}
        >
          {({ pressed }) => <View style={[styles.shutterInner, pressed && styles.shutterInnerPressed]} />}
        </Pressable>
        <View style={[styles.controlSide, styles.controlSideEnd]}>
          {canSwitch && (
            <Pressable
              onPress={switchCamera}
              accessibilityRole="button"
              accessibilityLabel={t('common:camera.switchCamera')}
              style={({ pressed }) => [styles.roundButton, pressed && styles.roundButtonPressed]}
            >
              <Icon name="cameraFlip" size={iconSize.md} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible
      title={error ? t('common:camera.cameraUnavailable') : shot ? t('common:camera.reviewPhoto') : t('common:camera.takeAPhoto')}
      onClose={cancel}
      closeOnBackdrop={false}
      footer={footer}
    >
      {error ? (
        <View style={styles.errorState}>
          <View style={styles.errorIcon}>
            <Icon name="cameraOff" size={iconSize.xl} color={colors.errorText} />
          </View>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={[styles.frame, request.square && styles.frameSquare]}>
            {shot ? (
              <Image
                source={{ uri: shot.uri }}
                style={styles.fill}
                resizeMode={request.square ? 'cover' : 'contain'}
                accessibilityLabel={t('common:camera.capturedPhoto')}
              />
            ) : (
              React.createElement('video', {
                ref: (el) => { videoRef.current = el; attach(); },
                autoPlay: true,
                playsInline: true,
                muted: true,
                onLoadedMetadata: () => setReady(true),
                'aria-label': t('common:camera.cameraPreview'),
                style: {
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  // A square photo previews exactly the part that will be kept.
                  objectFit: request.square ? 'cover' : 'contain',
                  // A front camera previews like a mirror, as people expect;
                  // the saved photo is not mirrored.
                  transform: request.facing === 'user' ? 'scaleX(-1)' : undefined,
                },
              })
            )}

            {!shot && request.square && ready && <View style={styles.faceGuide} pointerEvents="none" />}

            {!shot && !ready && (
              <View style={styles.starting} pointerEvents="none">
                <ActivityIndicator color={colors.textOnDark} />
                <Text style={styles.startingText}>{t('common:camera.startingCamera')}</Text>
              </View>
            )}
          </View>

          <Text style={styles.hint}>
            {shot
              ? t('common:camera.hintReview')
              : request.square
                ? t('common:camera.hintSquare')
                : t('common:camera.hintWide')}
          </Text>
        </>
      )}
    </Modal>
  );
};

const styles = themedStyles(() => ({
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  frameSquare: { aspectRatio: 1, maxWidth: 380, alignSelf: 'center' },
  fill: { width: '100%', height: '100%' },
  faceGuide: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '80%',
    height: '80%',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  starting: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  startingText: { ...type.small, color: colors.textInverseMuted },
  hint: { ...type.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },

  errorState: { alignItems: 'center', paddingVertical: spacing.lg },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorMessage: { ...type.body, color: colors.textSecondary, textAlign: 'center' },

  footerEnd: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { minWidth: 104 },

  // Live camera controls: Cancel on the left, the shutter centered, the
  // camera switch on the right.
  controls: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  controlSide: { flex: 1, alignItems: 'flex-start' },
  controlSideEnd: { alignItems: 'flex-end' },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.35 },
  shutterInner: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary },
  shutterInnerPressed: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryPressed },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonPressed: { backgroundColor: colors.border },
}));

export default CameraCaptureHost;
