import UsersScreen from './screens/UsersScreen';
import LoadsScreen from './screens/LoadsScreen';
import BookingsScreen from './screens/BookingsScreen';
import KycScreen from './screens/KycScreen';
import TrucksScreen from './screens/TrucksScreen';
import CommissionScreen from './screens/CommissionScreen';
import UserDetailScreen from './screens/detail/UserDetailScreen';
import TruckDetailScreen from './screens/detail/TruckDetailScreen';
import BookingDetailScreen from './screens/detail/BookingDetailScreen';
import LoadDetailScreen from './screens/detail/LoadDetailScreen';
import { ADMIN_RECORDS } from './records';

// The admin area, as data. The sidebar, the phone chip row, the navigator's
// screens and the web addresses are all generated from this list.
//
// To add a section (e.g. disputes, payments):
//   1. write its screen in ./screens (a ResourceScreen is ~20 lines),
//   2. add a row here,
//   3. add its admin:nav.* and admin:pages.* strings,
//   4. add the API router in backend/src/routes/admin and mount it in index.js.
//
//   route     react-navigation screen name (must be unique app-wide)
//   path      web address
//   alsoAt    { route, path }: a second address that opens the same page (optional)
//   icon      key of theme/icons
//   badgeStat key of GET /admin/stats shown as a count on the nav item
//   record    which record page its cards open (a key of ADMIN_RECORDS)
export const ADMIN_SECTIONS = [
  { key: 'users', route: 'AdminUsers', path: 'admin/users', alsoAt: { route: 'AdminHome', path: 'admin' }, icon: 'people', labelKey: 'admin:nav.users', record: 'user', component: UsersScreen },
  { key: 'loads', route: 'AdminLoads', path: 'admin/loads', icon: 'load', labelKey: 'admin:nav.loads', record: 'load', component: LoadsScreen },
  { key: 'bookings', route: 'AdminBookings', path: 'admin/bookings', icon: 'truckDelivery', labelKey: 'admin:nav.bookings', record: 'booking', component: BookingsScreen },
  { key: 'kyc', route: 'AdminKyc', path: 'admin/kyc', icon: 'verified', labelKey: 'admin:nav.kyc', badgeStat: 'pendingKyc', record: 'user', component: KycScreen },
  { key: 'trucks', route: 'AdminTrucks', path: 'admin/trucks', icon: 'truck', labelKey: 'admin:nav.trucks', badgeStat: 'pendingTrucks', record: 'truck', component: TrucksScreen },
  { key: 'commission', route: 'AdminCommission', path: 'admin/fees', icon: 'receipt', labelKey: 'admin:nav.commission', badgeStat: 'pendingCommissionPayments', record: 'user', component: CommissionScreen },
];

// The screen of each record page (see records.js for its route and address).
export const ADMIN_RECORD_SCREENS = {
  user: UserDetailScreen,
  truck: TruckDetailScreen,
  booking: BookingDetailScreen,
  load: LoadDetailScreen,
};

// The section a screen belongs to, for marking it in the navigation: a list
// screen is its own section, a record page belongs to its record's.
export const sectionOfRoute = (routeName) => {
  const record = Object.values(ADMIN_RECORDS).find((entry) => entry.route === routeName);
  if (record) return record.section;
  return ADMIN_SECTIONS.find((section) => [section.route, section.alsoAt?.route].includes(routeName))?.key || null;
};
