import UsersScreen from './screens/UsersScreen';
import LoadsScreen from './screens/LoadsScreen';
import BookingsScreen from './screens/BookingsScreen';
import KycScreen from './screens/KycScreen';
import TrucksScreen from './screens/TrucksScreen';

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
export const ADMIN_SECTIONS = [
  { key: 'users', route: 'AdminUsers', path: 'admin/users', alsoAt: { route: 'AdminHome', path: 'admin' }, icon: 'people', labelKey: 'admin:nav.users', component: UsersScreen },
  { key: 'loads', route: 'AdminLoads', path: 'admin/loads', icon: 'load', labelKey: 'admin:nav.loads', component: LoadsScreen },
  { key: 'bookings', route: 'AdminBookings', path: 'admin/bookings', icon: 'truckDelivery', labelKey: 'admin:nav.bookings', component: BookingsScreen },
  { key: 'kyc', route: 'AdminKyc', path: 'admin/kyc', icon: 'verified', labelKey: 'admin:nav.kyc', badgeStat: 'pendingKyc', component: KycScreen },
  { key: 'trucks', route: 'AdminTrucks', path: 'admin/trucks', icon: 'truck', labelKey: 'admin:nav.trucks', badgeStat: 'pendingTrucks', component: TrucksScreen },
];
