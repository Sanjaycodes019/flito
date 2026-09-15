const multer = require('multer');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
// A drawn signature is a small canvas PNG, generous for that, tiny next to a
// photo, so a much lower limit still can't be used to smuggle in a real image.
const MAX_SIGNATURE_BYTES = 1 * 1024 * 1024;

const onlyTypes = (allowed, message) => (req, file, cb) => {
  if (allowed.includes(file.mimetype)) return cb(null, true);
  const err = new Error(message);
  err.status = 400;
  cb(err);
};

// Files are held in memory only long enough to stream to storage. Nothing is
// written to the server's disk. Size and count limits bound that memory.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: onlyTypes(IMAGE_TYPES, 'Only JPEG, PNG, WebP or HEIC images are allowed'),
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter: onlyTypes(DOCUMENT_TYPES, 'Only images (JPEG, PNG, WebP, HEIC) or PDF files are allowed'),
});

// Up to `max` images in the multipart field "photos".
const photos = (max) => imageUpload.array('photos', max);

// One image or PDF in the multipart field "document".
const document = () => documentUpload.single('document');

const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIGNATURE_BYTES, files: 1 },
  fileFilter: onlyTypes(IMAGE_TYPES, 'Only JPEG, PNG, WebP or HEIC images are allowed'),
});

// One image in the multipart field "signature".
const signature = () => signatureUpload.single('signature');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: onlyTypes(IMAGE_TYPES, 'Only JPEG, PNG, WebP or HEIC images are allowed'),
});

// One image in the multipart field "avatar" (a profile photo).
const avatar = () => avatarUpload.single('avatar');

module.exports = { photos, document, signature, avatar, MAX_IMAGE_BYTES, MAX_DOCUMENT_BYTES, MAX_SIGNATURE_BYTES };
