// Tests build the Express app directly (not via server.js), so the env it
// depends on is set here rather than loaded from .env, keeping runs
// hermetic and independent of whatever is in a developer's local .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_used_only_by_the_test_suite_0123456789';
process.env.JWT_EXPIRE = '1h';
process.env.OSRM_URL = 'off'; // never call a routing server from the suite
// FLITO's fees apply to every booking the suite makes (commission.test.js
// checks the start date itself).
process.env.COMMISSION_START_DATE = '2000-01-01';
// No free welcome trips, so a trip's fee shows; commission.test.js checks them.
process.env.COMMISSION_WELCOME_TRIPS = '0';
