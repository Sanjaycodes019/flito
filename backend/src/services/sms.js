const logger = require('../utils/logger');
const axios = require('axios');

// SMS delivery for OTPs. Sparrow SMS is the common gateway for Nepal; the
// provider is swappable behind sendSms() so switching vendors touches only
// this file.
//
// With no credentials configured we fall back to logging the message to the
// server console, which keeps local development working without a paid
// account. That fallback is refused in production (see validateEnv): shipping
// without a real gateway means nobody can receive a code and log in.

const SPARROW_ENDPOINT = 'http://api.sparrowsms.com/v2/sms/';

const isConfigured = () => Boolean(process.env.SPARROW_SMS_TOKEN && process.env.SPARROW_SMS_FROM);

// Sparrow expects local 10-digit numbers, not the +977 E.164 form we store.
const toLocalNumber = (phone) => String(phone).replace(/^\+977/, '');

const sendViaSparrow = async (phone, text) => {
  const { data } = await axios.post(
    SPARROW_ENDPOINT,
    {
      token: process.env.SPARROW_SMS_TOKEN,
      from: process.env.SPARROW_SMS_FROM,
      to: toLocalNumber(phone),
      text,
    },
    { timeout: 10000 }
  );
  return data;
};

exports.isConfigured = isConfigured;

exports.sendSms = async (phone, text) => {
  if (!isConfigured()) {
    logger.info(`[sms:dev] to ${phone}: ${text}`);
    return { delivered: false, dev: true };
  }

  try {
    const response = await sendViaSparrow(phone, text);
    return { delivered: true, response };
  } catch (error) {
    // Surface the failure to the caller but never leak the token.
    const detail = error.response?.data || error.message;
    logger.error(`[sms] delivery to ${phone} failed:`, detail);
    throw new Error('Could not send the verification code, please try again');
  }
};

exports.sendOtpSms = (phone, otp) =>
  exports.sendSms(phone, `${otp} is your FLITO verification code. It expires in 5 minutes.`);
