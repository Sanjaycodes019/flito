import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import AddressScreen from '../src/screens/AddressScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../src/services/locations', () => ({
  fetchLocations: jest.fn(),
  detectLocation: jest.fn(),
}));

const api = require('../src/services/api').default;
const { fetchLocations, detectLocation } = require('../src/services/locations');
const { notify } = require('../src/utils/alert');

// A small slice of Nepal's lists, enough to walk the pickers.
const TREE = {
  provinces: [
    { id: 'NP03', name: 'Bagmati Province' },
    { id: 'NP01', name: 'Koshi Province' },
  ],
  districts: [
    { id: 'NP0327', provinceId: 'NP03', name: 'Kathmandu', aliases: [] },
    { id: 'NP0325', provinceId: 'NP03', name: 'Lalitpur', aliases: [] },
    { id: 'NP0105', provinceId: 'NP01', name: 'Morang', aliases: [] },
  ],
  localLevels: [
    { id: 'NP0327101', districtId: 'NP0327', name: 'Kathmandu', category: 'Metropolitan City', wards: 32, aliases: [] },
    { id: 'NP0327303', districtId: 'NP0327', name: 'Budhanilkhantha', category: 'Municipality', wards: 13, aliases: ['Budhalikantha'] },
    { id: 'NP0105101', districtId: 'NP0105', name: 'Biratnagar', category: 'Metropolitan City', wards: 19, aliases: [] },
  ],
};

const renderAddress = (user = fakeUser('shipper'), navigation = fakeNavigation()) => ({
  navigation,
  ...renderWithProviders(<AddressScreen navigation={navigation} />, { user }),
});

// Opens a picker by its label and chooses an option in its dialog.
const pick = async (screen, fieldLabel, optionLabel) => {
  fireEvent.press(await screen.findByLabelText(fieldLabel));
  fireEvent.press(await screen.findByLabelText(optionLabel));
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchLocations.mockResolvedValue(TREE);
  api.patch.mockImplementation(async (url, body) => ({
    data: { user: fakeUser('shipper', { address: { ...body.address, formatted: 'Saved address' } }) },
  }));
});

