import { PHONE_REGEX, EMAIL_REGEX } from './constants';

export const isValidPhone = (phone) => PHONE_REGEX.test(phone);
export const isValidEmail = (email) => typeof email === 'string' && EMAIL_REGEX.test(email);

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

// Enum values are snake_case on the wire ('picked_up', 'in_transit');
// render them as readable words.
export const formatStatus = (status) => (status || '').replace(/_/g, ' ');

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
