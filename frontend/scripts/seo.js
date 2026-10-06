#!/usr/bin/env node
// Runs after `expo export --platform web` (npm run build:web).
//
// The web app is one HTML page that draws itself with JavaScript, so on its own
// every address serves the same empty index.html titled "FLITO". Search engines
// that don't run JavaScript, and the link previews chat and social apps show,
// read only that HTML. This writes, into dist/:
//
//   index.html       the landing page's own title, description, language
//                    links, link-preview tags, the site's structured data, and
//                    a plain-HTML summary in <noscript>
//   <page>.html      the same for each public page (/about is about.html;
//                    vercel.json rewrites /about to it, and redirects
//                    /about.html to /about)
//   sitemap.xml      every public page, in each language
//   robots.txt       what crawlers may visit, and where the sitemap is
//
// Pages, addresses and words all come from the app (src/public/seo.js, the
// English site strings), so nothing here is kept by hand. The app keeps the
// same tags right after it loads (src/public/pageMeta.js).

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// src/ is written as ES modules for the app's bundler; compile it on the way in.
const loadFromSrc = (file) => {
  const babel = require('@babel/core');
  const compileJs = Module._extensions['.js'];
  Module._extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(SRC)) return compileJs(module, filename);
    const { code } = babel.transformFileSync(filename, {
      babelrc: false,
      configFile: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    });
    return module._compile(code, filename);
  };
  try {
    return require(path.join(SRC, file));
  } finally {
    Module._extensions['.js'] = compileJs;
  }
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// The English strings, read the way the app's t('site:pages.about.label') does.
const STRINGS = {
  site: require(path.join(SRC, 'i18n/locales/en/site.json')),
  legal: require(path.join(SRC, 'i18n/locales/en/legal.json')),
};
const text = (key) => {
  const [ns, keyPath] = key.split(':');
  const value = keyPath.split('.').reduce((node, part) => (node == null ? node : node[part]), STRINGS[ns]);
  if (typeof value !== 'string') throw new Error(`seo: no English string for ${key}`);
  return value;
};

// Each page's heading and opening paragraph, for the <noscript> summary.
const heroOf = (key) => {
  if (key === 'landing') return STRINGS.site.landing.hero;
  return STRINGS.legal[key]?.hero || STRINGS.site[key]?.hero;
};

// The <head> tags for one page.
const headTags = (seo, page, meta) => {
  const image = `${seo.SITE_URL}${seo.OG_IMAGE.path}`;
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta name="theme-color" content="#12161A" />',
    `<meta name="author" content="${escapeHtml(seo.AUTHOR.name)}" />`,
    `<link rel="author" href="${seo.AUTHOR.url}" />`,
    ...seo.SEO_LANGUAGES.map((lang) => `<link rel="alternate" hreflang="${lang}" href="${seo.pageUrl(page.path, lang)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${seo.pageUrl(page.path)}" />`,
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${seo.SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${seo.pageUrl(page.path)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${seo.OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${seo.OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(text('site:pages.landing.title'))}" />`,
    `<meta property="og:locale" content="${seo.OG_LOCALES.en}" />`,
    ...seo.SEO_LANGUAGES.filter((lang) => lang !== 'en').map((lang) => `<meta property="og:locale:alternate" content="${seo.OG_LOCALES[lang]}" />`),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${JSON.stringify(seo.structuredData(text('site:pages.landing.description'))).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.map((tag) => `    ${tag}`).join('\n');
};

// What a browser without JavaScript shows: the page's heading and opening
// paragraph, links to every public page, and who built the site.
const noscript = (seo, page) => {
  const hero = heroOf(page.key);
  const links = seo.SEO_PAGES
    .map((other) => `<li><a href="${other.path}">${escapeHtml(text(other.key === 'landing' ? 'site:pages.landing.label' : `site:pages.${other.key}.label`))}</a></li>`)
    .join('');
  return [
    '<noscript>',
    hero ? `<h1>${escapeHtml(hero.title.replace(/\n/g, ' '))}</h1>` : '',
    hero?.lead ? `<p>${escapeHtml(hero.lead)}</p>` : '',
    '<p>FLITO needs JavaScript to post loads and book trucks. Please turn it on to use the site.</p>',
    `<nav><ul>${links}</ul></nav>`,
    `<p>Built by <a href="${seo.AUTHOR.url}" rel="author">${escapeHtml(seo.AUTHOR.name)}</a></p>`,
    '</noscript>',
  ].join('\n    ');
};

// index.html as one page: its title, tags and summary, in English.
const renderPage = (html, seo, page) => {
  const meta = seo.pageMeta(text, page.key);
  return html
    .replace(/<html lang="[^"]*">/, '<html lang="en">')
    .replace('httpEquiv=', 'http-equiv=')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace('</head>', `\n${headTags(seo, page, meta)}\n  </head>`)
    .replace(/<!-- Use static rendering[\s\S]*?-->\s*/, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/, noscript(seo, page));
};

const renderSitemap = (seo) => {
  const alternates = (page) => [
    ...seo.SEO_LANGUAGES.map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${seo.pageUrl(page.path, lang)}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${seo.pageUrl(page.path)}" />`,
  ].join('\n');
  const urls = seo.SEO_PAGES.flatMap((page) => seo.SEO_LANGUAGES.map((lang) => [
    '  <url>',
    `    <loc>${seo.pageUrl(page.path, lang)}</loc>`,
    alternates(page),
    '  </url>',
  ].join('\n')));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
};

const renderRobots = (seo) => [
  'User-agent: *',
  'Allow: /',
  ...seo.PRIVATE_PATHS.map((privatePath) => `Disallow: ${privatePath}`),
  '',
  `Sitemap: ${seo.SITE_URL}/sitemap.xml`,
  '',
].join('\n');

// The output file for a page: / is index.html, /about is about.html.
const fileFor = (page) => (page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`);

const run = (dist = path.join(ROOT, 'dist')) => {
  const seo = loadFromSrc('public/seo.js');
  const indexFile = path.join(dist, 'index.html');
  if (!fs.existsSync(indexFile)) throw new Error(`seo: ${indexFile} not found; run expo export first`);
  const html = fs.readFileSync(indexFile, 'utf8');
  // index.html is rewritten below, so a second run would read the landing
  // page's tags back and add them again.
  if (html.includes('property="og:site_name"')) throw new Error('seo: dist/ was already processed; run expo export again first');

  seo.SEO_PAGES.forEach((page) => {
    fs.writeFileSync(path.join(dist, fileFor(page)), renderPage(html, seo, page));
  });
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), renderSitemap(seo));
  fs.writeFileSync(path.join(dist, 'robots.txt'), renderRobots(seo));
  return seo.SEO_PAGES.map(fileFor);
};

if (require.main === module) {
  const files = run();
  console.log(`seo: wrote ${files.join(', ')}, sitemap.xml and robots.txt`);
}

module.exports = { run, renderPage, renderSitemap, renderRobots, fileFor };
