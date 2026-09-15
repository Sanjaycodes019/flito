import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import KycScreen from '../src/screens/KycScreen';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../src/services/uploads', () => ({
  pickDocument: jest.fn(),
  uploadFiles: jest.fn(),
  pickImages: jest.fn(),
  uploadPhotos: jest.fn(),
  assetFromDataUrl: jest.fn(),
}));

const api = require('../src/services/api').default;
const { pickDocument, uploadFiles } = require('../src/services/uploads');
const { notify, confirmAction } = require('../src/utils/alert');

// A driver's requirements (citizenship front/back + license) exercise the
// "some required, none optional" shape; other tests adjust from this base.
const DRIVER_KYC = {
  status: 'not_submitted',
  canEdit: true,
  idType: 'citizenship',
  // What each identity choice keeps for a driver (their license stays in all).
  idTypeDocuments: {
    citizenship: ['citizenship_front', 'citizenship_back', 'driving_license'],
    nid: ['nid_front', 'nid_back', 'driving_license'],
    driving_license: ['driving_license'],
    passport: ['passport', 'driving_license'],
  },
  requiredDocuments: ['citizenship_front', 'citizenship_back', 'driving_license'],
  optionalDocuments: [],
  missingDocuments: ['citizenship_front', 'citizenship_back', 'driving_license'],
  documents: [],
};

