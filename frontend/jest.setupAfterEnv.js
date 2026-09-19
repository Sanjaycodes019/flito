// `jest.setup.js` runs via `setupFiles`, before the test framework (and
// `beforeAll`) exists — fine for the `jest.mock()` calls there, but too
// early to await anything. i18next's resources load from local JSON
// (synchronous) but its language is resolved from `storage.getItem`
// (async), so every test file needs this to finish before any screen
// renders, or `useTranslation()` returns raw keys instead of text.
import { initI18n } from './src/i18n';

beforeAll(async () => {
  await initI18n();
});
