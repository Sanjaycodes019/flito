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
  takePhoto: jest.fn(),
  uploadFiles: jest.fn(),
  pickImages: jest.fn(),
  uploadPhotos: jest.fn(),
  assetFromDataUrl: jest.fn(),
}));

const api = require('../src/services/api').default;
const { pickDocument, takePhoto, uploadFiles } = require('../src/services/uploads');
const { notify, confirmAction } = require('../src/utils/alert');

const option = (idType, documents, complete = false) => ({ idType, documents, complete });
const CITIZENSHIP = option('citizenship', ['citizenship_front', 'citizenship_back']);
const NID = option('nid', ['nid_front', 'nid_back']);
const LICENSE = option('driving_license', ['driving_license']);
const PASSPORT = option('passport', ['passport']);

// A shipper needs one identity document and nothing else.
const SHIPPER_KYC = {
  status: 'not_submitted',
  canEdit: true,
  identity: { required: true, complete: false, options: [CITIZENSHIP, NID, LICENSE, PASSPORT] },
  requiredDocuments: [],
  optionalDocuments: [],
  missingDocuments: ['identity'],
  addressComplete: true,
  documents: [],
};

// A driver's license is required and is their identity document, so the other
// identity documents are all optional and the license isn't offered twice.
const DRIVER_KYC = {
  ...SHIPPER_KYC,
  identity: { required: false, complete: false, options: [CITIZENSHIP, NID, PASSPORT] },
  requiredDocuments: ['driving_license'],
  missingDocuments: ['driving_license'],
};

const doc = (id, type) => ({ _id: id, type, url: `https://x/${id}.png`, format: 'png' });

