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
  status: 'quoted',
  pickupLocation: { address: 'Kathmandu' },
  dropoffLocation: { address: 'Pokhara' },
  createdAt: new Date().toISOString(),
  ...overrides,
});

const baseQuote = (overrides = {}) => ({
  _id: 'quote-1',
  loadId: LOAD_ID,
  ownerId: { firstName: 'Bikash', lastName: 'Thapa', companyName: '' },
  quotedPrice: 15000,
  status: 'pending',
  ...overrides,
});

// Routes each api.get call to the fixture that matches its path; each test
// supplies only the pieces its scenario actually needs.
const mockApi = ({ load, quotes = [], myQuotes = [] }) => {
  api.get.mockImplementation((url) => {
    if (url === `/loads/${LOAD_ID}`) return Promise.resolve({ data: { load } });
    if (url === `/loads/${LOAD_ID}/quotes`) return Promise.resolve({ data: { quotes } });
    if (url === '/quotes/mine') return Promise.resolve({ data: { quotes: myQuotes } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
};

const renderAs = (user, { load, quotes, myQuotes }, navigation = fakeNavigation()) => {
  mockApi({ load, quotes, myQuotes });
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

describe('shipper reviewing a quote', () => {
  it("shows accept/counter/reject for a pending quote (it's the shipper's turn)", async () => {
    const shipper = fakeUser('shipper');
    const { findByText, queryByText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    expect(await findByText('Bikash Thapa')).toBeTruthy();
    expect(await findByText('Rs. 15,000')).toBeTruthy();
    expect(await findByText('Accept')).toBeTruthy();
    expect(await findByText('Counter')).toBeTruthy();
    expect(await findByText('Reject')).toBeTruthy();
    expect(queryByText('Waiting for the other party to respond to your offer.')).toBeNull();
  });

  it('accepts a quote and navigates to the resulting booking', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: { booking: { _id: 'booking-99' } } });
    const { findByText, navigation } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    fireEvent.press(await findByText('Accept'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/quotes/quote-1/accept'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('BookingDetail', { bookingId: 'booking-99' }));
  });

  it('rejects a quote directly, no confirmation needed', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: {} });
    const { findByText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    fireEvent.press(await findByText('Reject'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/quotes/quote-1/reject'));
  });

  it('sends a counter-offer with the typed amount', async () => {
    const shipper = fakeUser('shipper');
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, getByPlaceholderText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });

    fireEvent.press(await findByText('Counter'));
    fireEvent.changeText(getByPlaceholderText('15000'), '13000');
    fireEvent.press(await findByText('Send'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/quotes/quote-1/counter', { counterOfferPrice: 13000 }));
  });

  it('refuses to send a counter-offer of zero', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, getByPlaceholderText } = renderAs(shipper, {
      load: baseLoad(),
      quotes: [baseQuote()],
    });
    const { notify } = require('../src/utils/alert');

    fireEvent.press(await findByText('Counter'));
    fireEvent.changeText(getByPlaceholderText('15000'), '0');
    fireEvent.press(await findByText('Send'));

    expect(notify).toHaveBeenCalledWith('Invalid price', expect.any(String));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("shows 'waiting' after the shipper counters, with no action buttons", async () => {
    const shipper = fakeUser('shipper');
    const { findByText, queryByText } = renderAs(shipper, {
      load: baseLoad({ status: 'negotiating' }),
      quotes: [baseQuote({ status: 'countered', counterOfferBy: 'shipper', counterOfferPrice: 13000 })],
    });

    expect(await findByText('Waiting for the other party to respond to your offer.')).toBeTruthy();
    expect(queryByText('Accept')).toBeNull();
    expect(queryByText('Counter')).toBeNull();
    expect(queryByText('Reject')).toBeNull();
  });

  it("shows accept/counter/reject again once the owner counters back", async () => {
    const shipper = fakeUser('shipper');
    const { findByText } = renderAs(shipper, {
      load: baseLoad({ status: 'negotiating' }),
      quotes: [baseQuote({ status: 'countered', counterOfferBy: 'owner', counterOfferPrice: 14000 })],
    });

    expect(await findByText('Rs. 14,000')).toBeTruthy();
    expect(await findByText('Accept')).toBeTruthy();
    expect(await findByText('Counter')).toBeTruthy();
  });

  it('offers Relist only once a load has expired', async () => {
    const shipper = fakeUser('shipper');
    const { findByText, queryByText } = renderAs(shipper, { load: baseLoad({ status: 'expired' }), quotes: [] });

    expect(await findByText('Relist Load')).toBeTruthy();
    expect(queryByText('Relist Load')).not.toBeNull();
  });
});

describe('owner responding to their own quote', () => {
  it('shows a quote form when no quote has been submitted yet', async () => {
    const owner = fakeUser('owner');
    const { findByText } = renderAs(owner, { load: baseLoad({ status: 'open' }), myQuotes: [] });

    expect(await findByText('Submit a Quote')).toBeTruthy();
  });

  it('submits a quote with the entered price and truck type', async () => {
    const owner = fakeUser('owner');
    api.post.mockResolvedValue({ data: {} });
    const { findByText, getByPlaceholderText } = renderAs(owner, { load: baseLoad({ status: 'open' }), myQuotes: [] });
    await findByText('Submit a Quote');

    fireEvent.changeText(getByPlaceholderText('e.g. 15000'), '12000');
    fireEvent.changeText(getByPlaceholderText('e.g. 10-ton'), '14-ton');
    fireEvent.press(await findByText('Submit Quote'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/quotes', {
      loadId: LOAD_ID, quotedPrice: 12000, truckType: '14-ton',
    }));
  });

  it('shows an unverified prompt instead of the quote form', async () => {
    const owner = fakeUser('owner', { kycStatus: 'not_submitted' });
    const { findByText, queryByText } = renderAs(owner, { load: baseLoad({ status: 'open' }), myQuotes: [] });

    expect(await findByText('Verify your identity to submit a quote on this load.')).toBeTruthy();
    expect(queryByText('Submit a Quote')).toBeNull();
  });

  it("shows 'waiting' for their own freshly-submitted quote (their own offer)", async () => {
    const owner = fakeUser('owner');
    const { findByText, queryByText } = renderAs(owner, {
      load: baseLoad({ status: 'quoted' }),
      myQuotes: [baseQuote({ status: 'pending' })],
    });

    expect(await findByText('Your Quote')).toBeTruthy();
    expect(await findByText('Waiting for the other party to respond to your offer.')).toBeTruthy();
    expect(queryByText('Accept')).toBeNull();
  });

  it('lets a verified owner accept/counter/reject when the shipper has countered them', async () => {
    const owner = fakeUser('owner', { kycStatus: 'approved' });
    const { findByText } = renderAs(owner, {
      load: baseLoad({ status: 'negotiating' }),
      myQuotes: [baseQuote({ status: 'countered', counterOfferBy: 'shipper', counterOfferPrice: 13000 })],
    });

    expect(await findByText('Accept')).toBeTruthy();
    expect(await findByText('Counter')).toBeTruthy();
    expect(await findByText('Reject')).toBeTruthy();
  });

  it('lets an unverified owner reject a countered quote, but not accept or counter it', async () => {
    const owner = fakeUser('owner', { kycStatus: 'rejected' });
    const { findByText, queryByText } = renderAs(owner, {
      load: baseLoad({ status: 'negotiating' }),
      myQuotes: [baseQuote({ status: 'countered', counterOfferBy: 'shipper', counterOfferPrice: 13000 })],
    });

    expect(await findByText('Verify your identity to accept or counter this offer. You can still reject it.')).toBeTruthy();
    expect(await findByText('Reject')).toBeTruthy();
    expect(queryByText('Accept')).toBeNull();
    expect(queryByText('Counter')).toBeNull();
  });
});
