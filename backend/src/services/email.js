const axios = require('axios');

// Transactional email for verification codes and password resets. Brevo
// (formerly Sendinblue) is the provider; swappable behind sendEmail() the
// same way sms.js wraps Sparrow, so switching vendors touches only this file.
//
// With no API key configured we fall back to logging the email to the server
// console, which keeps local development working without a paid account.
// That fallback is refused in production (see validateEnv): shipping without
// a real provider means nobody can verify an email or recover a password.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const isConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);

const sendViaBrevo = async ({ to, toName, subject, html }) => {
  const { data } = await axios.post(
    BREVO_ENDPOINT,
    {
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'FLITO' },
      to: [{ email: to, name: toName || undefined }],
      subject,
      htmlContent: html,
    },
    {
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );
  return data;
};

exports.isConfigured = isConfigured;

exports.sendEmail = async ({ to, toName, subject, html }) => {
  if (!isConfigured()) {
    console.log(`[email:dev] to ${to}: ${subject}\n${html.replace(/<[^>]+>/g, ' ').trim()}`);
    return { delivered: false, dev: true };
  }

  try {
    const response = await sendViaBrevo({ to, toName, subject, html });
    return { delivered: true, response };
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error(`[email] delivery to ${to} failed:`, detail);
    throw new Error('Could not send the email right now, please try again');
  }
};

// A simple, on-brand HTML shell. No external assets or web fonts: some
// mail clients block remote images by default, and a code the user is about
// to retype somewhere else does not need to look like a marketing email.
const codeEmail = (heading, intro, code, footer) => `
  <div style="font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1E242B; margin-bottom: 4px;">${heading}</h2>
    <p style="color: #5D6E6F; font-size: 14px; margin-top: 0;">${intro}</p>
    <div style="background: #F4F6F8; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #995F00;">${code}</span>
    </div>
    <p style="color: #5D6E6F; font-size: 13px;">${footer}</p>
    <p style="color: #95A5A6; font-size: 12px; margin-top: 24px;">FLITO, Freight & Load Interchange for Truck Operations</p>
  </div>
`;

exports.sendVerificationEmail = (to, name, code) =>
  exports.sendEmail({
    to,
    toName: name,
    subject: 'Verify your FLITO email',
    html: codeEmail(
      'Verify your email',
      `Hi ${name || 'there'}, enter this code in the app to verify your email address.`,
      code,
      'This code expires in 15 minutes. If you did not create a FLITO account, you can ignore this email.'
    ),
  });

exports.sendPasswordResetEmail = (to, name, code) =>
  exports.sendEmail({
    to,
    toName: name,
    subject: 'Reset your FLITO password',
    html: codeEmail(
      'Reset your password',
      `Hi ${name || 'there'}, enter this code in the app to choose a new password.`,
      code,
      'This code expires in 15 minutes. If you did not request this, you can ignore this email, your password will not change.'
    ),
  });
