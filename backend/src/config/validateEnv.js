// Fail fast at boot on missing/weak config rather than surfacing it later as
// confusing 500s (a JWT signed with an undefined secret throws on first login;
// a missing MONGODB_URI only shows up as a connection error).
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

const MIN_SECRET_LENGTH = 32;

module.exports = function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length) {
    console.error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'Copy backend/.env.example to backend/.env for local dev, or set them in ' +
      'your host dashboard (Render: Environment tab).'
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
      console.error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
      process.exit(1);
    }
    if (!process.env.FRONTEND_URL) {
      // Without this the CORS allow-list contains only localhost origins, so
      // the deployed frontend silently fails every request.
      console.error('FRONTEND_URL must be set in production so CORS allows your deployed frontend.');
      process.exit(1);
    }
  }
};
