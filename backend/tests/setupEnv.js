// Tests build the Express app directly (not via server.js), so the env it
// depends on is set here rather than loaded from .env — keeping runs
// hermetic and independent of whatever is in a developer's local .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_used_only_by_the_test_suite_0123456789';
process.env.JWT_EXPIRE = '1h';
