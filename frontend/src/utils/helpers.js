import { PHONE_REGEX } from './constants';

export const isValidPhone = (phone) => PHONE_REGEX.test(phone);

export const formatCurrency = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString('en-NP')}`;

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong';
