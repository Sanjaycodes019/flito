const cloudinary = require('cloudinary').v2;

// File storage behind a small interface so the provider can change without
// touching controllers. Cloudinary is configured lazily from env, which keeps
// the rest of the server, and the test suite, working with no credentials.

const isConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET
);

let initialized = false;

const ensureConfigured = () => {
  if (!isConfigured()) {
    const err = new Error('File uploads are not configured on this server');
    err.status = 503;
    throw err;
  }
  if (!initialized) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    initialized = true;
  }
};

const toStorageError = (error, unreadableMessage) => {
  console.error('[storage] upload failed:', error.message);
  // Cloudinary answers 4xx when the file itself is unusable.
  const clientFault = error.http_code >= 400 && error.http_code < 500;
  const err = new Error(clientFault ? unreadableMessage : 'Upload to storage failed, please try again');
  err.status = clientFault ? 400 : 502;
  return err;
};

const streamUpload = (buffer, options, unreadableMessage) => new Promise((resolve, reject) => {
  cloudinary.uploader
    .upload_stream(options, (error, result) => (
      error ? reject(toStorageError(error, unreadableMessage)) : resolve(result)
    ))
    .end(buffer);
});

// Best effort: a failed delete leaves an orphaned file, not a broken request,
// so it is logged for manual cleanup rather than thrown.
const deleteAssets = async (publicIds = [], { type = 'upload' } = {}) => {
  if (!publicIds.length || !isConfigured()) return;
  ensureConfigured();
  await Promise.all(publicIds.map((publicId) => cloudinary.uploader
    .destroy(publicId, { resource_type: 'image', type, invalidate: true })
    .catch((err) => console.error(`[storage] could not delete ${publicId}, remove it manually:`, err.message))));
};

// ── Public photos (loads, proof of delivery) ─────────────────────────────

// Phone photos are downscaled on upload (longest side 1600px, auto quality):
// plenty for judging cargo or proving a delivery, at a fraction of the storage.
const IMAGE_UPLOAD_OPTIONS = {
  resource_type: 'image',
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
};

// Uploads every file or none: if any upload fails, the ones that succeeded are
// deleted so a half-finished request leaves nothing behind.
const uploadImages = async (files, { folder }) => {
  ensureConfigured();

  const results = await Promise.allSettled(files.map((file) => streamUpload(
    file.buffer,
    { ...IMAGE_UPLOAD_OPTIONS, folder },
    'One of the files could not be read as an image',
  )));
  const uploaded = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => ({ url: r.value.secure_url, publicId: r.value.public_id }));
  const failure = results.find((r) => r.status === 'rejected');

  if (failure) {
    await deleteAssets(uploaded.map((photo) => photo.publicId));
    throw failure.reason;
  }
  return uploaded;
};

// ── Private documents (KYC) ──────────────────────────────────────────────

// Identity documents are stored as "authenticated" assets: their plain delivery
// URL is refused (401), so a file is reachable only through a signed, expiring
// download link generated here. Originals are kept untouched so they stay
// legible for review.
const DOCUMENT_UPLOAD_OPTIONS = {
  resource_type: 'image',
  type: 'authenticated',
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'],
};

const uploadPrivateDocument = async (file, { folder }) => {
  ensureConfigured();
  const result = await streamUpload(
    file.buffer,
    { ...DOCUMENT_UPLOAD_OPTIONS, folder },
    'That file could not be read as an image or PDF',
  );
  return { publicId: result.public_id, format: result.format, bytes: result.bytes };
};

// Checked against the live API: these links are refused (401) once expires_at
// passes, allowing only a few seconds of clock skew, and when altered.
const DOCUMENT_LINK_TTL_SECONDS = 10 * 60;

const privateDocumentUrl = (publicId, format, { ttlSeconds = DOCUMENT_LINK_TTL_SECONDS } = {}) => {
  ensureConfigured();
  return cloudinary.utils.private_download_url(publicId, format, {
    type: 'authenticated',
    resource_type: 'image',
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
};

module.exports = {
  isConfigured,
  uploadImages,
  uploadPrivateDocument,
  privateDocumentUrl,
  deleteAssets,
};
