import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../src/screens/ProfileScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../src/services/uploads', () => ({
  pickImages: jest.fn(),
  uploadFiles: jest.fn(),
  pickDocument: jest.fn(),
  uploadPhotos: jest.fn(),
  assetFromDataUrl: jest.fn(),
}));
// The on-focus refresh never settles here, so it can't overwrite what a test
// puts in the store.
jest.mock('../src/services/auth', () => ({
  authService: { me: jest.fn(() => new Promise(() => {})), logout: jest.fn() },
}));
jest.mock('../src/services/socket', () => ({
  __esModule: true,
  default: { disconnect: jest.fn() },
}));

const api = require('../src/services/api').default;
const { pickImages, uploadFiles } = require('../src/services/uploads');
const { notify, confirmAction } = require('../src/utils/alert');

const PHOTO_URL = 'https://res.cloudinary.com/demo/image/upload/flito/avatars/me.jpg';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profile photo', () => {
  it('adds a photo from the camera badge and shows it', async () => {
    const user = fakeUser('shipper', { email: 'ram@example.com' });
    const asset = { uri: 'file:///me.jpg', mimeType: 'image/jpeg', fileSize: 200 * 1024 };
    pickImages.mockResolvedValue([asset]);
    uploadFiles.mockResolvedValue({ user: { ...user, avatarUrl: PHOTO_URL } });
    const { findByLabelText, findByText, store } = renderWithProviders(
      <ProfileScreen navigation={fakeNavigation()} />,
      { user },
    );

    fireEvent.press(await findByLabelText('Add profile photo'));

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith('/users/me/avatar', [asset], { field: 'avatar' }));
    expect(pickImages).toHaveBeenCalledWith({ max: 1, square: true });
    await waitFor(() => expect(store.getState().auth.user.avatarUrl).toBe(PHOTO_URL));
    expect(await findByText('Remove Photo')).toBeTruthy();
  });

  it('refuses a photo over 5 MB without uploading it', async () => {
    pickImages.mockResolvedValue([{ uri: 'file:///big.jpg', fileSize: 6 * 1024 * 1024 }]);
    const { findByText } = renderWithProviders(
      <ProfileScreen navigation={fakeNavigation()} />,
      { user: fakeUser('owner') },
    );

    fireEvent.press(await findByText('Add Photo'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Photo too large', expect.any(String)));
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('removes the photo after confirming', async () => {
    const user = fakeUser('driver', { avatarUrl: PHOTO_URL });
    api.delete.mockResolvedValue({ data: { user: { ...user, avatarUrl: null } } });
    const { findByText, store } = renderWithProviders(
      <ProfileScreen navigation={fakeNavigation()} />,
      { user },
    );

    fireEvent.press(await findByText('Remove Photo'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/me/avatar'));
    await waitFor(() => expect(store.getState().auth.user.avatarUrl).toBeNull());
  });
});
