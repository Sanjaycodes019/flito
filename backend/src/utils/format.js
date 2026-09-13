// Shared formatting for text the user reads directly (push notification
// bodies today) — kept out of the controllers so the wording is consistent
// wherever a price gets mentioned.
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

module.exports = { formatCurrency };