describe('choosing an address', () => {
  it('picks province, district, municipality and ward, takes the tole, and saves', async () => {
    const screen = renderAddress();

    await pick(screen, 'Province', 'Bagmati Province');
    await pick(screen, 'District', 'Kathmandu');
    await pick(screen, 'Municipality', 'Kathmandu');
    await pick(screen, 'Ward Number', 'Ward 20');
    fireEvent.changeText(await screen.findByPlaceholderText('e.g. Basantapur'), '  Basantapur ');
    fireEvent.press(await screen.findByText('Save Address'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/me', {
      address: { provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', ward: 20, tole: 'Basantapur' },
    }));
    expect(notify).toHaveBeenCalledWith('Address saved', 'Saved address', expect.any(Function));
  });

  it('lists every district before a province is chosen, and fills in the province from the district', async () => {
    const screen = renderAddress();

    fireEvent.press(await screen.findByLabelText('District'));
    for (const name of ['Kathmandu', 'Lalitpur', 'Morang']) {
      expect(await screen.findByLabelText(name)).toBeTruthy();
    }
    // Each district names its province while they're all listed together.
    expect(screen.getByText('Koshi Province')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Morang'));

    expect(await screen.findByLabelText('Province, Koshi Province')).toBeTruthy();
    expect(screen.getByLabelText('District, Morang')).toBeTruthy();
  });

  it('keeps every district available after a province is chosen, with that province first', async () => {
    const screen = renderAddress();

    await pick(screen, 'Province', 'Koshi Province');
    fireEvent.press(await screen.findByLabelText('District'));

    await screen.findByLabelText('Morang');
    const districtNames = new Set(['Kathmandu', 'Lalitpur', 'Morang']);
    const listed = screen.getAllByRole('button')
      .map((button) => button.props.accessibilityLabel)
      .filter((label) => districtNames.has(label));
    expect(listed).toEqual(['Morang', 'Kathmandu', 'Lalitpur']);

    // A district in another province switches the province to match.
    fireEvent.press(screen.getByLabelText('Kathmandu'));
    expect(await screen.findByLabelText('Province, Bagmati Province')).toBeTruthy();
    expect(screen.getByLabelText('District, Kathmandu')).toBeTruthy();
  });

  it('only offers municipalities in the chosen district', async () => {
    const screen = renderAddress();

    await pick(screen, 'District', 'Morang');
    fireEvent.press(await screen.findByLabelText('Municipality'));

    expect(await screen.findByLabelText('Biratnagar')).toBeTruthy();
    expect(screen.queryByLabelText('Kathmandu')).toBeNull();
  });

  it('says what is missing instead of saving an incomplete address', async () => {
    const screen = renderAddress();

    fireEvent.press(await screen.findByText('Save Address'));

    expect(await screen.findByText('Choose your province')).toBeTruthy();
    expect(screen.getByText('Choose your ward')).toBeTruthy();
    expect(screen.getByText('Enter your tole, village or area')).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
  });
});

describe('using the current location', () => {
  beforeEach(() => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 27.7045, longitude: 85.3076, accuracy: 18 } });
  });

  it('fills province, district, municipality and tole, and leaves the ward to the user', async () => {
    detectLocation.mockResolvedValue({
      inNepal: true,
      provinceId: 'NP03',
      districtId: 'NP0327',
      localLevelId: 'NP0327101',
      protectedArea: null,
      areaName: 'Basantapur',
      areaSource: 'OpenStreetMap',
    });
    const screen = renderAddress();

    fireEvent.press(await screen.findByText('Use Current Location'));

    expect(await screen.findByText('Filled in from your location')).toBeTruthy();
    expect(detectLocation).toHaveBeenCalledWith({ lat: 27.7045, lng: 85.3076 });
    expect(screen.getByText(/Accurate to about 18 m/)).toBeTruthy();
    expect(screen.getByLabelText('Province, Bagmati Province')).toBeTruthy();
    expect(screen.getByLabelText('District, Kathmandu')).toBeTruthy();
    expect(screen.getByLabelText('Municipality, Kathmandu')).toBeTruthy();
    expect(screen.getByDisplayValue('Basantapur')).toBeTruthy();
    expect(screen.getByText(/Suggested from OpenStreetMap/)).toBeTruthy();

    // The ward is still the user's to choose.
    fireEvent.press(screen.getByText('Save Address'));
    expect(await screen.findByText('Choose your ward')).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();

    await pick(screen, 'Ward Number', 'Ward 20');
    fireEvent.press(screen.getByText('Save Address'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/me', {
      address: {
        provinceId: 'NP03',
        districtId: 'NP0327',
        localLevelId: 'NP0327101',
        ward: 20,
        tole: 'Basantapur',
        coordinates: { lat: 27.7045, lng: 85.3076 },
      },
    }));
  });

  it('warns when the location is rough', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 27.7, longitude: 85.3, accuracy: 450 } });
    detectLocation.mockResolvedValue({ inNepal: true, provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', protectedArea: null, areaName: null });
    const screen = renderAddress();

    fireEvent.press(await screen.findByText('Use Current Location'));

    expect(await screen.findByText(/check each field carefully/)).toBeTruthy();
  });

  it('asks for a municipality when the point is inside a national park', async () => {
    detectLocation.mockResolvedValue({ inNepal: true, provinceId: 'NP03', districtId: 'NP0327', localLevelId: null, protectedArea: 'Chitawan', areaName: null });
    const screen = renderAddress();

    fireEvent.press(await screen.findByText('Use Current Location'));

    expect(await screen.findByText(/inside Chitawan/)).toBeTruthy();
    expect(screen.getByLabelText('Municipality')).toBeTruthy();
  });

  it('says so when the location is outside Nepal', async () => {
    detectLocation.mockResolvedValue({ inNepal: false });
    const screen = renderAddress();

    fireEvent.press(await screen.findByText('Use Current Location'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Outside Nepal', expect.any(String)));
  });

  it('explains when location access is refused', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    const screen = renderAddress();

    fireEvent.press(await screen.findByText('Use Current Location'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Could not use your location', expect.stringContaining('Allow location access')));
    expect(detectLocation).not.toHaveBeenCalled();
  });
});
