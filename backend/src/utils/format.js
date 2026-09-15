// Shared formatting for text the user reads directly (push notification
// bodies and error messages), kept out of the controllers so the wording is
// consistent wherever a price or weight gets mentioned.
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

const formatKg = (kg) => `${Number(kg || 0).toLocaleString('en-IN')} kg`;

module.exports = { formatCurrency, formatKg };
