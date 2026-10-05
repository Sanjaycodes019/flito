import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import PaymentSection from '../src/components/bookings/PaymentSection';
import PaymentMethodsScreen from '../src/screens/owner/PaymentMethodsScreen';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/payments', () => ({
  listPayoutMethods: jest.fn(),
  savePayoutMethod: jest.fn(),
  makePrimaryPayoutMethod: jest.fn(),
  deletePayoutMethod: jest.fn(),
  getBookingPayments: jest.fn(),
  recordBookingPayment: jest.fn(),
  confirmBookingPayment: jest.fn(),
  disputeBookingPayment: jest.fn(),
}));

const payments = require('../src/services/payments');

const NABIL = {
  _id: 'm1', kind: 'bank', bankCode: 'nabil', bankName: 'Nabil Bank', branch: 'Teku',
  accountNumber: '01234567890123', accountName: 'Bikash Transport', qrUrl: 'https://img/qr.png', primary: true,
};
const ESEWA = { _id: 'm2', kind: 'esewa', walletId: '9841234567', accountName: 'Bikash Thapa', qrUrl: null, primary: false };

const summary = (overrides = {}) => ({ total: 15000, paid: 0, awaitingConfirmation: 0, due: 15000, status: 'pending', ...overrides });

beforeEach(() => jest.clearAllMocks());

describe('payment on a booking', () => {
  it("shows the shipper the owner's accounts, ready to copy", async () => {
    payments.getBookingPayments.mockResolvedValue({ party: 'shipper', summary: summary(), payTo: [NABIL, ESEWA], payments: [] });
    const { findByText, getByText } = renderWithProviders(<PaymentSection bookingId="b1" ownerName="Bikash" />, { user: fakeUser('shipper') });

    expect(await findByText('Pay Bikash directly')).toBeTruthy();
    expect(getByText('Nabil Bank')).toBeTruthy();
    expect(getByText('0123 4567 8901 23')).toBeTruthy();
    expect(getByText('9841234567')).toBeTruthy();
  });

  it('records what the shipper paid and into which account', async () => {
    payments.getBookingPayments.mockResolvedValue({ party: 'shipper', summary: summary(), payTo: [NABIL], payments: [] });
    payments.recordBookingPayment.mockResolvedValue({
      party: 'shipper',
      summary: summary({ awaitingConfirmation: 5000 }),
      payTo: [NABIL],
      payments: [{ _id: 'p1', amount: 5000, method: 'bank', status: 'reported', recordedBy: 'shipper', paidTo: 'Nabil Bank •••• 0123', createdAt: new Date().toISOString() }],
    });
    const { findByText, getByLabelText, getByDisplayValue } = renderWithProviders(
      <PaymentSection bookingId="b1" ownerName="Bikash" />,
      { user: fakeUser('shipper') },
    );

    fireEvent.press(await findByText('I have paid'));
    fireEvent.changeText(getByDisplayValue('15000'), '5000');
    fireEvent.press(getByLabelText('Save payment'));

    await waitFor(() => expect(payments.recordBookingPayment).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ amount: 5000, method: 'bank', payoutMethodId: 'm1' }),
      null,
    ));
    expect(await findByText('Rs. 5,000 waiting for the owner to confirm')).toBeTruthy();
  });

  it('lets the owner confirm a reported payment', async () => {
    const reported = { _id: 'p1', amount: 5000, method: 'esewa', status: 'reported', recordedBy: 'shipper', paidTo: 'eSewa 9841234567', transactionId: 'ESW1', createdAt: new Date().toISOString() };
    payments.getBookingPayments.mockResolvedValue({ party: 'owner', summary: summary({ awaitingConfirmation: 5000 }), payTo: [ESEWA], payments: [reported] });
    payments.confirmBookingPayment.mockResolvedValue({
      party: 'owner', summary: summary({ paid: 5000, due: 10000, status: 'partial' }), payTo: [ESEWA], payments: [{ ...reported, status: 'completed' }],
    });
    const { findByText, getByLabelText } = renderWithProviders(<PaymentSection bookingId="b1" ownerName="Bikash" />, { user: fakeUser('owner') });

    expect(await findByText('Did this reach you?')).toBeTruthy();
    fireEvent.press(getByLabelText('Yes, received'));

    await waitFor(() => expect(payments.confirmBookingPayment).toHaveBeenCalledWith('b1', 'p1'));
    expect(await findByText('partly paid')).toBeTruthy();
  });

  it('asks an owner with no accounts to add one', async () => {
    payments.getBookingPayments.mockResolvedValue({ party: 'owner', summary: summary(), payTo: [], payments: [] });
    const { findByText } = renderWithProviders(<PaymentSection bookingId="b1" ownerName="Bikash" />, { user: fakeUser('owner') });

    expect(await findByText("Shippers can't see how to pay you")).toBeTruthy();
  });
});

describe('owner payment details page', () => {
  it('offers bank, eSewa and Khalti when nothing is added yet', async () => {
    payments.listPayoutMethods.mockResolvedValue([]);
    const { findByText, getByLabelText } = renderWithProviders(<PaymentMethodsScreen />, { user: fakeUser('owner') });

    expect(await findByText('How do you want to be paid?')).toBeTruthy();
    ['Bank account', 'eSewa', 'Khalti'].forEach((label) => expect(getByLabelText(label)).toBeTruthy());
  });

  it('adds an eSewa wallet, asking for the name first', async () => {
    const { TextInput } = require('react-native');
    const { notify } = require('../src/utils/alert');
    payments.listPayoutMethods.mockResolvedValue([]);
    payments.savePayoutMethod.mockResolvedValue([{ ...ESEWA, primary: true }]);
    const { findByLabelText, getByPlaceholderText, getByLabelText, findByText, UNSAFE_getAllByType } = renderWithProviders(
      <PaymentMethodsScreen />,
      { user: fakeUser('owner') },
    );

    fireEvent.press(await findByLabelText('eSewa'));
    fireEvent.changeText(getByPlaceholderText('98XXXXXXXX'), '9841234567');
    fireEvent.press(getByLabelText('Save'));
    expect(notify).toHaveBeenCalledWith('Something is missing', 'Add the account holder name');
    expect(payments.savePayoutMethod).not.toHaveBeenCalled();

    // The wallet number, then the name on it.
    const [, nameField] = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(nameField, 'Bikash Thapa');
    fireEvent.press(getByLabelText('Save'));

    await waitFor(() => expect(payments.savePayoutMethod).toHaveBeenCalledWith(
      undefined,
      { kind: 'esewa', walletId: '9841234567', accountName: 'Bikash Thapa' },
      null,
    ));
    expect(await findByText('Your accounts')).toBeTruthy();
  });

  it('shows saved accounts with the primary one marked', async () => {
    payments.listPayoutMethods.mockResolvedValue([NABIL, ESEWA]);
    const { findByText, getAllByText } = renderWithProviders(<PaymentMethodsScreen />, { user: fakeUser('owner') });

    expect(await findByText('Your accounts')).toBeTruthy();
    expect(getAllByText('Primary')).toHaveLength(1);
    expect(getAllByText('Make primary')).toHaveLength(1);
  });
});
