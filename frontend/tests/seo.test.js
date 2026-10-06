import * as seo from '../src/public/seo';
import { PUBLIC_PAGES } from '../src/public/pages';
import { FIRST_RUN_LANGUAGE } from '../src/i18n';
import siteEn from '../src/i18n/locales/en/site.json';
import siteNe from '../src/i18n/locales/ne/site.json';

const { renderPage, renderSitemap, renderRobots, fileFor } = require('../scripts/seo');

const textFrom = (site) => (key) => key.split(':')[1].split('.').reduce((node, part) => node?.[part], site);

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <title>FLITO</title>
  </head>
  <body>
    <!-- Use static rendering with Expo Router to support running without JavaScript. -->
    <noscript>
      You need to enable JavaScript to run this app.
    </noscript>
    <div id="root"></div>
  </body>
</html>`;

describe('SEO data', () => {
  it('covers the landing page and every public page', () => {
    expect(seo.SEO_PAGES.map((page) => page.path)).toEqual(['/', ...PUBLIC_PAGES.map((page) => `/${page.path}`)]);
  });

  it('gives the first visit\'s language the plain address', () => {
    expect(seo.SEO_LANGUAGES[0]).toBe(FIRST_RUN_LANGUAGE);
    expect(seo.pageUrl('/about')).toBe('https://flito.sanjay019.com.np/about');
    expect(seo.pageUrl('/about', 'en')).toBe('https://flito.sanjay019.com.np/about?lang=en');
  });

  it.each([['en', siteEn], ['ne', siteNe]])('has a title and a short description for every page in %s', (lang, site) => {
    seo.SEO_PAGES.forEach((page) => {
      const meta = seo.pageMeta(textFrom(site), page.key);
      expect(meta.title).toEqual(expect.stringContaining('FLITO'));
      expect(meta.description).toBeTruthy();
      // Devanagari vowel signs count as characters, so Nepali runs longer for the same width.
      expect(meta.description.length).toBeLessThanOrEqual(lang === 'ne' ? 175 : 160);
    });
  });
});

describe('the web build', () => {
  it('gives each page its own title, description, language links and summary', () => {
    const about = seo.SEO_PAGES.find((page) => page.key === 'about');
    const html = renderPage(TEMPLATE, seo, about);

    expect(fileFor(about)).toBe('about.html');
    expect(html).toContain('<title>About us · FLITO</title>');
    expect(html).toContain(`<meta name="description" content="${siteEn.pages.about.description}" />`);
    expect(html).toContain('<link rel="alternate" hreflang="ne" href="https://flito.sanjay019.com.np/about" />');
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://flito.sanjay019.com.np/about?lang=en" />');
    expect(html).toContain('<meta property="og:image" content="https://flito.sanjay019.com.np/og-image.png" />');
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('<meta name="author" content="Sanjay Gupta" />');
    expect(html).toContain('<link rel="author" href="https://guptasanjay.com.np" />');
    expect(html).toContain('"author":{"@id":"https://guptasanjay.com.np/#person"}');
    expect(html).toContain('<p>Built by <a href="https://guptasanjay.com.np" rel="author">Sanjay Gupta</a></p>');
    expect(html).toContain('<a href="/privacy">Privacy Policy</a>');
    expect(html).toContain('http-equiv=');
    expect(html).not.toContain('You need to enable JavaScript');
    expect(html).not.toContain('Expo Router');
  });

  it('lists every page in both languages in the sitemap', () => {
    const sitemap = renderSitemap(seo);
    expect(sitemap.match(/<url>/g)).toHaveLength(seo.SEO_PAGES.length * seo.SEO_LANGUAGES.length);
    expect(sitemap).toContain('<loc>https://flito.sanjay019.com.np/help?lang=en</loc>');
  });

  // Vercel can't read the page list, so vercel.json names the pages itself:
  // /about is rewritten to about.html, and /about.html sent to /about.
  // (cleanUrls would do it for every page, but it also redirects any .html
  // address, which breaks the search engines' verification files.)
  it('serves each page\'s HTML at its address on Vercel', () => {
    const vercel = require('../vercel.json');
    const pattern = `:page(${PUBLIC_PAGES.map((page) => page.path).join('|')})`;
    expect(vercel.cleanUrls).toBeFalsy();
    expect(vercel.rewrites[0]).toEqual({ source: `/${pattern}`, destination: '/:page.html' });
    expect(vercel.redirects[0]).toMatchObject({ source: `/${pattern}.html`, destination: '/:page', permanent: true });
    expect(vercel.rewrites[vercel.rewrites.length - 1]).toEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('keeps crawlers out of accounts and points them to the sitemap', () => {
    const robots = renderRobots(seo);
    expect(robots).toContain('Disallow: /profile');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: https://flito.sanjay019.com.np/sitemap.xml');
  });
});
