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
    const html = renderPage(TEMPLATE, seo, about, 'en');

    expect(fileFor(about, 'en')).toBe('about.en.html');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>About us · FLITO</title>');
    expect(html).toContain('<link rel="canonical" href="https://flito.sanjay019.com.np/about?lang=en" />');
    expect(html).toContain('<meta property="og:url" content="https://flito.sanjay019.com.np/about?lang=en" />');
    expect(html).toContain('<meta property="og:locale" content="en_US" />');
    expect(html).toContain(`<meta name="description" content="${siteEn.pages.about.description}" />`);
    expect(html).toContain('<link rel="alternate" hreflang="ne" href="https://flito.sanjay019.com.np/about" />');
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://flito.sanjay019.com.np/about?lang=en" />');
    expect(html).toContain('<meta property="og:image" content="https://flito.sanjay019.com.np/og-image.png" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />');
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('<meta name="author" content="Sanjay Gupta" />');
    expect(html).toContain('<link rel="author" href="https://guptasanjay.com.np" />');
    expect(html).toContain('"author":{"@id":"https://guptasanjay.com.np/#person"}');
    expect(html).toContain('<p>Made by <a href="https://guptasanjay.com.np" rel="author">Sanjay Gupta</a></p>');
    expect(html).toContain('<a href="/privacy?lang=en">Privacy Policy</a>');
    expect(html).toContain('http-equiv=');
    expect(html).not.toContain('You need to enable JavaScript');
    expect(html).not.toContain('Expo Router');
  });

  // The plain address is the Nepali page, so its HTML has to be Nepali too:
  // a crawler that doesn't run the app would otherwise read English text on
  // a page the language links call Nepali, the same as the ?lang=en page.
  it('writes the plain address in Nepali, as its own page', () => {
    const about = seo.SEO_PAGES.find((page) => page.key === 'about');
    const html = renderPage(TEMPLATE, seo, about, 'ne');

    expect(fileFor(about, 'ne')).toBe('about.ne.html');
    expect(fileFor(seo.SEO_PAGES[0], 'ne')).toBe('index.ne.html');
    expect(html).toContain('<html lang="ne">');
    expect(html).toContain(`<title>${siteNe.pages.about.label} · FLITO</title>`);
    expect(html).toContain(`<meta name="description" content="${siteNe.pages.about.description}" />`);
    expect(html).toContain('<link rel="canonical" href="https://flito.sanjay019.com.np/about" />');
    expect(html).toContain('<meta property="og:locale" content="ne_NP" />');
    expect(html).toContain('<meta property="og:locale:alternate" content="en_US" />');
    expect(html).toContain(`<p>${siteNe.footer.needsJavaScript}</p>`);
    expect(html).toContain('<a href="https://guptasanjay.com.np" rel="author">Sanjay Gupta</a> द्वारा निर्मित');
    expect(html).toContain(`<a href="/privacy">${siteNe.pages.privacy.label}</a>`);
    expect(html).not.toContain('About us');
  });

  it('writes every page in every language and drops the plain index.html', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { run } = require('../scripts/seo');
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'flito-seo-'));
    try {
      fs.writeFileSync(path.join(dist, 'index.html'), TEMPLATE);
      const files = run(dist);
      expect(files).toHaveLength(seo.SEO_PAGES.length * seo.SEO_LANGUAGES.length);
      expect(fs.readdirSync(dist).sort()).toEqual([...files, 'robots.txt', 'sitemap.xml'].sort());
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it('lists every page in both languages in the sitemap', () => {
    const sitemap = renderSitemap(seo);
    expect(sitemap.match(/<url>/g)).toHaveLength(seo.SEO_PAGES.length * seo.SEO_LANGUAGES.length);
    expect(sitemap).toContain('<loc>https://flito.sanjay019.com.np/help?lang=en</loc>');
  });

  it('dates every sitemap entry', () => {
    const sitemap = renderSitemap(seo, '2026-10-14');
    expect(sitemap.match(/<lastmod>2026-10-14<\/lastmod>/g)).toHaveLength(seo.SEO_PAGES.length * seo.SEO_LANGUAGES.length);
  });

  it('tells IndexNow about every sitemap address, with a key the site serves', () => {
    const { KEY, submission } = require('../scripts/indexnow');
    const fs = require('fs');
    const path = require('path');
    const body = submission(seo);
    expect(fs.readFileSync(path.join(__dirname, '..', 'public', `${KEY}.txt`), 'utf8').trim()).toBe(KEY);
    expect(body.host).toBe('flito.sanjay019.com.np');
    expect(body.keyLocation).toBe(`https://flito.sanjay019.com.np/${KEY}.txt`);
    expect(body.urlList).toEqual(renderSitemap(seo).match(/<loc>[^<]+<\/loc>/g).map((loc) => loc.slice(5, -6)));
  });

  // Vercel can't read the page list, so vercel.json names the pages itself:
  // /about is rewritten to about.ne.html, /about?lang=en to about.en.html, and
  // the old /about.html sent to /about. (cleanUrls would do some of it for
  // every page, but it also redirects any .html address, which breaks the
  // search engines' verification files.)
  it('serves each page\'s HTML at its address on Vercel', () => {
    const vercel = require('../vercel.json');
    const pattern = `:page(${PUBLIC_PAGES.map((page) => page.path).join('|')})`;
    const [first, ...others] = seo.SEO_LANGUAGES;
    const asking = (lang) => [{ type: 'query', key: seo.LANG_PARAM, value: lang }];
    expect(vercel.cleanUrls).toBeFalsy();
    expect(vercel.rewrites).toEqual([
      ...others.flatMap((lang) => [
        { source: '/', has: asking(lang), destination: `/index.${lang}.html` },
        { source: `/${pattern}`, has: asking(lang), destination: `/:page.${lang}.html` },
      ]),
      { source: `/${pattern}`, destination: `/:page.${first}.html` },
      { source: '/(.*)', destination: `/index.${first}.html` },
    ]);
    expect(vercel.redirects[0]).toMatchObject({ source: `/${pattern}.html`, destination: '/:page', permanent: true });
  });

  it('keeps crawlers out of accounts and points them to the sitemap', () => {
    const robots = renderRobots(seo);
    expect(robots).toContain('Disallow: /profile');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: https://flito.sanjay019.com.np/sitemap.xml');
  });
});
