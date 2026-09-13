const axios = require('axios');

// Talks to Expo's push API directly over HTTP rather than via the
// expo-server-sdk package: that package's current build ships ESM-only and
// breaks under Jest/CommonJS without extra transform config, for a REST call
// simple enough not to need a client library at all.
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Matches what Expo's SDK itself validates client-side: "ExponentPushToken[...]"
// (or the newer "ExpoPushToken[...]"), nothing else.
const EXPO_PUSH_TOKEN_REGEX = /^(Exponent|Expo)PushToken\[.+\]$/;
const isExpoPushToken = (value) => typeof value === 'string' && EXPO_PUSH_TOKEN_REGEX.test(value);

// Fire-and-forget push, alongside the socket.io event already sent for the
// same change. Push reaches a backgrounded/closed app; the socket event
// reaches an open one instantly — the two are complementary, not a fallback
// chain for each other.
//
// Deliberately no receipt-checking (Expo's second async step, recommended
// ~15 minutes after sending, to catch DeviceNotRegistered etc. that the
// initial response can't see). Skipping it means a token stale for months
// keeps being tried until it fails the upfront format check or the
// immediate-error case handled below — acceptable for launch; revisit if
// push volume grows enough to matter.
const sendPushToUser = async (userId, { title, body, data = {} }) => {
  try {
    const User = require('../models/User'); // required lazily to dodge a require cycle with models that pull in services
    const user = await User.findById(userId).select('pushToken');
    const token = user?.pushToken;
    if (!token) return;

    if (!isExpoPushToken(token)) {
      // Not a real Expo token (e.g. leftover test data) — drop it rather than
      // fail on every future send for this user.
      await User.updateOne({ _id: userId }, { $unset: { pushToken: '' } });
      return;
    }

    const { data: result } = await axios.post(
      EXPO_PUSH_ENDPOINT,
      [{ to: token, sound: 'default', title, body, data, priority: 'high' }],
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 10000 },
    );
    const ticket = result?.data?.[0];

    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      await User.updateOne({ _id: userId }, { $unset: { pushToken: '' } });
    }
  } catch (error) {
    // A failed push should never break the request that triggered it.
    console.error(`[push] send to user ${userId} failed:`, error.message);
  }
};

// Convenience for the common case of notifying several parties on one event
// (e.g. every party on a booking) without awaiting each other.
const sendPushToUsers = (userIds, notification) =>
  Promise.all([...new Set(userIds.filter(Boolean).map(String))].map((id) => sendPushToUser(id, notification)));

module.exports = { sendPushToUser, sendPushToUsers, isExpoPushToken };
