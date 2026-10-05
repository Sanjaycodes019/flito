const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');
const fleetDrivers = require('../controllers/fleetDriversController');
const payoutMethods = require('../controllers/payoutMethodsController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const {
  validateProfileUpdate, validatePushToken, validateAddDriver, validateSetPin, validatePayoutMethod,
} = require('../middleware/validators');
const { document, avatar, qrCode } = require('../middleware/upload');

// Admins don't verify their own identity through this flow.
const VERIFYING_ROLES = ['shipper', 'owner', 'driver'];

router.use(authMiddleware);

router.get('/lookup', requireRole('owner', 'admin'), usersController.lookupDriver);

router.patch('/me', validateProfileUpdate, usersController.updateProfile);
router.patch('/me/pin', validateSetPin, usersController.setPin);

router.get('/me/notifications', usersController.listNotifications);
router.post('/me/notifications/read', usersController.markNotificationsRead);

router.patch('/me/push-token', validatePushToken, usersController.registerPushToken);
router.delete('/me/push-token', usersController.unregisterPushToken);

// Storage is checked before any file bytes are accepted.
router.post('/me/avatar', usersController.requireStorage, avatar(), usersController.uploadAvatar);
router.delete('/me/avatar', usersController.deleteAvatar);

// An owner's own drivers: added with a name and phone, logging in by PIN.
router.get('/me/drivers', requireRole('owner'), fleetDrivers.listDrivers);
router.post('/me/drivers', requireRole('owner'), validateAddDriver, fleetDrivers.addDriver);
router.post('/me/drivers/:id/pin', requireRole('owner'), fleetDrivers.resetPin);
// Checked before any file bytes are accepted.
router.post(
  '/me/drivers/:id/license',
  requireRole('owner'),
  fleetDrivers.loadDriverForLicense,
  document(),
  fleetDrivers.uploadLicense,
);

// How an owner takes payment: bank accounts and wallets, each with an
// optional QR image in the multipart field "qr".
router.get('/me/payout-methods', requireRole('owner'), payoutMethods.listPayoutMethods);
router.post('/me/payout-methods', requireRole('owner'), qrCode(), validatePayoutMethod, payoutMethods.addPayoutMethod);
router.patch(
  '/me/payout-methods/:methodId',
  requireRole('owner'),
  qrCode(),
  validatePayoutMethod,
  payoutMethods.updatePayoutMethod,
);
router.post('/me/payout-methods/:methodId/primary', requireRole('owner'), payoutMethods.setPrimaryPayoutMethod);
router.delete('/me/payout-methods/:methodId', requireRole('owner'), payoutMethods.deletePayoutMethod);

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
