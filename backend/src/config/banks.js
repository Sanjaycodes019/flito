// Banks an owner can be paid into, by a short stable code. These are Nepal's
// commercial ("A" class) banks after the mergers up to 2024. Development
// banks, finance companies and cooperatives go under "other" with their name
// typed in. The frontend keeps the same codes, with each bank's colours, in
// src/utils/banks.js: change both together.
const BANKS = [
  { code: 'nabil', name: 'Nabil Bank' },
  { code: 'nimb', name: 'Nepal Investment Mega Bank' },
  { code: 'gibl', name: 'Global IME Bank' },
  { code: 'nicasia', name: 'NIC Asia Bank' },
  { code: 'himalayan', name: 'Himalayan Bank' },
  { code: 'everest', name: 'Everest Bank' },
  { code: 'sbi', name: 'Nepal SBI Bank' },
  { code: 'scb', name: 'Standard Chartered Bank Nepal' },
  { code: 'nbl', name: 'Nepal Bank' },
  { code: 'rbb', name: 'Rastriya Banijya Bank' },
  { code: 'adbl', name: 'Agricultural Development Bank' },
  { code: 'kumari', name: 'Kumari Bank' },
  { code: 'laxmisunrise', name: 'Laxmi Sunrise Bank' },
  { code: 'siddhartha', name: 'Siddhartha Bank' },
  { code: 'machhapuchchhre', name: 'Machhapuchchhre Bank' },
  { code: 'citizens', name: 'Citizens Bank International' },
  { code: 'prime', name: 'Prime Commercial Bank' },
  { code: 'nmb', name: 'NMB Bank' },
  { code: 'prabhu', name: 'Prabhu Bank' },
  { code: 'sanima', name: 'Sanima Bank' },
];

// The ways an owner can take payment, and the ways a payment can be made
// (the same, plus cash in hand).
const PAYOUT_KINDS = ['bank', 'esewa', 'khalti'];
const PAYMENT_METHODS = [...PAYOUT_KINDS, 'cash'];

const OTHER_BANK = 'other';
const BANK_CODES = [...BANKS.map((bank) => bank.code), OTHER_BANK];

const bankName = (code, typedName) => (
  code === OTHER_BANK ? typedName : BANKS.find((bank) => bank.code === code)?.name
) || typedName || null;

module.exports = { BANKS, BANK_CODES, OTHER_BANK, PAYOUT_KINDS, PAYMENT_METHODS, bankName };
