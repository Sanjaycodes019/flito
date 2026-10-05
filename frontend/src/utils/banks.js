// Nepal's commercial banks, by the same codes as backend/src/config/banks.js
// (change both together), with the short name people search by and each
// bank's brand colour (the stripe along the top of an account card). Their
// logos are in components/payments/BankLogo. "other" covers development
// banks, finance companies and cooperatives, with the name typed in.
export const BANKS = [
  { code: 'nabil', name: 'Nabil Bank', short: 'NABIL', color: '#00754A' },
  { code: 'nimb', name: 'Nepal Investment Mega Bank', short: 'NIMB', color: '#1C3F94' },
  { code: 'gibl', name: 'Global IME Bank', short: 'GIBL', color: '#C4161C' },
  { code: 'nicasia', name: 'NIC Asia Bank', short: 'NIC', color: '#E2231A' },
  { code: 'himalayan', name: 'Himalayan Bank', short: 'HBL', color: '#003C71' },
  { code: 'everest', name: 'Everest Bank', short: 'EBL', color: '#B5121B' },
  { code: 'sbi', name: 'Nepal SBI Bank', short: 'SBI', color: '#22409A' },
  { code: 'scb', name: 'Standard Chartered Bank Nepal', short: 'SC', color: '#0473EA' },
  { code: 'nbl', name: 'Nepal Bank', short: 'NBL', color: '#003F88' },
  { code: 'rbb', name: 'Rastriya Banijya Bank', short: 'RBB', color: '#00843D' },
  { code: 'adbl', name: 'Agricultural Development Bank', short: 'ADBL', color: '#2E7D32' },
  { code: 'kumari', name: 'Kumari Bank', short: 'KBL', color: '#9D1D27' },
  { code: 'laxmisunrise', name: 'Laxmi Sunrise Bank', short: 'LSL', color: '#6D1F5E' },
  { code: 'siddhartha', name: 'Siddhartha Bank', short: 'SBL', color: '#D2232A' },
  { code: 'machhapuchchhre', name: 'Machhapuchchhre Bank', short: 'MBL', color: '#0F4C81' },
  { code: 'citizens', name: 'Citizens Bank International', short: 'CZBIL', color: '#00965E' },
  { code: 'prime', name: 'Prime Commercial Bank', short: 'PCBL', color: '#1B3C8C' },
  { code: 'nmb', name: 'NMB Bank', short: 'NMB', color: '#E4572E' },
  { code: 'prabhu', name: 'Prabhu Bank', short: 'PRVU', color: '#BE1E2D' },
  { code: 'sanima', name: 'Sanima Bank', short: 'SANIMA', color: '#0D7A3E' },
];

export const OTHER_BANK = 'other';

// The two wallets, with their brand colours.
export const WALLETS = {
  esewa: { name: 'eSewa', short: 'eSewa', color: '#60BB46' },
  khalti: { name: 'Khalti', short: 'Khalti', color: '#DC0019' },
};

export const PAYOUT_KINDS = ['bank', 'esewa', 'khalti'];

export const bankByCode = (code) => BANKS.find((bank) => bank.code === code) || null;

// What a method is called: its bank, or eSewa / Khalti.
export const methodTitle = (method) => (method.kind === 'bank'
  ? method.bankName || bankByCode(method.bankCode)?.name || ''
  : WALLETS[method.kind]?.name || '');

// "0123 4567 8901 23": easier to read out and check against a bank app.
export const groupDigits = (value) => String(value || '').replace(/(.{4})(?=.)/g, '$1 ');
