const request = require('supertest');
const email = require('../src/services/email');
const { languageOf } = require('../src/utils/language');
const { setupTestDb, teardownTestDb, clearDb, app, uniqueEmail, TEST_PASSWORD } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

let verificationEmails;
let resetEmails;

beforeEach(async () => {
  await clearDb();
  verificationEmails = jest.spyOn(email, 'sendVerificationEmail').mockResolvedValue({ delivered: true });
  resetEmails = jest.spyOn(email, 'sendPasswordResetEmail').mockResolvedValue({ delivered: true });
});

afterEach(() => jest.restoreAllMocks());

// The 4th argument of a send is the language it was asked to use.
const languageOfLastSend = (spy) => spy.mock.calls[spy.mock.calls.length - 1][3];

const signup = (address, language) => {
  const req = request(app()).post('/api/auth/signup');
  if (language) req.set('Accept-Language', language);
  return req.send({ email: address, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' });
};

describe('languageOf', () => {
  it('reads Nepali from Accept-Language and treats everything else as English', () => {
    const of = (header) => languageOf({ headers: header === undefined ? {} : { 'accept-language': header } });
    expect(of('ne')).toBe('ne');
    expect(of('ne-NP,ne;q=0.9')).toBe('ne');
    expect(of(' NE ')).toBe('ne');
    expect(of('en-US,en;q=0.9')).toBe('en');
    expect(of('hi')).toBe('en');
    expect(of('')).toBe('en');
    expect(of(undefined)).toBe('en');
  });
});

describe('which language a code email goes out in', () => {
  it('follows the app language on signup', async () => {
    await signup(uniqueEmail(), 'ne').expect(201);
    expect(languageOfLastSend(verificationEmails)).toBe('ne');
  });

  it('is English on signup when the app sends nothing', async () => {
    await signup(uniqueEmail()).expect(201);
    expect(languageOfLastSend(verificationEmails)).toBe('en');
  });

  it('follows the app language when the code is resent', async () => {
    const address = uniqueEmail();
    const { body } = await signup(address, 'en').expect(201);

    // Past the resend wait, so the second request really sends.
    await require('mongoose').model('User').updateOne({ email: address }, { emailVerificationSentAt: new Date(Date.now() - 60 * 1000) });
    await request(app())
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${body.token}`)
      .set('Accept-Language', 'ne')
      .expect(200);

    expect(verificationEmails).toHaveBeenCalledTimes(2);
    expect(languageOfLastSend(verificationEmails)).toBe('ne');
  });

  it('follows the app language on a password reset', async () => {
    const address = uniqueEmail();
    await signup(address).expect(201);

    await request(app()).post('/api/auth/forgot-password').set('Accept-Language', 'ne').send({ email: address }).expect(200);

    expect(resetEmails).toHaveBeenCalledTimes(1);
    expect(languageOfLastSend(resetEmails)).toBe('ne');
  });
});

describe('the code emails themselves', () => {
  let sendEmail;

  beforeEach(() => {
    verificationEmails.mockRestore();
    resetEmails.mockRestore();
    sendEmail = jest.spyOn(email, 'sendEmail').mockResolvedValue({ delivered: true });
  });

  it('is written in English by default', async () => {
    await email.sendVerificationEmail('ram@example.com', 'Ram', '123456');

    const [{ subject, html }] = sendEmail.mock.calls[0];
    expect(subject).toBe('Verify your FLITO email');
    expect(html).toContain('123456');
    expect(html).toContain('Hi Ram');
  });

  it('is written in Nepali when asked, code and name intact', async () => {
    await email.sendVerificationEmail('ram@example.com', 'Ram', '123456', 'ne');

    const [{ subject, html }] = sendEmail.mock.calls[0];
    expect(subject).toBe('आफ्नो FLITO इमेल प्रमाणित गर्नुहोस्');
    expect(html).toContain('123456');
    expect(html).toContain('नमस्ते Ram');
    expect(html).not.toContain('Verify your email');
  });

  it('has a Nepali password reset email too', async () => {
    await email.sendPasswordResetEmail('ram@example.com', 'Ram', '654321', 'ne');

    const [{ subject, html }] = sendEmail.mock.calls[0];
    expect(subject).toBe('आफ्नो FLITO पासवर्ड रिसेट गर्नुहोस्');
    expect(html).toContain('654321');
  });

  it('falls back to English for a language it does not have', async () => {
    await email.sendPasswordResetEmail('ram@example.com', 'Ram', '654321', 'fr');

    expect(sendEmail.mock.calls[0][0].subject).toBe('Reset your FLITO password');
  });

  it('still escapes a name in the Nepali email', async () => {
    await email.sendVerificationEmail('x@example.com', '<script>alert(1)</script>', '123456', 'ne');

    const [{ html }] = sendEmail.mock.calls[0];
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
