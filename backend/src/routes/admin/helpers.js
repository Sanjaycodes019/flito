// Shared by every admin resource router. Adding a new admin section means a
// new file in this folder plus one line in index.js; nothing here changes.

// Every admin list is newest-first and paginated the same way: ?page=1&limit=20.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const paginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A case-insensitive "contains" match of ?q= against the given fields, or
// null when there is no search text. Escaped, so `q` is never a regex.
const searchClause = (query, fields) => {
  const text = typeof query.q === 'string' ? query.q.trim().slice(0, 80) : '';
  if (!text) return null;
  const pattern = new RegExp(escapeRegex(text), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
};

// `?field=value` as a filter, only when the value is one the model allows.
// Anything else is ignored rather than turned into an empty result.
const enumFilter = (query, field, allowed, target = field) => (
  allowed.includes(query[field]) ? { [target]: query[field] } : null
);

// Combines whichever clauses are present into one Mongo filter.
const allOf = (...clauses) => {
  const present = clauses.filter(Boolean);
  return present.length ? { $and: present } : {};
};

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

// A review decision from the request body, or an error for the admin.
// Without a reason a rejected user has no idea what to fix.
const readDecision = (body, who) => {
  const { decision } = body;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!['approved', 'rejected'].includes(decision)) {
    return { error: 'decision must be approved or rejected', code: 'ADMIN_INVALID_DECISION' };
  }
  if (decision === 'rejected' && reason.length < MIN_REASON_LENGTH) {
    return {
      error: `Give the ${who} a reason for the rejection (at least ${MIN_REASON_LENGTH} characters) so they know what to fix`,
      code: 'ADMIN_REJECTION_REASON_TOO_SHORT',
      extra: { who, minLength: MIN_REASON_LENGTH },
    };
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return {
      error: `The reason must be at most ${MAX_REASON_LENGTH} characters`,
      code: 'ADMIN_REJECTION_REASON_TOO_LONG',
      extra: { maxLength: MAX_REASON_LENGTH },
    };
  }
  return { decision, reason };
};

module.exports = { paginationParams, paginationMeta, searchClause, enumFilter, allOf, readDecision };
