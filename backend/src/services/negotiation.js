// An offer between a shipper and a truck owner. Either side can open: an owner
// applies to a load with a truck at a price, or a shipper requests a truck at
// a price. The other side then accepts or declines it at that price; there is
// no bargaining. Offers from when counter-offers were allowed can still be in
// the "countered" state, so this reads them too.

const openingSide = (quote) => quote.initiatedBy || 'owner';

// The offer on the table: who made it and the price.
const standingOffer = (quote) => (quote.status === 'countered'
  ? { by: quote.counterOfferBy, price: quote.counterOfferPrice }
  : { by: openingSide(quote), price: quote.quotedPrice });

module.exports = { standingOffer };
