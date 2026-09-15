import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import CreateLoadScreen from '../src/screens/shipper/CreateLoadScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';
import { addDays, nepalDay } from '../src/utils/nepalDate';

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

const TREE = {
  provinces: [
    { id: 'NP03', name: 'Bagmati Province' },
    { id: 'NP04', name: 'Gandaki Province' },
  ],
  districts: [
    { id: 'NP0327', provinceId: 'NP03', name: 'Kathmandu', aliases: [] },
    { id: 'NP0439', provinceId: 'NP04', name: 'Kaski', aliases: [] },
  ],
  localLevels: [
    { id: 'NP0327101', districtId: 'NP0327', name: 'Kathmandu', category: 'Metropolitan City', wards: 32, aliases: [] },
    { id: 'NP0439101', districtId: 'NP0439', name: 'Pokhara', category: 'Metropolitan City', wards: 33, aliases: [] },
  ],
};

const renderForm = (user = fakeUser('shipper'), navigation = fakeNavigation()) => ({
  navigation,
  ...renderWithProviders(<CreateLoadScreen navigation={navigation} />, { user }),
});

const pick = async (screen, fieldLabel, optionLabel) => {
  fireEvent.press(await screen.findByLabelText(fieldLabel));
  fireEvent.press(await screen.findByLabelText(optionLabel));
};

const fillStop = async (screen, stop, { province, district, municipality, ward, tole }) => {
  await pick(screen, `${stop} province`, province);
  await pick(screen, `${stop} district`, district);
  await pick(screen, `${stop} municipality`, municipality);
  await pick(screen, `${stop} ward number`, ward);
  fireEvent.changeText(screen.getByLabelText(`${stop} tole, village or area`), tole);
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchLocations.mockResolvedValue(TREE);
  api.post.mockResolvedValue({ data: { load: { _id: 'load-1' } } });
});

describe('posting a load', () => {
  it('asks only for the essentials, with the extras folded away', async () => {
    const screen = renderForm();

    expect(await screen.findByLabelText('Goods Type')).toBeTruthy();
    expect(screen.getByLabelText('Weight (kg)')).toBeTruthy();
    expect(screen.getByLabelText('Pickup province')).toBeTruthy();
    expect(screen.getByLabelText('Dropoff province')).toBeTruthy();
    expect(screen.getByLabelText(/^Today, /)).toBeTruthy();

    // Contacts, the map, the description and photos wait behind their toggles.
    expect(screen.queryByLabelText('Pickup contact phone')).toBeNull();
    expect(screen.queryByLabelText('Description')).toBeNull();
    expect(screen.queryByTestId('webview')).toBeNull();

    fireEvent.press(screen.getByLabelText('Pickup contact and exact point'));
    expect(screen.getByLabelText('Pickup contact phone')).toBeTruthy();
    expect(screen.queryByTestId('webview')).toBeNull();

    fireEvent.press(screen.getByLabelText('Pickup point on map'));
    expect(screen.getAllByTestId('webview')).toHaveLength(1);
  });

  it('says what is still needed instead of posting', async () => {
    const screen = renderForm();

    fireEvent.press(await screen.findByText('Find Trucks'));

    expect(await screen.findByText('Still needed: goods type, weight, pickup address, dropoff address.')).toBeTruthy();
    expect(screen.getAllByText('Choose the province')).toHaveLength(2);
    expect(screen.getByText('Enter the weight in kg')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('posts the load for the chosen day and opens the trucks that can carry it', async () => {
    const screen = renderForm();

    fireEvent.changeText(await screen.findByLabelText('Goods Type'), 'Cement bags');
    fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '6000');
    await fillStop(screen, 'Pickup', { province: 'Bagmati Province', district: 'Kathmandu', municipality: 'Kathmandu', ward: 'Ward 16', tole: 'Balaju' });
    await fillStop(screen, 'Dropoff', { province: 'Gandaki Province', district: 'Kaski', municipality: 'Pokhara', ward: 'Ward 6', tole: 'Lakeside' });
    fireEvent.press(screen.getByLabelText(/^Tomorrow, /));

    // The summary follows along.
    expect(screen.getByText('Balaju, Kathmandu')).toBeTruthy();
    expect(screen.getByText('Lakeside, Pokhara')).toBeTruthy();

    fireEvent.press(screen.getByText('Find Trucks'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/loads', {
      goodsType: 'Cement bags',
      weight: 6000,
      pickupDate: addDays(nepalDay(), 1),
      pickupLocation: { provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', ward: 16, tole: 'Balaju' },
      dropoffLocation: { provinceId: 'NP04', districtId: 'NP0439', localLevelId: 'NP0439101', ward: 6, tole: 'Lakeside' },
    }));
    expect(screen.navigation.replace).toHaveBeenCalledWith('TruckMatches', { loadId: 'load-1' });
  });

  it('keeps the contact details open when the phone needs fixing', async () => {
    const screen = renderForm();

    fireEvent.press(await screen.findByLabelText('Dropoff contact and exact point'));
    fireEvent.changeText(screen.getByLabelText('Dropoff contact phone'), '98412');
    // Folded away again before trying to post.
    fireEvent.press(screen.getByLabelText('Dropoff contact and exact point'));
    fireEvent.press(screen.getByText('Find Trucks'));

    expect(await screen.findByText('Use a +977 number, e.g. +9779841234567')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('fills a stop from the current location and leaves the ward to the shipper', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 27.7045, longitude: 85.3076, accuracy: 18 } });
    detectLocation.mockResolvedValue({
      inNepal: true, provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', protectedArea: null, areaName: 'Basantapur',
    });
    const screen = renderForm();

    fireEvent.press(await screen.findByLabelText('Use current location for pickup'));

    expect(await screen.findByLabelText('Pickup municipality, Kathmandu')).toBeTruthy();
    expect(screen.getByDisplayValue('Basantapur')).toBeTruthy();
    expect(screen.getByLabelText('Pickup ward number')).toBeTruthy();
    expect(screen.getByText('Filled in from your location')).toBeTruthy();
    // The dropoff is untouched.
    expect(screen.getByLabelText('Dropoff province')).toBeTruthy();
  });

  it("uses the shipper's saved address for a stop", async () => {
    const user = fakeUser('shipper', {
      address: { provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', ward: 20, tole: 'Basantapur' },
    });
    const screen = renderForm(user);

    fireEvent.press(await screen.findByLabelText('Use my address for pickup'));

    expect(await screen.findByLabelText('Pickup ward number, Ward 20')).toBeTruthy();
    expect(screen.getByText('Basantapur, Kathmandu')).toBeTruthy();
  });
});
