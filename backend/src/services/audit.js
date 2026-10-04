const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// How many history entries a record's admin page shows.
const HISTORY_LIMIT = 30;

// Records an admin's change. The change itself has already happened, so a
// failure to write the log is reported but never undoes or fails the request.
const recordAdminAction = async (req, { action, targetType, targetId, reason, meta }) => {
  try {
    await AuditLog.create({ actorId: req.user.userId, action, targetType, targetId, reason: reason || undefined, meta });
  } catch (error) {
    logger.error(`[audit] could not record ${action} on ${targetType} ${targetId}: ${error.message}`);
  }
};

// A record's history, newest first, with who made each change.
const historyFor = async (targetType, targetId, limit = HISTORY_LIMIT) => {
  const entries = await AuditLog.find({ targetType, targetId })
    .populate('actorId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return entries.map(({ _id, action, reason, meta, createdAt, actorId }) => ({
    _id,
    action,
    reason,
    meta,
    at: createdAt,
    by: actorId
      ? { _id: actorId._id, name: [actorId.firstName, actorId.lastName].filter(Boolean).join(' ') || actorId.email }
      : null,
  }));
};

module.exports = { HISTORY_LIMIT, recordAdminAction, historyFor };