const renderKyc = (kyc, role = 'shipper') => {
  api.get.mockResolvedValue({ data: { kyc } });
  return renderWithProviders(<KycScreen />, { user: fakeUser(role) });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('identity document', () => {
  it('offers every identity document and says one is required', async () => {
    const { findByText, getByText, getByLabelText } = renderKyc(SHIPPER_KYC);

    expect(await findByText('Verify your identity')).toBeTruthy();
    expect(getByText('Identity Document')).toBeTruthy();
    expect(getByText('Required')).toBeTruthy();
    for (const label of ['Citizenship', 'National ID (NID)', 'Driving License', 'Passport']) {
      expect(getByLabelText(label)).toBeTruthy();
    }
    expect(getByText('Upload an identity document to submit.')).toBeTruthy();
  });

  it('opens a document and uploads its side under the right type', async () => {
    pickDocument.mockResolvedValue({ uri: 'file:///front.jpg', mimeType: 'image/jpeg', size: 1000 });
    uploadFiles.mockResolvedValue({ kyc: SHIPPER_KYC });
    const { findByLabelText, findByText, findAllByText, queryByText } = renderKyc(SHIPPER_KYC);

    expect(queryByText('Citizenship card (front)')).toBeNull();
    fireEvent.press(await findByLabelText('Citizenship'));
    expect(await findByText('Citizenship card (front)')).toBeTruthy();

    fireEvent.press((await findAllByText('Upload File'))[0]);

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith(
      '/users/me/kyc/documents',
      [expect.objectContaining({ uri: 'file:///front.jpg' })],
      { field: 'document', fields: { type: 'citizenship_front' } },
    ));
  });

  it('shows progress on a two-sided card', async () => {
    const { findByText } = renderKyc({
      ...SHIPPER_KYC,
      documents: [doc('d1', 'citizenship_front')],
    });

    expect(await findByText('1 of 2 uploaded')).toBeTruthy();
  });

  it('marks the other identity documents optional once one is complete, and allows submitting', async () => {
    const complete = {
      ...SHIPPER_KYC,
      identity: { required: true, complete: true, options: [CITIZENSHIP, NID, LICENSE, option('passport', ['passport'], true)] },
      missingDocuments: [],
      documents: [doc('d1', 'passport')],
    };
    api.post.mockResolvedValue({ data: { kyc: { ...complete, status: 'pending' }, user: fakeUser('shipper', { kycStatus: 'pending' }) } });
    const { findAllByText, getAllByText, findByText } = renderKyc(complete);

    expect((await findAllByText('Complete')).length).toBeGreaterThan(0);
    expect(getAllByText('Optional')).toHaveLength(3);

    fireEvent.press(await findByText('Submit for Review'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/me/kyc/submit'));
  });

  it('requires the license from a driver and makes citizenship, NID and passport optional', async () => {
    const { findByText, getByText, getAllByText, queryByLabelText, queryByText } = renderKyc(DRIVER_KYC, 'driver');

    expect(await findByText('Other Identity Documents')).toBeTruthy();
    expect(getByText(/Your driving license is your identity document/)).toBeTruthy();
    expect(getByText('Required Documents')).toBeTruthy();
    expect(getByText('Driving license')).toBeTruthy();
    // Only the license is marked Required; the section and its three documents are Optional.
    expect(getAllByText('Required')).toHaveLength(1);
    expect(getAllByText('Optional')).toHaveLength(4);
    expect(queryByLabelText('Driving License')).toBeNull();
    expect(queryByText(/an identity document/)).toBeNull();
    expect(getByText('Upload driving license to submit.')).toBeTruthy();
  });
});

describe('uploading a document', () => {
  it("photographs a driver's license with the camera", async () => {
    const photo = { uri: 'blob:photo', mimeType: 'image/jpeg', fileSize: 300 * 1024 };
    takePhoto.mockResolvedValue([photo]);
    uploadFiles.mockResolvedValue({ kyc: DRIVER_KYC });
    const { findAllByText } = renderKyc(DRIVER_KYC, 'driver');

    // Identity documents start closed, so the first Take Photo is the license's.
    fireEvent.press((await findAllByText('Take Photo'))[0]);

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith(
      '/users/me/kyc/documents',
      [photo],
      { field: 'document', fields: { type: 'driving_license' } },
    ));
    expect(pickDocument).not.toHaveBeenCalled();
  });

  it('refuses a file over the size limit without uploading it', async () => {
    pickDocument.mockResolvedValue({ uri: 'file:///big.jpg', size: 11 * 1024 * 1024 });
    const { findAllByText } = renderKyc(DRIVER_KYC, 'driver');

    fireEvent.press((await findAllByText('Upload File'))[0]);

    await waitFor(() => expect(notify).toHaveBeenCalledWith('File too large', expect.any(String)));
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    pickDocument.mockResolvedValue(null);
    const { findAllByText } = renderKyc(DRIVER_KYC, 'driver');

    fireEvent.press((await findAllByText('Upload File'))[0]);

    await waitFor(() => expect(pickDocument).toHaveBeenCalled());
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('confirms, then removes a document', async () => {
    api.delete.mockResolvedValue({ data: { kyc: DRIVER_KYC } });
    const { findByText } = renderKyc({ ...DRIVER_KYC, documents: [doc('doc-1', 'driving_license')] }, 'driver');

    fireEvent.press(await findByText('Remove'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/me/kyc/documents/doc-1'));
  });
});

describe('status and submitting', () => {
  it('asks for an address before submitting, even with every document uploaded', async () => {
    const { findByText, getByText } = renderKyc({
      ...SHIPPER_KYC,
      identity: { required: true, complete: true, options: [CITIZENSHIP, NID, LICENSE, option('passport', ['passport'], true)] },
      missingDocuments: [],
      addressComplete: false,
      documents: [doc('d1', 'passport')],
    });

    expect(await findByText('Add your address')).toBeTruthy();
    expect(getByText('Add Address')).toBeTruthy();
    expect(getByText('Add your address to submit.')).toBeTruthy();

    fireEvent.press(getByText('Submit for Review'));
    await waitFor(() => expect(api.post).not.toHaveBeenCalled());
  });

  it('keeps Submit disabled while something is missing', async () => {
    const { findByText } = renderKyc(SHIPPER_KYC);

    fireEvent.press(await findByText('Submit for Review'));

    await waitFor(() => expect(api.post).not.toHaveBeenCalled());
  });

  it('shows the rejection reason and offers a resubmit', async () => {
    const { findByText, getByText, queryByText } = renderKyc({
      ...SHIPPER_KYC,
      status: 'rejected',
      rejectionReason: 'Photo is blurry',
    });

    expect(await findByText('Changes needed')).toBeTruthy();
    expect(getByText('Reason: Photo is blurry')).toBeTruthy();
    expect(getByText('Resubmit for Review')).toBeTruthy();
    expect(queryByText('Submit for Review')).toBeNull();
  });

  it('once approved, shows only what was submitted and no controls', async () => {
    const { findByText, queryByText, getByLabelText, queryByLabelText } = renderKyc({
      ...SHIPPER_KYC,
      status: 'approved',
      canEdit: false,
      identity: { complete: true, options: [CITIZENSHIP, NID, LICENSE, option('passport', ['passport'], true)] },
      missingDocuments: [],
      documents: [doc('d1', 'passport')],
    });

    expect(await findByText('Verified')).toBeTruthy();
    expect(getByLabelText('Passport')).toBeTruthy();
    expect(queryByLabelText('Citizenship')).toBeNull();
    expect(queryByText('Upload File')).toBeNull();
    expect(queryByText('Take Photo')).toBeNull();
    expect(queryByText('Submit for Review')).toBeNull();
  });
});
