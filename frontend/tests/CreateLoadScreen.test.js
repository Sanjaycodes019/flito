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

// Leaves the current step: "Next", or "Skip" on an optional step left empty.
const next = (screen) => {
  fireEvent.press(screen.queryByText('Next') || screen.getByText('Skip'));
};

// Answers the first two questions (goods, weight) and lands on the pickup step.
const toPickupStep = async (screen) => {
  fireEvent.changeText(await screen.findByLabelText('Goods Type'), 'Cement bags');
  next(screen);
  fireEvent.changeText(await screen.findByLabelText('Weight (kg)'), '6000');
  next(screen);
  await screen.findByText('Where should we pick it up?');
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchLocations.mockResolvedValue(TREE);
  api.post.mockResolvedValue({ data: { load: { _id: 'load-1' } } });
});

describe('posting a load', () => {
  it('asks one question at a time, with pictures to tap', async () => {
    const screen = renderForm();

    expect(await screen.findByText('What are you sending?')).toBeTruthy();
    expect(screen.getByText('Step 1 of 7')).toBeTruthy();
    expect(screen.getByLabelText('Cement / Bricks')).toBeTruthy();
    // Nothing from the later questions is on screen yet.
    expect(screen.queryByLabelText('Weight (kg)')).toBeNull();
    expect(screen.queryByLabelText('Pickup province')).toBeNull();

    // Tapping a picture answers it.
    fireEvent.press(screen.getByLabelText('Rice / Food'));
    expect(screen.getByDisplayValue('Rice / Food')).toBeTruthy();
    next(screen);

    expect(await screen.findByText('How heavy is it?')).toBeTruthy();
    expect(screen.getByText('Step 2 of 7')).toBeTruthy();
    fireEvent.press(screen.getByText('Back'));
    expect(await screen.findByText('What are you sending?')).toBeTruthy();
    // Going back keeps the answer.
    expect(screen.getByDisplayValue('Rice / Food')).toBeTruthy();
  });

  it('says what is missing instead of moving on', async () => {
    const screen = renderForm();

    await screen.findByText('What are you sending?');
    next(screen);

    expect(await screen.findByText('Enter what you are shipping')).toBeTruthy();
    expect(screen.getByText('Step 1 of 7')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Goods Type'), 'Cement bags');
    next(screen);
    await screen.findByText('How heavy is it?');
    next(screen);

    expect(await screen.findByText('Enter the weight in kg')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('will not leave an address step until it is complete', async () => {
    const screen = renderForm();

    await toPickupStep(screen);
    next(screen);

    expect(await screen.findByText('Choose the province')).toBeTruthy();
    expect(screen.getByText('Where should we pick it up?')).toBeTruthy();
  });

  it('posts the load for the chosen day and opens the trucks that can carry it', async () => {
    const screen = renderForm();

    await toPickupStep(screen);
    await fillStop(screen, 'Pickup', { province: 'Bagmati Province', district: 'Kathmandu', municipality: 'Kathmandu', ward: 'Ward 16', tole: 'Balaju' });
    next(screen);

    await screen.findByText('Where should it go?');
    await fillStop(screen, 'Dropoff', { province: 'Gandaki Province', district: 'Kaski', municipality: 'Pokhara', ward: 'Ward 6', tole: 'Lakeside' });
    next(screen);

    await screen.findByText('When should it be picked up?');
    fireEvent.press(screen.getByLabelText(/^Tomorrow, /));
    next(screen);

    // Photos and a note are optional, so this step can be skipped.
    await screen.findByText('Add a photo or note');
    next(screen);

    // The last step reads everything back.
    expect(await screen.findByText('Check and send')).toBeTruthy();
    expect(screen.getByText('Balaju, Kathmandu')).toBeTruthy();
    expect(screen.getByText('Lakeside, Pokhara')).toBeTruthy();
    expect(screen.getByText('Cement bags')).toBeTruthy();

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

    await toPickupStep(screen);
    await fillStop(screen, 'Pickup', { province: 'Bagmati Province', district: 'Kathmandu', municipality: 'Kathmandu', ward: 'Ward 16', tole: 'Balaju' });
    fireEvent.press(screen.getByLabelText('Pickup contact and exact point'));
    fireEvent.changeText(screen.getByLabelText('Pickup contact phone'), '98412');
    // Folded away again before moving on.
    fireEvent.press(screen.getByLabelText('Pickup contact and exact point'));
    next(screen);

    expect(await screen.findByText('Use a +977 number, e.g. +9779841234567')).toBeTruthy();
    expect(screen.getByText('Where should we pick it up?')).toBeTruthy();
  });

  it('fills a stop from the current location and leaves the ward to the shipper', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 27.7045, longitude: 85.3076, accuracy: 18 } });
    detectLocation.mockResolvedValue({
      inNepal: true, provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', protectedArea: null, areaName: 'Basantapur',
    });
    const screen = renderForm();

    await toPickupStep(screen);
    fireEvent.press(await screen.findByLabelText('Use current location for pickup'));

    expect(await screen.findByLabelText('Pickup municipality, Kathmandu')).toBeTruthy();
    expect(screen.getByDisplayValue('Basantapur')).toBeTruthy();
    expect(screen.getByLabelText('Pickup ward number')).toBeTruthy();
    expect(screen.getByText('Filled in from your location')).toBeTruthy();
  });

  it("uses the shipper's saved address for a stop", async () => {
    const user = fakeUser('shipper', {
      address: { provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', ward: 20, tole: 'Basantapur' },
    });
    const screen = renderForm(user);

    await toPickupStep(screen);
    fireEvent.press(await screen.findByLabelText('Use my address for pickup'));

    expect(await screen.findByLabelText('Pickup ward number, Ward 20')).toBeTruthy();
    expect(screen.getByDisplayValue('Basantapur')).toBeTruthy();
  });
});
