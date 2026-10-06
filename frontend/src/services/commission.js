import api from './api';
import { uploadFiles } from './uploads';

// FLITO's fees: the owner's own account, and the admin's side of it.

export const getMyCommission = async () => (await api.get('/commission/me')).data;

// `proof` is a picked screenshot, or nothing.
export const recordCommissionPayment = (fields, proof) => uploadFiles(
  '/commission/me/payments',
  proof ? [proof] : [],
  { field: 'proof', fields },
);

export const getCommissionOverview = async () => (await api.get('/admin/commission/overview')).data;

export const confirmCommissionPayment = async (paymentId) => (
  await api.post(`/admin/commission/payments/${paymentId}/confirm`)
).data;

export const rejectCommissionPayment = async (paymentId, reason) => (
  await api.post(`/admin/commission/payments/${paymentId}/reject`, { reason })
).data;

// FLITO's own accounts, managed by admins, in the same shape as an owner's.
export const platformAccountsApi = {
  list: async () => (await api.get('/admin/commission/accounts')).data.payoutMethods,
  save: async (id, fields, qr) => (await uploadFiles(
    id ? `/admin/commission/accounts/${id}` : '/admin/commission/accounts',
    qr ? [qr] : [],
    { field: 'qr', fields, method: id ? 'patch' : 'post' },
  )).payoutMethods,
  makePrimary: async (id) => (await api.post(`/admin/commission/accounts/${id}/primary`)).data.payoutMethods,
  remove: async (id) => (await api.delete(`/admin/commission/accounts/${id}`)).data.payoutMethods,
};

// FLITO's fee on a fare, worked out on the server: { amount, reason }, where
// reason is 'welcome' or 'notStarted' when the trip would carry no fee.
export const getCommissionEstimate = async (fare) => (
  await api.get('/commission/estimate', { params: { fare } })
).data;
