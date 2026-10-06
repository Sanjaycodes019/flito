import { Platform } from 'react-native';
import i18n from '../i18n';
import { SEO_PAGES, SEO_LANGUAGES, OG_LOCALES, pageUrl, pageMeta } from './seo';

// Keeps the web page's head in step with the screen showing: the page's
// description, its canonical address, the address of each language version and
// the link-preview tags. The build writes the same tags into each public page's
// HTML (scripts/seo.js) for crawlers that don't run JavaScript; this keeps them
// right as people move between pages and languages without a reload. A screen
// that isn't a public page claims no address. Does nothing off the web.

const PAGE_BY_ROUTE = Object.fromEntries(SEO_PAGES.map((page) => [page.route, page]));
const ALTERNATES = [...SEO_LANGUAGES, 'x-default'];

const upsert = (tag, selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(tag);
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
};

const setMeta = (attribute, key, content) => upsert('meta', `meta[${attribute}="${key}"]`, { [attribute]: key, content });

const removeAll = (selector) => document.head.querySelectorAll(selector).forEach((element) => element.remove());

let currentRoute = null;

export const applyPageMeta = (routeName = currentRoute) => {
  currentRoute = routeName;
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.head) return;
  const lang = i18n.language;
  const page = PAGE_BY_ROUTE[routeName];
  // Off the public pages the site's own description stands in.
  const { title, description } = pageMeta(i18n.t.bind(i18n), page ? page.key : 'landing');

  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:locale', OG_LOCALES[lang] || OG_LOCALES[SEO_LANGUAGES[0]]);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);

  if (!page) {
    removeAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[property="og:url"]');
    return;
  }
  const url = pageUrl(page.path, lang);
  upsert('link', 'link[rel="canonical"]', { rel: 'canonical', href: url });
  setMeta('property', 'og:url', url);
  ALTERNATES.forEach((hreflang) => upsert('link', `link[rel="alternate"][hreflang="${hreflang}"]`, {
    rel: 'alternate',
    hreflang,
    href: pageUrl(page.path, hreflang === 'x-default' ? undefined : hreflang),
  }));
};

// A change of language changes every tag but not the screen.
i18n.on('languageChanged', () => applyPageMeta());
