const User = require('../models/User');
const { requiresVerification } = require('../services/kycPolicy');

const MESSAGES = {
  makeOffer: 'Verify your identity before quoting on loads or accepting offers',
};

// Blocks an action for roles that must be verified to take it. The status is
// read from the database rather than the login token, so an approval — or a
// revocation — takes effect immediately without logging in again.
const requireVerification = (action) => async (req, res, next) => {
  try {
    if (!requiresVerification(action, req.user.role)) return next();

    const user = await User.findById(req.user.userId).select('kycStatus');
    if (user?.kycStatus === 'approved') return next();

    res.status(403).json({
      success: false,
      code: 'KYC_REQUIRED',
      message: MESSAGES[action] || 'Verify your identity to do this',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { requireVerification };
