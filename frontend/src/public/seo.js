import { PUBLIC_PAGES } from './pages';

// What search engines and link previews are told about the public site. The
// app reads it to keep each page's head right as people move around
// (pageMeta.js); the web build reads it to give every public page its own HTML
// and to write the sitemap and robots.txt (scripts/seo.js). Plain data and
// functions only, so the build can load it outside the app.

// Where the site is live. Every canonical address and sitemap entry is built
// on it.
export const SITE_URL = 'https://flito.sanjay019.com.np';
export const SITE_NAME = 'FLITO';

// The site's languages, the first being what a first visit shows (i18n's
// FIRST_RUN_LANGUAGE). The others have their own addresses through ?lang=,
// so search engines can find and list each language.
export const SEO_LANGUAGES = ['ne', 'en'];
export const LANG_PARAM = 'lang';
export const OG_LOCALES = { ne: 'ne_NP', en: 'en_US' };

// The 1200x630 picture chat apps and social sites show with a shared link.
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 };

// Who made the site, credited in the footer and the structured data.
export const AUTHOR = { name: 'Sanjay Gupta', url: 'https://guptasanjay.com.np' };

// Every public page as { key, route, path }, the landing page first. `path`
// is the address on the site: '/' or '/about'.
export const SEO_PAGES = [
  { key: 'landing', route: 'Landing', path: '/' },
  ...PUBLIC_PAGES.map((page) => ({ key: page.key, route: page.route, path: `/${page.path}` })),
];

// Parts of the site that are an account's own, behind a log in, or only a
// step on the way in: nothing there for a search result.
export const PRIVATE_PATHS = [
  '/profile', '/loads', '/bookings', '/jobs', '/quotes', '/fleet', '/earnings',
  '/admin', '/admin-access', '/language', '/forgot-password', '/reset-password',
];

// A page's full address in one language. The first language has the plain
// address; the others add ?lang=.
export const pageUrl = (path, lang = SEO_LANGUAGES[0]) => (
  `${SITE_URL}${path}${lang === SEO_LANGUAGES[0] ? '' : `?${LANG_PARAM}=${lang}`}`
);

// A page's title and description, read through `text` (i18next's t, or the
// build's lookup into the same strings). The title matches the browser tab
// (RootNavigator's documentTitle).
export const pageMeta = (text, key) => ({
  title: key === 'landing' ? text('site:pages.landing.title') : `${text(`site:pages.${key}.label`)} · ${SITE_NAME}`,
  description: text(`site:pages.${key}.description`),
});

// Schema.org data for search engines: FLITO as an organisation, the site, and
// who built it.
const AUTHOR_ID = `${AUTHOR.url}/#person`;
export const structuredData = (description) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/apple-touch-icon.png`,
      description,
      areaServed: { '@type': 'Country', name: 'Nepal' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      inLanguage: SEO_LANGUAGES,
      publisher: { '@id': `${SITE_URL}/#organization` },
      creator: { '@id': AUTHOR_ID },
      author: { '@id': AUTHOR_ID },
    },
    { '@type': 'Person', '@id': AUTHOR_ID, name: AUTHOR.name, url: AUTHOR.url },
  ],
});
