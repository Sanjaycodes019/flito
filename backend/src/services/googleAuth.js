// Verifies a Google ID token the frontend obtained via expo-auth-session.
// The token is verified here, server-side, against Google's public keys and
// our own client id, rather than trusted client-side: a client could
// otherwise hand us any token and claim to be anyone.
//
// GOOGLE_CLIENT_ID is not required to boot the server (unlike
// SPARROW_SMS_TOKEN/BREVO_API_KEY): Google sign-in is an enhancement, not a
// requirement, so the rest of the app works with it unset. isConfigured()
// lets the route return a clear "not configured" error instead of a
// confusing token-verification failure.

const isConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID);

// Lazily required so a deployment that never uses Google auth doesn't need
// the package installed, matching how services/otpStore.js treats `redis`.
let clientPromise;
const getClient = () => {
  if (!clientPromise) {
    const { OAuth2Client } = require('google-auth-library');
    clientPromise = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return clientPromise;
};

exports.isConfigured = isConfigured;

// Returns { googleId, email, emailVerified, firstName, lastName } for a
// valid token, or throws if the token is invalid, expired, or was not
// issued for our client id.
exports.verifyGoogleIdToken = async (idToken) => {
  if (!isConfigured()) {
    const error = new Error('Google sign-in is not configured on this server yet');
    error.statusCode = 503;
    throw error;
  }

  const client = getClient();
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  } catch (err) {
    // Malformed, expired, wrongly signed, or issued for a different client:
    // all mean "not a valid sign-in", a 401, never an opaque 500.
    const error = new Error('Google sign-in could not be verified, please try again');
    error.statusCode = 401;
    throw error;
  }
  const payload = ticket.getPayload();

  if (!payload?.email) {
    const error = new Error('Google did not return an email address for this account');
    error.statusCode = 400;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    firstName: payload.given_name || '',
    lastName: payload.family_name || '',
  };
};
