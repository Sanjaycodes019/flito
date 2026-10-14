#!/usr/bin/env node
// Tells Bing (and the other IndexNow search engines: Yandex, Seznam, Naver)
// that the public pages changed, so they crawl them now instead of whenever
// they next get round to it. Google doesn't take part; it reads the sitemap.
//
//   npm run indexnow
//
// Run it after a deploy is live: the engines fetch the key file from the site
// (public/<KEY>.txt) to check the request is ours, so it has to be up first.

const fs = require('fs');
const path = require('path');
const { loadFromSrc } = require('./seo');

const KEY = 'a1f491632ffeecf217fbc28fd90a9e74';

// Every public page in each language, as the sitemap lists them.
const urlList = (seo) => seo.SEO_PAGES.flatMap((page) => seo.SEO_LANGUAGES.map((lang) => seo.pageUrl(page.path, lang)));

const submission = (seo) => ({
  host: new URL(seo.SITE_URL).host,
  key: KEY,
  keyLocation: `${seo.SITE_URL}/${KEY}.txt`,
  urlList: urlList(seo),
});

const run = async () => {
  const keyFile = path.join(__dirname, '..', 'public', `${KEY}.txt`);
  if (fs.readFileSync(keyFile, 'utf8').trim() !== KEY) throw new Error(`indexnow: ${keyFile} doesn't hold the key`);
  const seo = loadFromSrc('public/seo.js');
  const body = submission(seo);
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // 200 and 202 both mean accepted; 403 means the key file isn't live yet.
  if (!response.ok) throw new Error(`indexnow: ${response.status} ${await response.text()}`);
  console.log(`indexnow: submitted ${body.urlList.length} addresses (${response.status})`);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { KEY, submission };
