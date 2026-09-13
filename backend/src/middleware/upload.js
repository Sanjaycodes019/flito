const multer = require('multer');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Files are held in memory only long enough to stream to storage — nothing is
// written to the server's disk. The size and count limits bound that memory.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    const err = new Error('Only JPEG, PNG, WebP or HEIC images are allowed');
    err.status = 400;
    cb(err);
  },
});

// Parses up to `max` files sent in the multipart field "photos".
const photos = (max) => imageUpload.array('photos', max);

module.exports = { photos, MAX_IMAGE_BYTES };
