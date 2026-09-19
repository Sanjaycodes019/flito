const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { fail } = require('../utils/respond');

const authMiddleware = async (req, res, next) => {
  let decoded;
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return fail(res, 401, 'AUTH_NO_TOKEN', 'No token provided');
    }

    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return fail(res, 401, 'AUTH_INVALID_TOKEN', 'Invalid or expired token');
  }

  try {
    // The account's status is read from the database, not the token, so a
    // suspension or ban takes effect on the very next request instead of when
    // the token runs out. A token for an account that no longer exists is no
    // good either.
    const account = await User.findById(decoded.userId).select('status');
    if (!account) {
      return fail(res, 401, 'AUTH_INVALID_TOKEN', 'Invalid or expired token');
    }
    const status = account.status || 'active';
    if (status !== 'active') {
      return fail(res, 403, 'AUTH_ACCOUNT_STATUS', `Account is ${status}`, { status });
    }

    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    next(error);
  }
};

// Restrict a route to one or more roles, e.g. requireRole('owner', 'admin')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return fail(res, 403, 'AUTH_INSUFFICIENT_ROLE', 'Forbidden: insufficient role');
  }
  next();
};

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
