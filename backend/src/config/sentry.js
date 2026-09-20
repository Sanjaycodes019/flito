const Sentry = require('@sentry/node');

// Error tracking is opt-in: with no SENTRY_DSN nothing is initialised and
// the app behaves exactly as before.
const sentryEnabled = Boolean(process.env.SENTRY_DSN) && process.env.NODE_ENV !== 'test';

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

module.exports = { Sentry, sentryEnabled };
