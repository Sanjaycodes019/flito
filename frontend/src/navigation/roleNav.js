// What each role can move between, as data. The laptop sidebar and the phone's
// bottom bar are both generated from this, so a new page for a role is one row.
//
//   key       stable id
//   route     screen in the Home stack that the item opens
//   match     other screens that still count as "being on" this item (a load's
//             detail page belongs to Loads)
//   icon      key of theme/icons
//   labelKey  translation key
//   cta       shown as the main action: a raised button in the bar, a button at
//             the top of the sidebar (not a list row)
//
// Admins have their own list in admin/sections.js.
const HOME = { key: 'home', route: 'Home', icon: 'home', labelKey: 'navigation:tabs.home' };
const LOADS = {
  key: 'loads',
  route: 'LoadsList',
  match: ['LoadDetail', 'TruckMatches'],
  icon: 'load',
  labelKey: 'navigation:homeStack.loadsList',
};
const BOOKINGS = {
  key: 'bookings',
  route: 'Bookings',
  match: ['BookingDetail'],
  icon: 'truckDelivery',
  labelKey: 'navigation:homeStack.bookings',
};

export const ROLE_NAV = {
  shipper: [
    HOME,
    LOADS,
    { key: 'post', route: 'CreateLoad', icon: 'add', labelKey: 'navigation:homeStack.createLoad', cta: true },
    BOOKINGS,
  ],
  owner: [
    HOME,
    LOADS,
    { key: 'offers', route: 'MyQuotes', icon: 'quote', labelKey: 'navigation:homeStack.myQuotes' },
    BOOKINGS,
    { key: 'fleet', route: 'Fleet', icon: 'truck', labelKey: 'navigation:homeStack.fleet' },
  ],
  driver: [
    HOME,
    { key: 'jobs', route: 'Jobs', match: ['BookingDetail'], icon: 'jobs', labelKey: 'navigation:homeStack.jobs' },
    { key: 'earnings', route: 'Earnings', icon: 'earnings', labelKey: 'navigation:homeStack.earnings' },
  ],
};

export const isItemActive = (item, routeName) => routeName === item.route || (item.match || []).includes(routeName);
