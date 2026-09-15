import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import TruckMatchesScreen from '../src/screens/shipper/TruckMatchesScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';
import { nepalDay } from '../src/utils/nepalDate';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = require('../src/services/api').default;
const { notify } = require('../src/utils/alert');

const LOAD_ID = 'load-1';

const match = (overrides = {}) => ({
  truck: {
    _id: 'truck-a',
    verified: true,
    truckType: '6-wheeler',
    bodyType: 'covered',
    capacity: 10000,
    makeModel: 'Tata 1613',
    year: 2019,
    base: 'Kathmandu',
    insurance: 'comprehensive',
    features: { tarpaulin: true, helper: true },
    cargoBed: { lengthFt: 19, widthFt: 7.5, heightFt: 7 },
  },
  owner: { _id: 'owner-a', name: 'Thapa Transport', verified: true, rating: 4.8, totalRatings: 12, completedTrips: 20 },
  distanceToPickupKm: 1,
  fillPercent: 60,
  askingPrice: 16000,
  driverReady: true,
  score: 88,
  reasons: ['Fills 60% of the truck', 'Based near the pickup'],
  offer: null,
  ...overrides,
});

const MATCHES = [
  match(),
  match({
    truck: { _id: 'truck-b', truckType: '6-ton', capacity: 6500, makeModel: null, base: 'Lalitpur' },
    owner: { _id: 'owner-b', name: 'Gurung Logistics', rating: 0, totalRatings: 0, completedTrips: 0 },
    distanceToPickupKm: 12,
    fillPercent: 92,
    askingPrice: 14000,
    driverReady: false,
    score: 72,
    reasons: ['Lowest asking price'],
  }),
  match({
    truck: { _id: 'truck-c', truckType: '14-ton', capacity: 14000, makeModel: null, base: null },
    owner: { _id: 'owner-c', name: 'Sharma Movers', rating: 4.9, totalRatings: 40, completedTrips: 60 },
    distanceToPickupKm: null,
    fillPercent: 43,
    askingPrice: null,
    driverReady: false,
    score: 60,
    reasons: [],
  }),
];

const response = (overrides = {}) => ({
  load: {
    _id: LOAD_ID,
    goodsType: 'Cement bags',
    weight: 6000,
    status: 'open',
    pickupDay: nepalDay(),
    distanceKm: 200,
    pickupLocation: { label: 'Balaju, Kathmandu' },
    dropoffLocation: { label: 'Lakeside, Pokhara' },
  },
  takingOffers: true,
  matches: MATCHES,
  openRequests: 0,
  maxOpenRequests: 3,
  ...overrides,
});

const renderMatches = (data = response(), navigation = fakeNavigation()) => {
  api.get.mockResolvedValue({ data });
  return {
    navigation,
    ...renderWithProviders(
      <TruckMatchesScreen route={{ params: { loadId: LOAD_ID } }} navigation={navigation} />,
      { user: fakeUser('shipper') },
    ),
  };
};

const ownersInOrder = (screen) => screen
  .getAllByText(/^(Thapa Transport|Gurung Logistics|Sharma Movers)$/)
  .map((node) => node.props.children);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('choosing a truck', () => {
  it('lists the trucks that can carry the load, best match first, with why each suits it', async () => {
    const screen = renderMatches();

    expect(await screen.findByText('3 trucks can carry this load')).toBeTruthy();
    expect(ownersInOrder(screen)).toEqual(['Thapa Transport', 'Gurung Logistics', 'Sharma Movers']);
    expect(screen.getByText('Best match')).toBeTruthy();
    expect(screen.getByText('Rs. 16,000')).toBeTruthy();
    expect(screen.getByText('Fills 60% of the truck')).toBeTruthy();
    expect(screen.getByText('0 of 3 requests waiting')).toBeTruthy();

    // What the truck is and offers, from the owner's listing.
    expect(screen.getByText('Covered / Container · Tata 1613 · 2019 · carries 10,000 kg')).toBeTruthy();
    expect(screen.getByText('Comprehensive insurance')).toBeTruthy();
    expect(screen.getByText('Tarpaulin')).toBeTruthy();
    expect(screen.getByText('Helper')).toBeTruthy();
    expect(screen.getByText('Cargo bed 19 x 7.5 x 7 ft')).toBeTruthy();

    // The verified badge sits only on the truck and owner an admin verified.
    expect(screen.getAllByLabelText('Verified truck')).toHaveLength(1);
    expect(screen.getAllByLabelText('Verified owner')).toHaveLength(1);
  });

  it('re-sorts by price, distance and rating', async () => {
    const screen = renderMatches();
    await screen.findByText('3 trucks can carry this load');

    fireEvent.press(screen.getByText('Lowest Price'));
    expect(ownersInOrder(screen)).toEqual(['Gurung Logistics', 'Thapa Transport', 'Sharma Movers']);
    expect(screen.queryByText('Best match')).toBeNull();

    fireEvent.press(screen.getByText('Nearest'));
    expect(ownersInOrder(screen)).toEqual(['Thapa Transport', 'Gurung Logistics', 'Sharma Movers']);

    fireEvent.press(screen.getByText('Top Rated'));
    expect(ownersInOrder(screen)).toEqual(['Sharma Movers', 'Thapa Transport', 'Gurung Logistics']);
  });

  it('requests a truck at its asking price', async () => {
    api.post.mockResolvedValue({ data: {} });
    const screen = renderMatches();

    fireEvent.press(await screen.findByText('Request for Rs. 16,000'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/loads/load-1/requests', { truckId: 'truck-a', price: 16000 }));
    expect(notify).toHaveBeenCalledWith('Request sent', expect.stringContaining('Thapa Transport'));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("sends the shipper's own price from Make an Offer", async () => {
    api.post.mockResolvedValue({ data: {} });
    const screen = renderMatches();
    await screen.findByText('3 trucks can carry this load');

    // Sharma Movers has no listed rate.
    fireEvent.press(screen.getAllByText('Make an Offer')[2]);
    expect(screen.getByText("This owner hasn't listed a rate, so name the price you want to pay.")).toBeTruthy();

    fireEvent.press(screen.getByText('Send Offer'));
    expect(screen.getByText('Enter a whole number of rupees, at least Rs. 100')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Your Price (Rs.)'), '17500');
    fireEvent.press(screen.getByText('Send Offer'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/loads/load-1/requests', { truckId: 'truck-c', price: 17500 }));
  });

  it('shows a waiting request on its truck, and stops new requests at the limit', async () => {
    const screen = renderMatches(response({
      openRequests: 3,
      matches: [
        match({ offer: { _id: 'quote-1', status: 'pending', initiatedBy: 'shipper', price: 15000, by: 'shipper' } }),
        MATCHES[1],
      ],
    }));

    expect(await screen.findByText('Request sent for Rs. 15,000. Waiting for the owner.')).toBeTruthy();
    expect(screen.queryByText('Request for Rs. 14,000')).toBeNull();
    expect(screen.getByText(/You have 3 requests waiting/)).toBeTruthy();

    fireEvent.press(screen.getByText('View Offer'));
    expect(screen.navigation.navigate).toHaveBeenCalledWith('LoadDetail', { loadId: LOAD_ID });
  });

  it('explains when no truck is free, and links back to the load', async () => {
    const screen = renderMatches(response({ matches: [] }));

    expect(await screen.findByText('No trucks available yet')).toBeTruthy();
    fireEvent.press(screen.getByText('View Load'));
    expect(screen.navigation.navigate).toHaveBeenCalledWith('LoadDetail', { loadId: LOAD_ID });
  });
});
