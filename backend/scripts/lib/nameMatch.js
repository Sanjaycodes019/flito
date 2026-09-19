// Romanization-tolerant place-name matching, shared by the scripts that
// build src/data/nepal/locations.json and that add Nepali names to it.
// Both match the same official boundary names against the same
// local-states-nepal dataset, so they share one implementation.

// Collapses common romanization differences in Nepali place names.
const canon = (s) => String(s || '').toLowerCase()
  .replace(/province|rural|municipality|metropolitan|sub|city|gaunpalika|nagarpalika/g, '')
  .replace(/[^a-z]/g, '')
  .replace(/ph/g, 'f').replace(/bh/g, 'b').replace(/kh/g, 'k').replace(/gh/g, 'g')
  .replace(/dh/g, 'd').replace(/th/g, 't').replace(/chh/g, 'c').replace(/ch/g, 'c')
  .replace(/sh/g, 's').replace(/w/g, 'v').replace(/x/g, 'ks')
  .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ou/g, 'au').replace(/aa/g, 'a').replace(/y/g, 'i')
  .replace(/(.)\1+/g, '$1');

const bigrams = (s) => {
  const grams = new Map();
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    grams.set(g, (grams.get(g) || 0) + 1);
  }
  return grams;
};

const similarity = (a, b) => {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  let total = 0;
  A.forEach((count, g) => { total += count; if (B.has(g)) shared += Math.min(count, B.get(g)); });
  B.forEach((count) => { total += count; });
  return total ? (2 * shared) / total : 0;
};

const areaSimilarity = (a, b) => {
  const x = Number(a);
  const y = Number(b);
  if (!x || !y) return 0.5;
  return Math.min(x, y) / Math.max(x, y);
};

module.exports = { canon, similarity, areaSimilarity };
