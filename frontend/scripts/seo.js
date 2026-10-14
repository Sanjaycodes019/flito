#!/usr/bin/env node
// Runs after `expo export --platform web` (npm run build:web).
//
// The web app is one HTML page that draws itself with JavaScript, so on its own
// every address serves the same empty index.html titled "FLITO". Search engines
// that don't run JavaScript (or, like Bing, don't always), and the link
// previews chat and social apps show, read only that HTML. This writes, into
// dist/, for each public page in each language:
//
//   <page>.<lang>.html  the page's own title, description, canonical address,
//                       language links, link-preview tags, the site's
//                       structured data, and a plain-HTML summary in
//                       <noscript>, all in that language. The landing page is
//                       landing.<lang>.html. vercel.json sends /about to
//                       about.ne.html and /about?lang=en to about.en.html, and
//                       redirects the old /about.html to /about.
//   sitemap.xml         every public page, in each language
//   robots.txt          what crawlers may visit, and where the sitemap is
//
// and removes index.html. Vercel serves a file at / ahead of any rewrite, and
// takes any index.*.html for it too, so / would get one page whatever ?lang=
// asked for; with no index file there, vercel.json decides.
//
// Pages, addresses and words all come from the app (src/public/seo.js, the
// site strings), so nothing here is kept by hand. The app keeps the same tags
// right after it loads (src/public/pageMeta.js).

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

// One language's strings, and a lookup that reads them the way the app's
// t('site:pages.about.label') does.
const stringsIn = (lang) => ({
  site: require(path.join(SRC, `i18n/locales/${lang}/site.json`)),
  legal: require(path.join(SRC, `i18n/locales/${lang}/legal.json`)),
});
const textIn = (lang) => {
  const strings = stringsIn(lang);
  return (key) => {
    const [ns, keyPath] = key.split(':');
    const value = keyPath.split('.').reduce((node, part) => (node == null ? node : node[part]), strings[ns]);
    if (typeof value !== 'string') throw new Error(`seo: no ${lang} string for ${key}`);
    return value;
  };
};

// Each page's heading and opening paragraph, for the <noscript> summary.
const heroOf = (lang, key) => {
  const strings = stringsIn(lang);
  if (key === 'landing') return strings.site.landing.hero;
  return strings.legal[key]?.hero || strings.site[key]?.hero;
};

// The <head> tags for one page in one language.
const headTags = (seo, page, lang, text, meta) => {
  const image = `${seo.SITE_URL}${seo.OG_IMAGE.path}`;
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${seo.pageUrl(page.path, lang)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta name="theme-color" content="#12161A" />',
    `<meta name="author" content="${escapeHtml(seo.AUTHOR.name)}" />`,
    `<link rel="author" href="${seo.AUTHOR.url}" />`,
    ...seo.SEO_LANGUAGES.map((lang) => `<link rel="alternate" hreflang="${lang}" href="${seo.pageUrl(page.path, lang)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${seo.pageUrl(page.path)}" />`,
    // Expo's favicon.ico stops at 48px; search results and sharp screens want
    // a larger icon, in a multiple of 48px.
    '<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${seo.SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${seo.pageUrl(page.path, lang)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${seo.OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${seo.OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(text('site:pages.landing.title'))}" />`,
    `<meta property="og:locale" content="${seo.OG_LOCALES[lang]}" />`,
    ...seo.SEO_LANGUAGES.filter((other) => other !== lang).map((other) => `<meta property="og:locale:alternate" content="${seo.OG_LOCALES[other]}" />`),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${JSON.stringify(seo.structuredData(text('site:pages.landing.description'))).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.map((tag) => `    ${tag}`).join('\n');
};

// What a browser without JavaScript shows: the page's heading and opening
// paragraph, links to every public page in the same language, and who built
// the site.
const noscript = (seo, page, lang, text) => {
  const hero = heroOf(lang, page.key);
  const links = seo.SEO_PAGES
    .map((other) => `<li><a href="${seo.pageUrl(other.path, lang).slice(seo.SITE_URL.length)}">${escapeHtml(text(`site:pages.${other.key}.label`))}</a></li>`)
    .join('');
  const [madeBefore, madeAfter] = text('site:footer.madeBy').split('{{name}}');
  return [
    '<noscript>',
    hero ? `<h1>${escapeHtml(hero.title.replace(/\n/g, ' '))}</h1>` : '',
    hero?.lead ? `<p>${escapeHtml(hero.lead)}</p>` : '',
    `<p>${escapeHtml(text('site:footer.needsJavaScript'))}</p>`,
    `<nav><ul>${links}</ul></nav>`,
    `<p>${escapeHtml(madeBefore)}<a href="${seo.AUTHOR.url}" rel="author">${escapeHtml(seo.AUTHOR.name)}</a>${escapeHtml(madeAfter)}</p>`,
    '</noscript>',
  ].join('\n    ');
};

// index.html as one page in one language: its title, tags and summary.
const renderPage = (html, seo, page, lang) => {
  const text = textIn(lang);
  const meta = seo.pageMeta(text, page.key);
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace('httpEquiv=', 'http-equiv=')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace('</head>', `\n${headTags(seo, page, lang, text, meta)}\n  </head>`)
    .replace(/<!-- Use static rendering[\s\S]*?-->\s*/, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/, noscript(seo, page, lang, text));
};

// Bing leans on <lastmod> to decide what to recrawl. Every deploy ships a new
// app bundle, which is what draws each page, so the build date is when the
// pages last changed.
const renderSitemap = (seo, lastmod = new Date().toISOString().slice(0, 10)) => {
  const alternates = (page) => [
    ...seo.SEO_LANGUAGES.map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${seo.pageUrl(page.path, lang)}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${seo.pageUrl(page.path)}" />`,
  ].join('\n');
  const urls = seo.SEO_PAGES.flatMap((page) => seo.SEO_LANGUAGES.map((lang) => [
    '  <url>',
    `    <loc>${seo.pageUrl(page.path, lang)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
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

// The output file for a page in a language: / in Nepali is landing.ne.html,
// /about in English is about.en.html.
const fileFor = (page, lang) => `${page.path === '/' ? 'landing' : page.path.slice(1)}.${lang}.html`;

const run = (dist = path.join(ROOT, 'dist')) => {
  const seo = loadFromSrc('public/seo.js');
  const indexFile = path.join(dist, 'index.html');
  if (!fs.existsSync(indexFile)) throw new Error(`seo: ${indexFile} not found; run expo export first`);
  const html = fs.readFileSync(indexFile, 'utf8');
  // index.html is rewritten below, so a second run would read the landing
  // page's tags back and add them again.
  if (html.includes('property="og:site_name"')) throw new Error('seo: dist/ was already processed; run expo export again first');

  const files = seo.SEO_PAGES.flatMap((page) => seo.SEO_LANGUAGES.map((lang) => {
    const file = fileFor(page, lang);
    fs.writeFileSync(path.join(dist, file), renderPage(html, seo, page, lang));
    return file;
  }));
  fs.unlinkSync(indexFile);
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), renderSitemap(seo));
  fs.writeFileSync(path.join(dist, 'robots.txt'), renderRobots(seo));
  return files;
};

if (require.main === module) {
  const files = run();
  console.log(`seo: wrote ${files.join(', ')}, sitemap.xml and robots.txt`);
}

module.exports = { run, loadFromSrc, renderPage, renderSitemap, renderRobots, fileFor };
