const multer = require('multer');

const uploadErrorMessage = (err) => {
  const isDocument = err.field === 'document';
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return isDocument ? 'Documents must be 10 MB or smaller' : 'Each photo must be 5 MB or smaller';
    case 'LIMIT_FILE_COUNT':
      return isDocument ? 'Send one document at a time' : 'Too many files in one upload';
    case 'LIMIT_UNEXPECTED_FILE':
      return isDocument
        ? 'Send one document at a time'
        : 'Too many photos in one upload, or a file was sent under the wrong field name';
    default:
      return err.message;
  }
};

// Centralized error handler — must be registered last, after all routes.
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: uploadErrorMessage(err) });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  // A malformed id in the URL is a bad request, not a server failure.
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path === '_id' ? 'id' : err.path}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate value', field: Object.keys(err.keyValue || {})[0] });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'Not allowed by CORS' });
  }

  const status = err.status || 500;

  // Client errors are fully described in the response; only log what points to
  // a bug or an outage.
  if (status >= 500) console.error(err.stack || err.message);

  res.status(status).json({
    success: false,
    // Unexpected failures don't echo internal error text back to clients.
    message: status >= 500 && !err.status ? 'Internal server error' : err.message,
  });
};
