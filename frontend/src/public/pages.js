// FLITO's information pages (about, help, legal) as data. The public navbar,
// the footer, the Settings rows and the web addresses are all generated from
// this list, so a new page is one row here plus its screen.
//
//   key       stable id, also the translation key under site:pages
//   route     screen name, the same signed in and signed out
//   path      web address, the same signed in and signed out, so a shared
//             /terms link opens the Terms whoever follows it
//   icon      key of theme/icons
//   nav       shown as a link in the public navbar
//
// Where they show:
//   web, signed out      a public site with its own navbar and footer, with the
//                        landing page at /
//   Android, signed out  linked from the foot of the log in pages, opened with
//                        a back arrow (the app store page did the marketing)
//   signed in            inside Settings, in the app's own navigation, without
//                        the marketing navbar and footer
export const PUBLIC_PAGES = [
  { key: 'howItWorks', route: 'HowItWorks', path: 'how-it-works', icon: 'guide', nav: true },
  { key: 'gallery', route: 'Gallery', path: 'gallery', icon: 'gallery', nav: true },
  { key: 'safety', route: 'Safety', path: 'safety', icon: 'verified', nav: true },
  { key: 'about', route: 'About', path: 'about', icon: 'flag', nav: true },
  { key: 'mission', route: 'Mission', path: 'mission', icon: 'mission' },
  { key: 'help', route: 'Help', path: 'help', icon: 'help', nav: true },
  { key: 'contact', route: 'Contact', path: 'contact', icon: 'chat' },
  { key: 'terms', route: 'Terms', path: 'terms', icon: 'terms' },
  { key: 'privacy', route: 'Privacy', path: 'privacy', icon: 'privacy' },
];

export const PAGE_BY_KEY = Object.fromEntries(PUBLIC_PAGES.map((page) => [page.key, page]));
export const PUBLIC_ROUTES = PUBLIC_PAGES.map((page) => page.route);

// The footer's link columns. `auth` items open a log in page instead.
export const FOOTER_GROUPS = [
  { key: 'product', items: ['howItWorks', 'gallery', 'safety', 'help'] },
  { key: 'company', items: ['about', 'mission', 'contact'] },
  { key: 'legal', items: ['terms', 'privacy'] },
  {
    key: 'getStarted',
    auth: [
      { key: 'signupShipper', route: 'Signup', params: { role: 'shipper' } },
      { key: 'signupOwner', route: 'Signup', params: { role: 'owner' } },
      { key: 'driverLogin', route: 'PinLogin' },
      { key: 'login', route: 'Login' },
    ],
  },
];

// Settings groups the same pages by what someone is looking for once they use
// the app: getting help first, then about FLITO, then the legal pages.
export const SETTINGS_GROUPS = [
  { key: 'support', items: ['help', 'contact', 'safety'] },
  { key: 'about', items: ['howItWorks', 'gallery', 'about', 'mission'] },
  { key: 'legal', items: ['terms', 'privacy'] },
];

// The short row of links at the foot of the log in pages and the laptop sidebar.
export const QUICK_LINKS = ['about', 'help', 'terms', 'privacy'];

// Web addresses of the screens the public site links to that aren't pages:
// the landing page and the ways in. Signed out only.
export const AUTH_PATHS = { Landing: '', Login: 'login', Signup: 'signup', PinLogin: 'driver-login' };

// Web addresses. Signed out the pages sit at the top of the Auth stack; signed
// in they live in the Profile stack, so `exact` keeps them at /terms rather
// than /profile/terms.
export const publicLinkingScreens = ({ signedIn }) => Object.fromEntries(
  PUBLIC_PAGES.map((page) => [page.route, signedIn ? { path: page.path, exact: true } : page.path])
);
