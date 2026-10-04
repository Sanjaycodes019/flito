import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import LoadDetailScreen from '../src/screens/LoadDetailScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = require('../src/services/api').default;

const LOAD_ID = 'load-1';
const baseLoad = (overrides = {}) => ({
  _id: LOAD_ID,
  shipperId: 'shipper-id', // matches fakeUser('shipper')._id, makes isMyLoad true
  goodsType: 'Cement bags',
  weight: 6000,
  status: 'quoted',
  pickupLocation: { address: 'Kathmandu' },
  dropoffLocation: { address: 'Pokhara' },
  createdAt: new Date().toISOString(),
  ...overrides,
});

// 30 tonnes on three trucks, one booked so far.
const multiLoad = (overrides = {}) => baseLoad({ weight: 30000, trucksNeeded: 3, trucksBooked: 1, ...overrides });

const baseQuote = (overrides = {}) => ({
  _id: 'quote-1',
  loadId: LOAD_ID,
  ownerId: { firstName: 'Bikash', lastName: 'Thapa', companyName: '' },
  quotedPrice: 15000,
  status: 'pending',
  ...overrides,
});

const SMALL_TRUCK = {
  _id: 'truck-small',
  truckType: 'mini-truck',
  capacity: 3000,
  registrationNumber: 'BA 1 KHA 1111',
  unavailableReason: 'Carries up to 3,000 kg, and this load is 6,000 kg',
  askingPrice: null,
};

const BIG_TRUCK = {
  _id: 'truck-1',
  truckType: '10-ton',
  capacity: 10000,
  registrationNumber: 'BA 2 KHA 4567',
  unavailableReason: null,
  askingPrice: 16000,
};

const truck = (n, overrides = {}) => ({ ...BIG_TRUCK, _id: `truck-${n}`, registrationNumber: `BA 2 KHA 45${n}0`, ...overrides });

// Routes each api.get call to the fixture that matches its path; each test
// supplies only the pieces its scenario actually needs.
const mockApi = ({ load, quotes = [], myQuotes = [], myTrucks = [] }) => {
  api.get.mockImplementation((url) => {
    if (url === `/loads/${LOAD_ID}`) return Promise.resolve({ data: { load } });
    if (url === `/loads/${LOAD_ID}/quotes`) return Promise.resolve({ data: { quotes } });
    if (url === `/loads/${LOAD_ID}/my-trucks`) return Promise.resolve({ data: { trucks: myTrucks } });
    if (url === '/quotes/mine') return Promise.resolve({ data: { quotes: myQuotes } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const renderAs = (user, fixtures, navigation = fakeNavigation()) => {
  mockApi(fixtures);
  return {
    navigation,
    ...renderWithProviders(
      <LoadDetailScreen route={{ params: { loadId: LOAD_ID } }} navigation={navigation} />,
      { user }
    ),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('shipper reviewing an offer', () => {
  it('shows accept and decline for a truck an owner offered, and no bargaining', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, queryByText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    expect(await findByText('Bikash Thapa')).toBeTruthy();
    expect(await findByText('Rs. 15,000')).toBeTruthy();
    expect(await findByText('Accept')).toBeTruthy();
    expect(await findByText('Decline')).toBeTruthy();
    expect(queryByText('Counter')).toBeNull();
    expect(queryByText('Waiting for the other party to respond to your offer.')).toBeNull();
  });

  it('accepts the truck on a one-truck load and goes to the booking', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: { booking: { _id: 'booking-99' }, load: { trucksNeeded: 1, trucksBooked: 1 } } });
    const { findByText, navigation } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    fireEvent.press(await findByText('Accept'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/quotes/quote-1/accept'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('BookingDetail', { bookingId: 'booking-99' }));
  });

  it('declines an offer directly, no confirmation needed', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: {} });
    const { findByText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    fireEvent.press(await findByText('Decline'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/quotes/quote-1/reject'));
  });

  it('keeps the earlier offers of a quote from when bargaining was allowed', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, getByText } = renderAs(shipper, {
      load: baseLoad({ status: 'negotiating' }),
      quotes: [baseQuote({
        status: 'countered',
        counterOfferBy: 'owner',
        counterOfferPrice: 14000,
        offers: [{ by: 'owner', price: 15000 }, { by: 'shipper', price: 12000 }, { by: 'owner', price: 14000 }],
      })],
    });

    expect(await findByText('Earlier offers')).toBeTruthy();
    expect(getByText('Rs. 12,000')).toBeTruthy();
    expect(getByText('Rs. 14,000')).toBeTruthy();
    expect(getByText('Accept')).toBeTruthy();
  });

  it('shows a truck request the shipper sent, and lets them withdraw it', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, getByText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote({
        initiatedBy: 'shipper',
        quotedPrice: 14000,
        truckId: { truckType: '10-ton', capacity: 10000, makeModel: 'Tata 1613' },
      })],
    });

    expect(await findByText('You requested this truck')).toBeTruthy();
    expect(getByText('10-Ton Truck · 10,000 kg · Tata 1613')).toBeTruthy();
    expect(getByText('Waiting for the other party to respond to your offer.')).toBeTruthy();

    fireEvent.press(getByText('Withdraw'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/quotes/quote-1/reject'));
  });

  it('offers Choose a Truck while the load takes offers', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, navigation } = renderAs(shipper, { load: baseLoad({ status: 'open' }), quotes: [] });

    fireEvent.press(await findByText('Choose a Truck'));
    expect(navigation.navigate).toHaveBeenCalledWith('TruckMatches', { loadId: LOAD_ID });
  });

  it('offers Relist only once a load has expired', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, queryByText } = renderAs(shipper, { load: baseLoad({ status: 'expired' }), quotes: [] });

    expect(await findByText('Relist Load')).toBeTruthy();
    expect(queryByText('Choose a Truck')).toBeNull();
  });
});

