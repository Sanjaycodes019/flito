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
    const err = new Error('Could not send the email right now, please try again');
    err.status = 502;
    throw err;
  }
};

// A name typed at signup ends up in an HTML email, so it's escaped first.
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

// A simple, on-brand HTML shell. No external assets or web fonts: some
// mail clients block remote images by default, and a code the user is about
// to retype somewhere else does not need to look like a marketing email.
const codeEmail = (heading, intro, code, footer, signature) => `
  <div style="font-family: -apple-system, Roboto, Helvetica, 'Noto Sans Devanagari', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1E242B; margin-bottom: 4px;">${heading}</h2>
    <p style="color: #5D6E6F; font-size: 14px; margin-top: 0;">${intro}</p>
    <div style="background: #F4F6F8; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #995F00;">${code}</span>
    </div>
    <p style="color: #5D6E6F; font-size: 13px;">${footer}</p>
    <p style="color: #95A5A6; font-size: 12px; margin-top: 24px;">${signature}</p>
  </div>
`;

// Copy per language. `intro` is a function so the greeting can carry the
// (already escaped) name in whichever word order the language wants.
const COPY = {
  en: {
    greetingFallback: 'there',
    verifyEmail: {
      subject: 'Verify your FLITO email',
      heading: 'Verify your email',
      intro: (name) => `Hi ${name}, enter this code in the app to verify your email address.`,
      footer: 'This code expires in 15 minutes. If you did not create a FLITO account, you can ignore this email.',
    },
    resetPassword: {
      subject: 'Reset your FLITO password',
      heading: 'Reset your password',
      intro: (name) => `Hi ${name}, enter this code in the app to choose a new password.`,
      footer: 'This code expires in 15 minutes. If you did not request this, you can ignore this email, your password will not change.',
    },
    signature: 'FLITO, Freight & Load Interchange for Truck Operations',
  },
  ne: {
    greetingFallback: 'तपाईं',
    verifyEmail: {
      subject: 'आफ्नो FLITO इमेल प्रमाणित गर्नुहोस्',
      heading: 'आफ्नो इमेल प्रमाणित गर्नुहोस्',
      intro: (name) => `नमस्ते ${name}, आफ्नो इमेल ठेगाना प्रमाणित गर्न यो कोड एपमा हाल्नुहोस्।`,
      footer: 'यो कोडको म्याद १५ मिनेटमा सकिन्छ। तपाईंले FLITO खाता बनाउनुभएको होइन भने यो इमेललाई बेवास्ता गर्न सक्नुहुन्छ।',
    },
    resetPassword: {
      subject: 'आफ्नो FLITO पासवर्ड रिसेट गर्नुहोस्',
      heading: 'आफ्नो पासवर्ड रिसेट गर्नुहोस्',
      intro: (name) => `नमस्ते ${name}, नयाँ पासवर्ड छान्न यो कोड एपमा हाल्नुहोस्।`,
      footer: 'यो कोडको म्याद १५ मिनेटमा सकिन्छ। तपाईंले यो अनुरोध गर्नुभएको होइन भने यो इमेललाई बेवास्ता गर्न सक्नुहुन्छ, तपाईंको पासवर्ड परिवर्तन हुनेछैन।',
    },
    signature: 'FLITO, ट्रक सञ्चालनका लागि मालवाहक ओसारपसार सेवा',
  },
};

const codeEmailFor = (kind, name, code, language) => {
  const copy = COPY[language] || COPY.en;
  const part = copy[kind];
  return {
    subject: part.subject,
    html: codeEmail(part.heading, part.intro(escapeHtml(name || copy.greetingFallback)), code, part.footer, copy.signature),
  };
};

// `language` is 'en' (the default) or 'ne'.
exports.sendVerificationEmail = (to, name, code, language = 'en') =>
  exports.sendEmail({ to, toName: name, ...codeEmailFor('verifyEmail', name, code, language) });

exports.sendPasswordResetEmail = (to, name, code, language = 'en') =>
  exports.sendEmail({ to, toName: name, ...codeEmailFor('resetPassword', name, code, language) });
