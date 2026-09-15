import React from 'react';
import { View, StyleSheet } from 'react-native';
import Button from './Button';
import { spacing } from '../../theme/tokens';

// The pair of choices offered everywhere a photo is asked for: take one now
// with the camera, or choose one that already exists. `busy` is the source
// currently working ('camera' or 'library'), which shows its spinner and
// holds the other button until it finishes. The two sit side by side and wrap
// to their own rows when there isn't room for both labels.
const PhotoSourceButtons = ({
  onTakePhoto,
  onChoose,
  takeLabel = 'Take Photo',
  chooseLabel = 'Choose Photo',
  chooseIcon = 'image',
  busy = null,
  disabled = false,
  variant = 'tertiary',
  style,
}) => (
  <View style={[styles.row, style]}>
    <Button
      title={takeLabel}
      icon="camera"
      variant={variant}
      onPress={onTakePhoto}
      loading={busy === 'camera'}
      disabled={disabled || (Boolean(busy) && busy !== 'camera')}
      style={styles.button}
    />
    <Button
      title={chooseLabel}
      icon={chooseIcon}
      variant={variant}
      onPress={onChoose}
      loading={busy === 'library'}
      disabled={disabled || (Boolean(busy) && busy !== 'library')}
      style={styles.button}
    />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm },
  button: { flexGrow: 1, flexBasis: 140 },
});

export default PhotoSourceButtons;
