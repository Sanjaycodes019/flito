import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import ManageFleet from '../src/screens/owner/ManageFleet';
import { renderWithProviders, fakeUser } from './testUtils';
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
const { fetchLocations } = require('../src/services/locations');

const TREE = {
  provinces: [{ id: 'NP03', name: 'Bagmati Province' }],
  districts: [{ id: 'NP0325', provinceId: 'NP03', name: 'Lalitpur', aliases: [] }],
  localLevels: [{ id: 'NP0325101', districtId: 'NP0325', name: 'Lalitpur', category: 'Metropolitan City', wards: 29, aliases: [] }],
};

const NEXT_YEAR = Number(nepalDay().slice(0, 4)) + 1;

const renderFleet = (trucks = []) => {
  api.get.mockResolvedValue({ data: { trucks } });
  return renderWithProviders(<ManageFleet />, { user: fakeUser('owner') });
};

const pick = async (screen, fieldLabel, optionLabel) => {
  fireEvent.press(await screen.findByLabelText(fieldLabel));
  fireEvent.press(await screen.findByLabelText(optionLabel));
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchLocations.mockResolvedValue(TREE);
  api.post.mockResolvedValue({ data: {} });
});

describe('my fleet', () => {
  it('adds a truck the way it is described in Nepal, papers included', async () => {
    const screen = renderFleet();

    fireEvent.press(await screen.findByText('Add Truck'));
    fireEvent.changeText(screen.getByLabelText('Registration Number'), 'BA 3 KHA 7788');

    // Picking a class fills in what it usually carries.
    fireEvent.press(screen.getByLabelText('6-Wheeler Truck'));
    expect(screen.getByDisplayValue('10000')).toBeTruthy();

    await pick(screen, 'Make', 'Tata');
    fireEvent.changeText(screen.getByLabelText('Model'), '1613');
    await pick(screen, 'Year of Manufacture', '2019');
    fireEvent.press(screen.getByLabelText('Covered / Container'));
    fireEvent.changeText(screen.getByLabelText('Length (ft)'), '19');

    await pick(screen, 'Base province', 'Bagmati Province');
    await pick(screen, 'Base district', 'Lalitpur');
    await pick(screen, 'Base municipality', 'Lalitpur');
    fireEvent.press(screen.getByLabelText('Within its province'));

    fireEvent.changeText(screen.getByLabelText('Rate per km (Rs.)'), '70');
    fireEvent.changeText(screen.getByLabelText('Minimum Charge (Rs.)'), '4000');
    fireEvent.press(screen.getByLabelText('Tarpaulin cover'));
    fireEvent.press(screen.getByLabelText('Helper (khalasi) comes along'));

    // Papers are folded away until opened.
    expect(screen.queryByLabelText('Chassis Number')).toBeNull();
    fireEvent.press(screen.getByLabelText('Papers'));
    fireEvent.press(screen.getByLabelText('Third-Party'));
    fireEvent.changeText(screen.getByLabelText('Insurance Company'), 'Shikhar Insurance');
    await pick(screen, 'Insurance valid until, day', '15');
    await pick(screen, 'Insurance valid until, month', 'Mar');
    await pick(screen, 'Insurance valid until, year', String(NEXT_YEAR));

    fireEvent.press(screen.getByText('Add Truck'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/trucks', {
      registrationNumber: 'BA 3 KHA 7788',
      truckType: '6-wheeler',
      bodyType: 'covered',
      capacity: 10000,
      make: 'Tata',
      model: '1613',
      year: 2019,
      fuelType: 'diesel',
      cargoBed: { lengthFt: 19, widthFt: null, heightFt: null },
      features: { tarpaulin: true, helper: true, gpsTracker: false, hillRoads: false },
      baseLocation: { provinceId: 'NP03', districtId: 'NP0325', localLevelId: 'NP0325101' },
      serviceArea: 'province',
      ratePerKm: 70,
      minimumCharge: 4000,
      chassisNumber: null,
      engineNumber: null,
      bluebookRenewedUntil: null,
      insurance: { type: 'third-party', company: 'Shikhar Insurance', policyNumber: null, validUntil: `${NEXT_YEAR}-03-15` },
      emissionTestValidUntil: null,
    }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("won't add a truck without its capacity, or with a malformed chassis number", async () => {
    const screen = renderFleet();

    fireEvent.press(await screen.findByText('Add Truck'));
    fireEvent.changeText(screen.getByLabelText('Registration Number'), 'BA 3 KHA 7788');
    fireEvent.press(screen.getByLabelText('Other Vehicle'));
    fireEvent.press(screen.getByLabelText('Papers'));
    fireEvent.changeText(screen.getByLabelText('Chassis Number'), 'MAT#1');
    fireEvent.press(screen.getByText('Add Truck'));

    expect(await screen.findByText('Enter the most it carries, from 100 to 60,000 kg')).toBeTruthy();
    expect(screen.getByText('Letters and digits, as on the bluebook')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('asks for a base before limiting where a truck works', async () => {
    const screen = renderFleet();

    fireEvent.press(await screen.findByText('Add Truck'));
    fireEvent.changeText(screen.getByLabelText('Registration Number'), 'BA 3 KHA 7788');
    fireEvent.press(screen.getByLabelText('Within its district'));
    fireEvent.press(screen.getByText('Add Truck'));

    expect(await screen.findByText('Set a base to limit where the truck works')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows what a truck is missing and when its papers run out', async () => {
    const screen = renderFleet([
      {
        _id: 'truck-1',
        registrationNumber: 'BA 2 KHA 4567',
        truckType: '10-ton',
        bodyType: 'open',
        capacity: 10000,
        status: 'active',
        features: { tarpaulin: true, hillRoads: true },
        insurance: { type: 'comprehensive', validUntil: `${addDays(nepalDay(), 10)}T00:00:00.000Z` },
        bluebookRenewedUntil: `${addDays(nepalDay(), -3)}T00:00:00.000Z`,
      },
    ]);

    expect(await screen.findByText('BA 2 KHA 4567')).toBeTruthy();
    expect(screen.getByText('10-Ton Truck · Open Body · 10,000 kg')).toBeTruthy();
    expect(screen.getByText('Tarpaulin, Hill roads')).toBeTruthy();
    expect(screen.getByText('Insurance: ends in 10 days')).toBeTruthy();
    expect(screen.getByText('Bluebook tax: expired')).toBeTruthy();
    expect(screen.getByText('No rate: shippers make offers')).toBeTruthy();
  });
});
