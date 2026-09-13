const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateProfileUpdate, validatePushToken } = require('../middleware/validators');
const { document } = require('../middleware/upload');

// Admins don't verify their own identity through this flow.
const VERIFYING_ROLES = ['shipper', 'owner', 'driver'];

router.use(authMiddleware);

router.get('/lookup', requireRole('owner', 'admin'), usersController.lookupDriver);

router.patch('/me', validateProfileUpdate, usersController.updateProfile);

router.patch('/me/push-token', validatePushToken, usersController.registerPushToken);
router.delete('/me/push-token', usersController.unregisterPushToken);

router.get('/me/kyc', requireRole(...VERIFYING_ROLES), usersController.getMyKyc);
// Status and storage are checked before any file bytes are accepted.
router.post(
  '/me/kyc/documents',
  requireRole(...VERIFYING_ROLES),
  usersController.loadEditableKycUser,
  document(),
  usersController.uploadKycDocument,
);
router.delete(
  '/me/kyc/documents/:docId',
  requireRole(...VERIFYING_ROLES),
  usersController.loadEditableKycUser,
  usersController.deleteKycDocument,
);
router.post('/me/kyc/submit', requireRole(...VERIFYING_ROLES), usersController.submitKyc);

module.exports = router;
