// Adds a stable, machine-readable `code` to an error response (and, for a
// message built from variables, an `extra` payload of those raw values) so
// the frontend can render its own Nepali translation of `message` without
// the backend ever needing to know the caller's language. `message` is
// always the same English text a plain `res.json({ message })` would have
// sent — untouched — so nothing that asserts on it needs to change.
const fail = (res, status, code, message, extra) =>
  res.status(status).json({ success: false, code, message, ...(extra ? { extra } : {}) });

module.exports = { fail };