const renderKyc = (kyc) => {
  api.get.mockResolvedValue({ data: { kyc } });
  return renderWithProviders(<KycScreen />, { user: fakeUser('driver') });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('KYC status banner', () => {
  it('shows the not-submitted state and required documents', async () => {
    const { findByText, getByText, getAllByText } = renderKyc(DRIVER_KYC);

    expect(await findByText('Verify your identity')).toBeTruthy();
    expect(getByText('Citizenship card (front)')).toBeTruthy();
    expect(getByText('Driving license')).toBeTruthy();
    // One "Required" tag per missing document.
    expect(getAllByText('Required')).toHaveLength(3);
  });

  it('shows the rejection reason and lets the user fix and resubmit', async () => {
    const { findByText, getByText, queryByText } = renderKyc({
      ...DRIVER_KYC,
      status: 'rejected',
      canEdit: true,
      rejectionReason: 'Photo is blurry',
      documents: [{ _id: 'd1', type: 'citizenship_front', url: 'https://x/1.png', format: 'png' }],
      missingDocuments: ['citizenship_back', 'driving_license'],
    });

    expect(await findByText('Changes needed')).toBeTruthy();
    expect(getByText('Reason: Photo is blurry')).toBeTruthy();
    expect(getByText('Resubmit for Review')).toBeTruthy();
    expect(queryByText('Submit for Review')).toBeNull();
  });

  it('hides upload controls once approved (nothing left to edit)', async () => {
    const { findByText, queryByText } = renderKyc({
      ...DRIVER_KYC,
      status: 'approved',
      canEdit: false,
      missingDocuments: [],
      documents: [
        { _id: 'd1', type: 'citizenship_front', url: 'https://x/1.png', format: 'png' },
        { _id: 'd2', type: 'citizenship_back', url: 'https://x/2.png', format: 'png' },
        { _id: 'd3', type: 'driving_license', url: 'https://x/3.png', format: 'png' },
      ],
    });

    expect(await findByText('Verified')).toBeTruthy();
    expect(queryByText('Upload')).toBeNull();
    expect(queryByText('Replace')).toBeNull();
    expect(queryByText('Submit for Review')).toBeNull();
  });
});

describe('choosing the identity document', () => {
  it('offers citizenship, NID, driving license and passport', async () => {
    const { findByText, getByText } = renderKyc(DRIVER_KYC);

    expect(await findByText('Identity document')).toBeTruthy();
    for (const label of ['Citizenship', 'National ID (NID)', 'Driving License', 'Passport']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('switches straight away when nothing uploaded would be removed', async () => {
    api.patch.mockResolvedValue({
      data: { kyc: { ...DRIVER_KYC, idType: 'passport', requiredDocuments: ['passport', 'driving_license'] } },
    });
    const { findByText } = renderKyc(DRIVER_KYC);

    fireEvent.press(await findByText('Passport'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/me/kyc/id-type', { idType: 'passport' }));
    expect(confirmAction).not.toHaveBeenCalled();
    expect(await findByText('Passport (photo page)')).toBeTruthy();
  });

  it('asks first when the switch would remove an uploaded document', async () => {
    api.patch.mockResolvedValue({ data: { kyc: { ...DRIVER_KYC, idType: 'nid' } } });
    const { findByText } = renderKyc({
      ...DRIVER_KYC,
      documents: [{ _id: 'd1', type: 'citizenship_front', url: 'https://x/1.png', format: 'png' }],
    });

    fireEvent.press(await findByText('National ID (NID)'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({
      destructive: true,
      message: expect.stringContaining('citizenship card (front)'),
    }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/me/kyc/id-type', { idType: 'nid' }));
  });

  it('shows the chosen document without options once submitted', async () => {
    const { findByText, queryByText } = renderKyc({ ...DRIVER_KYC, status: 'pending', canEdit: false, idType: 'passport' });

    expect(await findByText('Verifying with: Passport')).toBeTruthy();
    expect(queryByText('National ID (NID)')).toBeNull();
  });
});

describe('submit gating', () => {
  it('disables submit while documents are missing, and never calls the API for it', async () => {
    const { findByText } = renderKyc(DRIVER_KYC);
    const submit = await findByText('Submit for Review');

    fireEvent.press(submit);

    await waitFor(() => expect(api.post).not.toHaveBeenCalled());
  });

  it('enables submit once every required document is present, and submits', async () => {
    const complete = {
      ...DRIVER_KYC,
      missingDocuments: [],
      documents: [
        { _id: 'd1', type: 'citizenship_front', url: 'https://x/1.png', format: 'png' },
        { _id: 'd2', type: 'citizenship_back', url: 'https://x/2.png', format: 'png' },
        { _id: 'd3', type: 'driving_license', url: 'https://x/3.png', format: 'png' },
      ],
    };
    api.post.mockResolvedValue({ data: { kyc: { ...complete, status: 'pending' }, user: fakeUser('driver', { kycStatus: 'pending' }) } });
    const { findByText } = renderKyc(complete);

    fireEvent.press(await findByText('Submit for Review'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/me/kyc/submit'));
  });
});

describe('uploading a document', () => {
  it('uploads a picked document under the right type and refreshes the view', async () => {
    pickDocument.mockResolvedValue({ uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', size: 1000 });
    uploadFiles.mockResolvedValue({
      kyc: { ...DRIVER_KYC, documents: [{ _id: 'd1', type: 'citizenship_front', url: 'https://x/1.png', format: 'png' }] },
    });
    const { findAllByText, findByText, getAllByText } = renderKyc(DRIVER_KYC);

    // The first "Upload" button belongs to the first required document (citizenship_front).
    fireEvent.press((await findAllByText('Upload'))[0]);

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith(
      '/users/me/kyc/documents',
      [expect.objectContaining({ uri: 'file:///a.jpg' })],
      { field: 'document', fields: { type: 'citizenship_front' } },
    ));
    expect(await findByText('Uploaded')).toBeTruthy();
    expect(getAllByText('Replace').length).toBeGreaterThan(0);
  });

  it('refuses a file over the size limit without ever uploading it', async () => {
    pickDocument.mockResolvedValue({ uri: 'file:///big.jpg', size: 11 * 1024 * 1024 });
    const { findAllByText } = renderKyc(DRIVER_KYC);

    fireEvent.press((await findAllByText('Upload'))[0]);

    await waitFor(() => expect(notify).toHaveBeenCalledWith('File too large', expect.any(String)));
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    pickDocument.mockResolvedValue(null);
    const { findAllByText } = renderKyc(DRIVER_KYC);

    fireEvent.press((await findAllByText('Upload'))[0]);

    await waitFor(() => expect(pickDocument).toHaveBeenCalled());
    expect(uploadFiles).not.toHaveBeenCalled();
  });
});

describe('removing a document', () => {
  it('confirms, then deletes and refreshes from the response', async () => {
    api.delete.mockResolvedValue({ data: { kyc: { ...DRIVER_KYC, documents: [] } } });
    const withDoc = {
      ...DRIVER_KYC,
      documents: [{ _id: 'doc-1', type: 'citizenship_front', url: 'https://x/1.png', format: 'png' }],
    };
    const { findByText } = renderKyc(withDoc);

    fireEvent.press(await findByText('Remove'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/me/kyc/documents/doc-1'));
  });
});
