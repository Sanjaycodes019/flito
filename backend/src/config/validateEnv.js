const logger = require('../utils/logger');
// Fail fast at boot on missing/weak config rather than surfacing it later as
// confusing 500s (a JWT signed with an undefined secret throws on first login;
// a missing MONGODB_URI only shows up as a connection error).
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

const MIN_SECRET_LENGTH = 32;

module.exports = function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length) {
    logger.error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'Copy backend/.env.example to backend/.env for local dev, or set them in ' +
      'your host dashboard (Render: Environment tab).'
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
      logger.error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
      process.exit(1);
    }
    if (!process.env.FRONTEND_URL) {
      // Without this the CORS allow-list contains only localhost origins, so
      // the deployed frontend silently fails every request.
      logger.error('FRONTEND_URL must be set in production so CORS allows your deployed frontend.');
      process.exit(1);
    }
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      // Without a provider, verification and password-reset codes are
      // generated but never delivered: nobody can verify their email or
      // recover a forgotten password.
      logger.error(
        'BREVO_API_KEY and BREVO_SENDER_EMAIL must be set in production. ' +
        'Without an email provider nobody can verify their email or reset a password.'
      );
      process.exit(1);
    }
    // GOOGLE_CLIENT_ID is intentionally not required: Google sign-in is an
    // enhancement, and the rest of the app works without it (see
    // services/googleAuth.js's isConfigured()).
  }
};
