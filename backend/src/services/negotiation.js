const { formatCurrency } = require('../utils/format');

// The rules of an offer between a shipper and a truck owner. Either side can
// open: an owner quotes on a load, or a shipper requests a truck at a price.
// They then take turns to accept, decline or counter. Offers only ever move
// toward each other, and a negotiation has a limited number of offers, so it
// ends in a decision instead of going round in circles.

// Offers in one negotiation, the opening one included (three each).
const MAX_OFFERS = 6;

// Requests a shipper can have waiting with owners at once for one load. Each
// asks an owner to hold a truck, so a shipper can't ask every truck at once.
const MAX_OPEN_REQUESTS_PER_LOAD = 3;

const openingSide = (quote) => quote.initiatedBy || 'owner';

// The offer on the table: who made it and the price.
const standingOffer = (quote) => (quote.status === 'countered'
  ? { by: quote.counterOfferBy, price: quote.counterOfferPrice }
  : { by: openingSide(quote), price: quote.quotedPrice });

// Every offer so far, oldest first. A quote from before the history was kept
// is rebuilt from its opening price and latest counter.
const offerHistory = (quote) => {
  if (quote.offers?.length) return quote.offers.map(({ by, price, at }) => ({ by, price, at }));
  const history = [{ by: openingSide(quote), price: quote.quotedPrice, at: quote.createdAt }];
  if (quote.counterOfferPrice != null) {
    history.push({ by: quote.counterOfferBy, price: quote.counterOfferPrice, at: quote.counterOfferedAt });
  }
  return history;
};

const lastOfferFrom = (quote, side) => [...offerHistory(quote)].reverse().find((offer) => offer.by === side) || null;

// Why `side` can't counter with `price`, or null when it can. The shipper is
// buying: a counter must be below the owner's price and above the shipper's
// own last offer. The owner is selling: above the shipper's offer and below
// the owner's own last price. Meeting the other side's price is an accept.
const counterProblem = (quote, side, price) => {
  if (offerHistory(quote).length >= MAX_OFFERS) {
    return `This negotiation has reached ${MAX_OFFERS} offers. Accept or decline the last one.`;
  }

  const standing = standingOffer(quote);
  const previous = lastOfferFrom(quote, side);

  if (side === 'shipper') {
    if (price >= standing.price) return `Offer less than ${formatCurrency(standing.price)}, or accept that price.`;
    if (previous && price <= previous.price) {
      return `Your last offer was ${formatCurrency(previous.price)}. A new offer has to be higher.`;
    }
  } else {
    if (price <= standing.price) return `Ask more than ${formatCurrency(standing.price)}, or accept that price.`;
    if (previous && price >= previous.price) {
      return `Your last price was ${formatCurrency(previous.price)}. A new price has to be lower.`;
    }
  }
  return null;
};

module.exports = {
  MAX_OFFERS,
  MAX_OPEN_REQUESTS_PER_LOAD,
  standingOffer,
  offerHistory,
  counterProblem,
};
