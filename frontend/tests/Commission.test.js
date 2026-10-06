import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import CommissionScreen from '../src/screens/owner/CommissionScreen';
import CommissionNotice from '../src/components/payments/CommissionNotice';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/commission', () => ({
  getMyCommission: jest.fn(),
  recordCommissionPayment: jest.fn(),
}));

const commission = require('../src/services/commission');

const RULES = {
  welcomeTrips: 5,
  dueDay: 15,
  blocksOffers: true,
  startsOn: '2000-01-01',
};

const FLITO_ESEWA = { _id: 'a1', kind: 'esewa', walletId: '9801111111', accountName: 'FLITO Pvt. Ltd.', qrUrl: null, primary: true };

const summary = (overrides = {}) => ({
  currentPeriod: '2083-06',
  periods: [
    { period: '2083-06', trips: 2, amount: 700, paid: 0, left: 700, dueDay: '2026-11-01', status: 'open' },
    { period: '2083-05', trips: 1, amount: 300, paid: 0, left: 300, dueDay: '2026-10-01', status: 'overdue' },
  ],
  charged: 1000,
  welcomeTripsLeft: 0,
  paid: 0,
  awaiting: 0,
  balance: 1000,
  payableNow: 300,
  overdue: 300,
  dueDay: '2026-10-01',
  maxPayment: 1000,
  blocked: true,
  ...overrides,
});

const account = (overrides = {}) => ({
  rules: RULES,
  summary: summary(overrides),
  charges: [{
    _id: 'c1', bookingId: 'b1', goodsType: 'Cement', from: 'Kathmandu', to: 'Pokhara', fare: 15000, percent: 2, amount: 300, completedDay: '2026-09-20', period: '2083-05',
  }],
  payments: [],
  payTo: [FLITO_ESEWA],
});

beforeEach(() => jest.clearAllMocks());

describe("an owner's FLITO fees", () => {
  it('says what is past due, how fees work and where to pay', async () => {
    commission.getMyCommission.mockResolvedValue(account());
    const { findByText, getByText, getAllByText, queryByText } = renderWithProviders(<CommissionScreen />, { user: fakeUser('owner') });

    expect(await findByText('Rs. 300 is past due')).toBeTruthy();
    expect(getByText('Your fee on each trip')).toBeTruthy();
    expect(queryByText(/%/)).toBeNull(); // the fee, never the rule behind it
    expect(getByText('9801111111')).toBeTruthy();
    expect(getByText('Bhadra 2083')).toBeTruthy();
    expect(getAllByText('past due').length).toBeGreaterThan(0);
    expect(getByText('Cement · Kathmandu → Pokhara')).toBeTruthy();
  });

  it("records a payment into FLITO's account", async () => {
    commission.getMyCommission.mockResolvedValue(account());
    commission.recordCommissionPayment.mockResolvedValue(account({ awaiting: 1000, maxPayment: 0, blocked: false }));
    const { findByText, getByLabelText } = renderWithProviders(<CommissionScreen />, { user: fakeUser('owner') });

    fireEvent.press(await findByText('I have paid FLITO'));
    fireEvent.press(getByLabelText('Save payment'));

    await waitFor(() => expect(commission.recordCommissionPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000, method: 'esewa', payoutMethodId: 'a1' }),
      null,
    ));
    expect(await findByText('Checking your payment')).toBeTruthy();
  });

  it('thanks an owner who owes nothing', async () => {
    commission.getMyCommission.mockResolvedValue(account({
      periods: [], charged: 0, balance: 0, payableNow: 0, overdue: 0, dueDay: null, maxPayment: 0, blocked: false,
    }));
    const { findByText, queryByText } = renderWithProviders(<CommissionScreen />, { user: fakeUser('owner') });

    expect(await findByText("You're all paid up")).toBeTruthy();
    expect(queryByText('I have paid FLITO')).toBeNull();
  });
});

describe('the reminder on Home', () => {
  it('warns about fees past due', () => {
    const { getByText } = renderWithProviders(<CommissionNotice fees={{ summary: summary(), rules: RULES }} onOpen={jest.fn()} />);
    expect(getByText('FLITO fees past due: Rs. 300')).toBeTruthy();
  });

  it('announces when fees will start', () => {
    const notYet = { summary: summary({ periods: [], balance: 0, payableNow: 0, overdue: 0 }), rules: { ...RULES, startsOn: '2099-01-01' } };
    const { getByText } = renderWithProviders(<CommissionNotice fees={notYet} onOpen={jest.fn()} />);
    expect(getByText(/FLITO fees start on/)).toBeTruthy();
  });

  it('says nothing when there is nothing to say', () => {
    const clear = { summary: summary({ periods: [], balance: 0, payableNow: 0, overdue: 0 }), rules: RULES };
    const { toJSON } = renderWithProviders(<CommissionNotice fees={clear} onOpen={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });
});
