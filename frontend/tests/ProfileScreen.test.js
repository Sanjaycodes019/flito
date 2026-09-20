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
  takePhoto: jest.fn(),
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

const api = require('../src/services/api').default;
const { pickImages, takePhoto, uploadFiles } = require('../src/services/uploads');
const { notify, confirmAction } = require('../src/utils/alert');

const PHOTO_URL = 'https://res.cloudinary.com/demo/image/upload/flito/avatars/me.jpg';

const renderProfile = (user, navigation = fakeNavigation()) =>
  renderWithProviders(<ProfileScreen navigation={navigation} />, { user });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profile page', () => {
  it('shows the saved address and opens the Address screen from it', async () => {
    const navigation = fakeNavigation();
    const address = {
      formatted: 'Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province',
      ward: 20,
      tole: 'Basantapur',
    };
    const { findByLabelText } = renderProfile(fakeUser('shipper', { address }), navigation);

    fireEvent.press(await findByLabelText(`Address, ${address.formatted}`));

    expect(navigation.navigate).toHaveBeenCalledWith('Address');
  });

  it('opens Edit Profile from the Personal Information section', async () => {
    const navigation = fakeNavigation();
    const { findByText } = renderProfile(fakeUser('shipper', { email: 'ram@example.com' }), navigation);

    fireEvent.press(await findByText('Edit'));

    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');
  });

  it('opens Settings from the profile header', async () => {
    const navigation = fakeNavigation();
    const { findByText } = renderProfile(fakeUser('owner'), navigation);

    fireEvent.press(await findByText('Settings'));

    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });

  it('shows profile strength and opens the next missing step', async () => {
    const navigation = fakeNavigation();
    // Photo, verified email and approved identity done; phone and city missing.
    const user = fakeUser('shipper', { email: 'ram@example.com', emailVerified: true, avatarUrl: PHOTO_URL });
    const { findByText } = renderProfile(user, navigation);

    expect(await findByText('60%')).toBeTruthy();
    fireEvent.press(await findByText('Add your phone number'));

    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');
  });

  it('shows identity verification status and opens it', async () => {
    const navigation = fakeNavigation();
    const { findAllByText, findByLabelText } = renderProfile(fakeUser('driver', { kycStatus: 'pending' }), navigation);

    // The pill shows on the identity row and again in the profile-strength card.
    expect((await findAllByText('Under review')).length).toBeGreaterThan(0);
    fireEvent.press(await findByLabelText('Identity, Your documents are under review'));

    expect(navigation.navigate).toHaveBeenCalledWith('Kyc');
  });
});

describe('profile photo', () => {
  it('uploads a photo chosen from the photo menu and shows it', async () => {
    const user = fakeUser('shipper', { email: 'ram@example.com' });
    const asset = { uri: 'file:///me.jpg', mimeType: 'image/jpeg', fileSize: 200 * 1024 };
    pickImages.mockResolvedValue([asset]);
    uploadFiles.mockResolvedValue({ user: { ...user, avatarUrl: PHOTO_URL } });
    const { findByLabelText, findByText, store } = renderProfile(user);

    fireEvent.press(await findByLabelText('Add profile photo'));
    fireEvent.press(await findByText('Upload Photo'));

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith('/users/me/avatar', [asset], { field: 'avatar' }));
    expect(pickImages).toHaveBeenCalledWith({ max: 1, square: true });
    await waitFor(() => expect(store.getState().auth.user.avatarUrl).toBe(PHOTO_URL));
    expect(await findByLabelText('Change profile photo')).toBeTruthy();
  });

  it('takes a square selfie with the front camera', async () => {
    const user = fakeUser('owner');
    const selfie = { uri: 'blob:selfie', mimeType: 'image/jpeg', fileSize: 150 * 1024 };
    takePhoto.mockResolvedValue([selfie]);
    uploadFiles.mockResolvedValue({ user: { ...user, avatarUrl: PHOTO_URL } });
    const { findByLabelText, findByText } = renderProfile(user);

    fireEvent.press(await findByLabelText('Add profile photo'));
    fireEvent.press(await findByText('Take Photo'));

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith('/users/me/avatar', [selfie], { field: 'avatar' }));
    expect(takePhoto).toHaveBeenCalledWith({ square: true, facing: 'user' });
    expect(pickImages).not.toHaveBeenCalled();
  });

  it('only offers Remove Photo once there is a photo', async () => {
    const { findByLabelText, findByText, queryByText } = renderProfile(fakeUser('shipper'));

    fireEvent.press(await findByLabelText('Add profile photo'));

    expect(await findByText('Upload Photo')).toBeTruthy();
    expect(queryByText('Remove Photo')).toBeNull();
  });

  it('refuses a photo over 5 MB without uploading it', async () => {
    pickImages.mockResolvedValue([{ uri: 'file:///big.jpg', fileSize: 6 * 1024 * 1024 }]);
    const { findByLabelText, findByText } = renderProfile(fakeUser('owner'));

    fireEvent.press(await findByLabelText('Add profile photo'));
    fireEvent.press(await findByText('Upload Photo'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Photo too large', expect.any(String)));
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('removes the photo after confirming', async () => {
    const user = fakeUser('driver', { avatarUrl: PHOTO_URL });
    api.delete.mockResolvedValue({ data: { user: { ...user, avatarUrl: null } } });
    const { findByLabelText, findByText, store } = renderProfile(user);

    fireEvent.press(await findByLabelText('Change profile photo'));
    fireEvent.press(await findByText('Remove Photo'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/me/avatar'));
    await waitFor(() => expect(store.getState().auth.user.avatarUrl).toBeNull());
  });
});