describe('a load that needs several trucks', () => {
  it('shows how many trucks are booked, and what each carries', async () => {
    const shipper = fakeUser('shipper');
    const { findByLabelText, getByText } = renderAs(shipper, { load: multiLoad(), quotes: [] });

    expect(await findByLabelText('1 of 3 trucks booked')).toBeTruthy();
    expect(getByText('3 trucks, 10,000 kg each')).toBeTruthy();
    expect(getByText('Choose Trucks')).toBeTruthy();
    expect(getByText('You need 2 more trucks. See the trucks that can carry a share, and send your price.')).toBeTruthy();
  });

  it('keeps the shipper on the load after accepting while trucks are still needed', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: { booking: { _id: 'booking-2' }, load: { trucksNeeded: 3, trucksBooked: 2 } } });
    const { findByText, navigation } = renderAs(shipper, { load: multiLoad(), quotes: [baseQuote()] });
    const { notify } = require('../src/utils/alert');

    fireEvent.press(await findByText('Accept'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Truck booked', '2 of 3 trucks booked. Keep choosing, or tap Enough Trucks.'));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('links each booked truck to its booking', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, navigation } = renderAs(shipper, {
      load: multiLoad(),
      quotes: [baseQuote({ status: 'accepted', booking: { _id: 'booking-1', status: 'confirmed' } })],
    });

    fireEvent.press(await findByText('Open Booking'));
    expect(navigation.navigate).toHaveBeenCalledWith('BookingDetail', { bookingId: 'booking-1' });
  });

  it('lets the shipper stop at the trucks they have, and no longer cancel the load', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, queryByText } = renderAs(shipper, { load: multiLoad(), quotes: [] });

    expect(queryByText('Cancel Load')).toBeNull();
    // The test setup confirms every confirmAction straight away.
    fireEvent.press(await findByText('Enough Trucks'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/loads/${LOAD_ID}/close`));
  });
});

describe('owner offering trucks and responding', () => {
  it('shows an offer form when no truck has been offered yet', async () => {
    const owner = fakeUser('owner');
    const { findByText } = renderAs(owner, { load: baseLoad({ status: 'open' }), myTrucks: [BIG_TRUCK] });

    expect(await findByText('Offer a Truck')).toBeTruthy();
  });

  it('offers the chosen truck, starting from its asking price', async () => {
    const owner = fakeUser('owner');
    api.post.mockResolvedValue({ data: {} });
    const { findByText, getByDisplayValue, getByText } = renderAs(owner, {
      load: baseLoad({ status: 'open' }),
      myTrucks: [SMALL_TRUCK, BIG_TRUCK],
    });

    // A truck too small for the load says why, and the one that fits is chosen.
    expect(await findByText('Carries up to 3,000 kg, and this load is 6,000 kg')).toBeTruthy();
    fireEvent.changeText(getByDisplayValue('16000'), '15500');
    fireEvent.press(getByText('Send Offer'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/quotes', {
      loadId: LOAD_ID, quotedPrice: 15500, truckIds: ['truck-1'],
    }));
  });

  it('lets an owner offer several trucks, up to the number still needed', async () => {
    const owner = fakeUser('owner');
    api.post.mockResolvedValue({ data: {} });
    const { findByText, getByLabelText, getByText } = renderAs(owner, {
      load: multiLoad(),
      myTrucks: [truck(1), truck(2), truck(3)],
    });

    expect(await findByText('Offer Your Trucks')).toBeTruthy();
    expect(getByText('Pick up to 2. Each truck carries 10,000 kg.')).toBeTruthy();
    fireEvent.press(getByLabelText('10-Ton Truck BA 2 KHA 4520'));

    // Two picked: the third can't be added, and the total shows.
    expect(getByLabelText('10-Ton Truck BA 2 KHA 4530').props.accessibilityState.disabled).toBe(true);
    expect(getByText('2 trucks × Rs. 16,000')).toBeTruthy();
    expect(getByText('Rs. 32,000')).toBeTruthy();
    fireEvent.press(getByText('Offer 2 Trucks'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/quotes', {
      loadId: LOAD_ID, quotedPrice: 16000, truckIds: ['truck-1', 'truck-2'],
    }));
  });

  it('points an owner with no suitable truck to their fleet', async () => {
    const owner = fakeUser('owner');
    const { findByText, getByText, navigation } = renderAs(owner, {
      load: baseLoad({ status: 'open' }),
      myTrucks: [SMALL_TRUCK],
    });

    expect(await findByText('None of your trucks can carry this load right now.')).toBeTruthy();
    fireEvent.press(getByText('Manage My Fleet'));
    expect(navigation.navigate).toHaveBeenCalledWith('Fleet');
  });

  it('shows an unverified prompt instead of the offer form', async () => {
    const owner = fakeUser('owner', { kycStatus: 'not_submitted' });
    const { findByText, queryByText } = renderAs(owner, { load: baseLoad({ status: 'open' }), myQuotes: [] });

    expect(await findByText('Verify your identity to offer your trucks for this load.')).toBeTruthy();
    expect(queryByText('Offer a Truck')).toBeNull();
  });

  it("shows 'waiting' for their own offer, and no form once the load's trucks are all offered", async () => {
    const owner = fakeUser('owner');
    const { findByText, queryByText } = renderAs(owner, {
      load: baseLoad({ status: 'quoted' }),
      myQuotes: [baseQuote({ status: 'pending' })],
    });

    expect(await findByText('Your Offer')).toBeTruthy();
    expect(await findByText('Waiting for the other party to respond to your offer.')).toBeTruthy();
    expect(queryByText('Accept')).toBeNull();
    expect(queryByText('Offer a Truck')).toBeNull();
  });

  it("lets the owner accept or decline a shipper's booking request", async () => {
    const owner = fakeUser('owner', { kycStatus: 'approved' });
    const { findByText, queryByText } = renderAs(owner, {
      load: baseLoad({ status: 'quoted' }),
      myQuotes: [baseQuote({ initiatedBy: 'shipper', status: 'pending', quotedPrice: 14000 })],
    });

    expect(await findByText('Booking Request')).toBeTruthy();
    expect(await findByText('A shipper asked for your truck')).toBeTruthy();
    expect(await findByText('Accept')).toBeTruthy();
    expect(await findByText('Decline')).toBeTruthy();
    expect(queryByText('Counter')).toBeNull();
  });

  it('lets an unverified owner decline a request, but not accept it', async () => {
    const owner = fakeUser('owner', { kycStatus: 'rejected' });
    const { findByText, queryByText } = renderAs(owner, {
      load: baseLoad({ status: 'quoted' }),
      myQuotes: [baseQuote({ initiatedBy: 'shipper', status: 'pending', quotedPrice: 14000 })],
    });

    expect(await findByText('Verify your identity to accept this offer. You can still decline it.')).toBeTruthy();
    expect(await findByText('Decline')).toBeTruthy();
    expect(queryByText('Accept')).toBeNull();
  });
});
