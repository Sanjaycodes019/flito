import api from './api';
import { uploadFiles } from './uploads';

// An owner's bank accounts and wallets, and the payments on a booking. Each
// call returns the server's fresh list, so a screen can just show it.

export const listPayoutMethods = async () => (await api.get('/users/me/payout-methods')).data.payoutMethods;

// `qr` is a picked image asset, or nothing.
export const savePayoutMethod = async (id, fields, qr) => {
  const path = id ? `/users/me/payout-methods/${id}` : '/users/me/payout-methods';
  const data = await uploadFiles(path, qr ? [qr] : [], { field: 'qr', fields, method: id ? 'patch' : 'post' });
  return data.payoutMethods;
};

export const makePrimaryPayoutMethod = async (id) => (await api.post(`/users/me/payout-methods/${id}/primary`)).data.payoutMethods;

export const deletePayoutMethod = async (id) => (await api.delete(`/users/me/payout-methods/${id}`)).data.payoutMethods;

export const getBookingPayments = async (bookingId) => (await api.get(`/bookings/${bookingId}/payments`)).data;

// `proof` is a picked screenshot, or nothing.
export const recordBookingPayment = (bookingId, fields, proof) => uploadFiles(
  `/bookings/${bookingId}/payments`,
  proof ? [proof] : [],
  { field: 'proof', fields },
);

export const confirmBookingPayment = async (bookingId, paymentId) => (
  await api.post(`/bookings/${bookingId}/payments/${paymentId}/confirm`)
).data;

export const disputeBookingPayment = async (bookingId, paymentId, reason) => (
  await api.post(`/bookings/${bookingId}/payments/${paymentId}/dispute`, { reason })
).data;
