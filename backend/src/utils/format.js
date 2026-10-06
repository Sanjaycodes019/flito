// Shared formatting for text the user reads directly (push notification
// bodies and error messages), kept out of the controllers so the wording is
// consistent wherever a price or weight gets mentioned.
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

const formatKg = (kg) => `${Number(kg || 0).toLocaleString('en-IN')} kg`;

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const belowHundred = (n) => (n < 20 ? ONES[n] : [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join('-'));

const belowThousand = (n) => [
  n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '',
  n % 100 ? belowHundred(n % 100) : '',
].filter(Boolean).join(' ');

// A whole number in words the way Nepal counts: crore, lakh, thousand.
const wholeInWords = (n) => {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  return [
    crore ? `${wholeInWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    belowThousand(n % 1000),
  ].filter(Boolean).join(' ');
};

// "Nepalese Rupees Fifteen Thousand Two Hundred and Fifty Paisa Only", as an
// invoice states its total.
const amountInWords = (amount) => {
  const inPaisa = Math.round(Math.max(0, Number(amount) || 0) * 100);
  const rupees = Math.floor(inPaisa / 100);
  const paisa = inPaisa % 100;
  const paisaPart = paisa ? ` and ${belowHundred(paisa)} Paisa` : '';
  return `Nepalese Rupees ${wholeInWords(rupees)}${paisaPart} Only`;
};

module.exports = { formatCurrency, formatKg, amountInWords };
