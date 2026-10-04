// One page per record, each with its own web address so it can be bookmarked
// or shared. Kept apart from sections.js (which imports the screens) so the
// screens themselves can link to each other through openAdminRecord.
//
//   route     react-navigation screen name
//   path      web address, with the record id as `param`
//   section   the list it belongs to: the one the sidebar marks (a key of
//             ADMIN_SECTIONS), with that list's route and name for the
//             breadcrumb back to it
//   titleKey  the page title in the native header (phone, tablet)
export const ADMIN_RECORDS = {
  user: {
    route: 'AdminUser', path: 'admin/users/:userId', param: 'userId', titleKey: 'admin:detail.user.title',
    section: 'users', listRoute: 'AdminUsers', listLabelKey: 'admin:nav.users',
  },
  truck: {
    route: 'AdminTruck', path: 'admin/trucks/:truckId', param: 'truckId', titleKey: 'admin:detail.truck.title',
    section: 'trucks', listRoute: 'AdminTrucks', listLabelKey: 'admin:nav.trucks',
  },
  booking: {
    route: 'AdminBooking', path: 'admin/bookings/:bookingId', param: 'bookingId', titleKey: 'admin:detail.booking.title',
    section: 'bookings', listRoute: 'AdminBookings', listLabelKey: 'admin:nav.bookings',
  },
  load: {
    route: 'AdminLoad', path: 'admin/loads/:loadId', param: 'loadId', titleKey: 'admin:detail.load.title',
    section: 'loads', listRoute: 'AdminLoads', listLabelKey: 'admin:nav.loads',
  },
};

export const ADMIN_RECORD_ROUTES = Object.values(ADMIN_RECORDS).map((record) => record.route);

// Opens one record's page: openAdminRecord(navigation, 'user', id). Pushed,
// not navigated to, so going from one user to another (an owner to their
// driver) stacks the pages and Back returns to the first.
export const openAdminRecord = (navigation, kind, id) => {
  const record = ADMIN_RECORDS[kind];
  if (!record || !id) return;
  const params = { [record.param]: String(id) };
  if (typeof navigation.push === 'function') navigation.push(record.route, params);
  else navigation.navigate(record.route, params);
};
