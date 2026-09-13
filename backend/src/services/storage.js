const cloudinary = require('cloudinary').v2;

// File storage behind a small interface (upload, delete) so the provider can
// change without touching controllers. Cloudinary is configured lazily from
// env, which keeps the rest of the server — and the test suite — working when
// no credentials are set.

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

// Phone photos are downscaled on upload (longest side 1600px, auto quality):
// plenty for judging cargo or proving a delivery, at a fraction of the storage.
const IMAGE_UPLOAD_OPTIONS = {
  resource_type: 'image',
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
};

const uploadOne = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { ...IMAGE_UPLOAD_OPTIONS, folder },
    (error, result) => {
      if (error) {
        console.error('[storage] upload failed:', error.message);
        // Cloudinary answers 4xx when the file itself is unusable.
        const clientFault = error.http_code >= 400 && error.http_code < 500;
        const err = new Error(clientFault
          ? 'One of the files could not be read as an image'
          : 'Upload to storage failed, please try again');
        err.status = clientFault ? 400 : 502;
        return reject(err);
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    },
  );
  stream.end(buffer);
});

// Best effort: a failed delete leaves an orphaned file, not a broken request,
// so it is logged for manual cleanup rather than thrown.
const deleteAssets = async (publicIds = []) => {
  if (!publicIds.length || !isConfigured()) return;
  ensureConfigured();
  await Promise.all(publicIds.map((publicId) => cloudinary.uploader
    .destroy(publicId, { resource_type: 'image', invalidate: true })
    .catch((err) => console.error(`[storage] could not delete ${publicId}, remove it manually:`, err.message))));
};

// Uploads every file or none: if any upload fails, the ones that succeeded are
// deleted so a half-finished request leaves nothing behind.
const uploadImages = async (files, { folder }) => {
  ensureConfigured();

  const results = await Promise.allSettled(files.map((file) => uploadOne(file.buffer, folder)));
  const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failure = results.find((r) => r.status === 'rejected');

  if (failure) {
    await deleteAssets(uploaded.map((photo) => photo.publicId));
    throw failure.reason;
  }
  return uploaded;
};

module.exports = { isConfigured, uploadImages, deleteAssets };
