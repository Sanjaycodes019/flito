// Where an offer between a shipper and a truck owner stands. There is no
// bargaining: the side that didn't make the offer accepts or declines it.
// Offers from when counter-offers were allowed can still be "countered", so
// these read them too. Mirrors the server's services/negotiation.js.

export const OPEN_QUOTE_STATUSES = ['pending', 'countered'];

export const openingSide = (quote) => quote.initiatedBy || 'owner';

// The offer on the table: who made it and the price.
export const standingOffer = (quote) => (quote.status === 'countered'
  ? { by: quote.counterOfferBy, price: quote.counterOfferPrice }
  : { by: openingSide(quote), price: quote.quotedPrice });

// Every offer so far, oldest first.
export const offerHistory = (quote) => {
  if (quote.offers?.length) return quote.offers;
  const history = [{ by: openingSide(quote), price: quote.quotedPrice }];
  if (quote.counterOfferPrice != null) history.push({ by: quote.counterOfferBy, price: quote.counterOfferPrice });
  return history;
};

export const isOpenQuote = (quote) => OPEN_QUOTE_STATUSES.includes(quote.status);

// True when the offer on the table is waiting on `side`.
export const isTurnOf = (quote, side) => isOpenQuote(quote) && standingOffer(quote).by !== side;
