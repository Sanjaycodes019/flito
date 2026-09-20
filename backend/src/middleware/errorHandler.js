const logger = require('../utils/logger');
const multer = require('multer');
const { fail } = require('../utils/respond');

const UPLOAD_ERROR_CODES = {
  LIMIT_FILE_SIZE: { document: 'UPLOAD_DOCUMENT_TOO_LARGE', signature: 'UPLOAD_SIGNATURE_TOO_LARGE', photo: 'UPLOAD_PHOTO_TOO_LARGE' },
  LIMIT_FILE_COUNT: { document: 'UPLOAD_ONE_AT_A_TIME', signature: 'UPLOAD_ONE_AT_A_TIME', photo: 'UPLOAD_TOO_MANY_FILES' },
  LIMIT_UNEXPECTED_FILE: { document: 'UPLOAD_ONE_AT_A_TIME', signature: 'UPLOAD_ONE_AT_A_TIME', photo: 'UPLOAD_UNEXPECTED_FIELD' },
};

const uploadError = (err) => {
  const kind = err.field === 'document' ? 'document' : err.field === 'signature' ? 'signature' : 'photo';
  const message = (() => {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        if (kind === 'document') return 'Documents must be 10 MB or smaller';
        if (kind === 'signature') return 'Signature image must be 1 MB or smaller';
        return 'Each photo must be 5 MB or smaller';
      case 'LIMIT_FILE_COUNT':
        return kind !== 'photo' ? 'Send one file at a time' : 'Too many files in one upload';
      case 'LIMIT_UNEXPECTED_FILE':
        return kind !== 'photo'
          ? 'Send one file at a time'
          : 'Too many photos in one upload, or a file was sent under the wrong field name';
      default:
        return err.message;
    }
  })();
  const code = UPLOAD_ERROR_CODES[err.code]?.[kind] || 'UPLOAD_ERROR';
  return { code, message };
};

// Centralized error handler. Must be registered last, after all routes.
module.exports = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const { code, message } = uploadError(err);
    return fail(res, 400, code, message);
  }
  if (err.name === 'ValidationError') {
    return fail(res, 400, 'MONGOOSE_VALIDATION_ERROR', err.message);
  }
  // A malformed id in the URL is a bad request, not a server failure.
  if (err.name === 'CastError') {
    const field = err.path === '_id' ? 'id' : err.path;
    return fail(res, 400, 'INVALID_ID', `Invalid ${field}`, { field });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ success: false, code: 'DUPLICATE_VALUE', message: 'Duplicate value', field });
  }
  if (err.message === 'Not allowed by CORS') {
    return fail(res, 403, 'CORS_NOT_ALLOWED', 'Not allowed by CORS');
  }

  const status = err.status || 500;

  // Client errors are fully described in the response; only log what points to
  // a bug or an outage.
  if (status >= 500) logger.error(err.stack || err.message);

  // Unexpected failures don't echo internal error text back to clients.
  const message = status >= 500 && !err.status ? 'Internal server error' : err.message;
  // `errorCode`, not `code`: a thrown Error's `.code` is often a system or
  // driver code (ENOENT, a Mongo code...), not one of ours to translate.
  const code = status >= 500 && !err.status ? 'INTERNAL_SERVER_ERROR' : (err.errorCode || 'ERROR');
  fail(res, status, code, message, err.extra);
};
