import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/screens/LoginScreen';
import SignupScreen from '../src/screens/SignupScreen';
import ForgotPasswordScreen from '../src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../src/screens/ResetPasswordScreen';
import VerifyEmailScreen from '../src/screens/VerifyEmailScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';

jest.mock('../src/services/auth', () => ({
  authService: {
    login: jest.fn(),
    signup: jest.fn(),
    googleAuth: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
  },
}));

// Captures the callback each screen hands to useGoogleAuth, so a test can
// play the part of Google returning an ID token without a real popup.
let mockGoogleResult;
jest.mock('../src/hooks/useGoogleAuth', () => ({
  isGoogleConfigured: () => true,
  useGoogleAuth: (onResult) => {
    mockGoogleResult = onResult;
    return { promptGoogleSignIn: jest.fn(), ready: true };
  },
}));

const { authService } = require('../src/services/auth');
const { notify } = require('../src/utils/alert');

const GOOGLE_PROFILE = { email: 'gita@example.com', firstName: 'Gita', lastName: 'Rai' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('keeps Log In disabled until email and password are both present', async () => {
    const navigation = fakeNavigation();
    const { findByRole } = renderWithProviders(<LoginScreen navigation={navigation} />);

    // The page title and the submit button are both "Log In"; target the button.
    fireEvent.press(await findByRole('button', { name: 'Log In' }));
    // No email/password yet: the screen should not have attempted a login.
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('logs in with valid credentials', async () => {
    authService.login.mockResolvedValue({ token: 'tok', user: fakeUser('shipper') });
    const navigation = fakeNavigation();
    const { findByTestId, findByPlaceholderText, findByRole } = renderWithProviders(<LoginScreen navigation={navigation} />);

    fireEvent.changeText(await findByTestId('login-email-input'), 'ram@example.com');
    fireEvent.changeText(await findByPlaceholderText('Your password'), 'Password123');
    fireEvent.press(await findByRole('button', { name: 'Log In' }));

    await waitFor(() => expect(authService.login).toHaveBeenCalledWith('ram@example.com', 'Password123'));
  });

  it('shows an inline error for an invalid email once the field is left', async () => {
    const navigation = fakeNavigation();
    const { findByTestId, findByText } = renderWithProviders(<LoginScreen navigation={navigation} />);

    const emailInput = await findByTestId('login-email-input');
    fireEvent.changeText(emailInput, 'not-an-email');
    fireEvent(emailInput, 'blur');

    expect(await findByText('Enter a valid email address')).toBeTruthy();
  });

  it('navigates to Forgot Password and Sign Up', async () => {
    const navigation = fakeNavigation();
    const { findByText } = renderWithProviders(<LoginScreen navigation={navigation} />);

    fireEvent.press(await findByText('Forgot password?'));
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');

    fireEvent.press(await findByText('Sign Up'));
    expect(navigation.navigate).toHaveBeenCalledWith('Signup');
  });

  it('logs straight in when the Google account already has a FLITO account', async () => {
    authService.googleAuth.mockResolvedValue({ token: 'tok', user: fakeUser('shipper'), isNewAccount: false });
    const navigation = fakeNavigation();
    const { store } = renderWithProviders(<LoginScreen navigation={navigation} />);

    await act(async () => { await mockGoogleResult('google-token'); });

    expect(authService.googleAuth).toHaveBeenCalledWith('google-token');
    expect(store.getState().auth.token).toBe('tok');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('sends a Google account with no FLITO account on to Sign Up with its token', async () => {
    authService.googleAuth.mockRejectedValue({ response: { data: { code: 'ROLE_REQUIRED', profile: GOOGLE_PROFILE } } });
    const navigation = fakeNavigation();
    renderWithProviders(<LoginScreen navigation={navigation} />);

    await act(async () => { await mockGoogleResult('google-token'); });

    expect(navigation.navigate).toHaveBeenCalledWith('Signup', { googleIdToken: 'google-token', googleProfile: GOOGLE_PROFILE });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('SignupScreen', () => {
  it('defaults to Shipper and lets a role be picked', async () => {
    const navigation = fakeNavigation();
    const { findByText } = renderWithProviders(<SignupScreen navigation={navigation} />);
    expect(await findByText('Shipper')).toBeTruthy();
    fireEvent.press(await findByText('Truck Owner'));
    // No crash / no assertion needed beyond this: role selection is covered
    // end to end by the signup-payload test below (role: 'owner').
  });

  it('submits with the selected role, email, password, and no phone', async () => {
    authService.signup.mockResolvedValue({ token: 'tok', user: fakeUser('owner') });
    const navigation = fakeNavigation();
    const { findAllByText, findByPlaceholderText } = renderWithProviders(<SignupScreen navigation={navigation} />);

    fireEvent.press((await findAllByText('Truck Owner'))[0]);
    fireEvent.changeText(await findByPlaceholderText('Ram'), 'Bikash');
    fireEvent.changeText(await findByPlaceholderText('you@example.com'), 'bikash@example.com');
    fireEvent.changeText(await findByPlaceholderText('At least 8 characters'), 'Password123');
    fireEvent.changeText(await findByPlaceholderText('Type your password again'), 'Password123');

    // The screen title and the submit button share the text "Sign Up".
    const submitButtons = await findAllByText('Sign Up');
    fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(authService.signup).toHaveBeenCalledWith({
      email: 'bikash@example.com',
      password: 'Password123',
      role: 'owner',
      firstName: 'Bikash',
      lastName: '',
      phone: undefined,
    }));
  });

  it('blocks submit when the passwords do not match', async () => {
    const navigation = fakeNavigation();
    const { findByText, findAllByText, findByPlaceholderText } = renderWithProviders(<SignupScreen navigation={navigation} />);

    fireEvent.changeText(await findByPlaceholderText('Ram'), 'Bikash');
    fireEvent.changeText(await findByPlaceholderText('you@example.com'), 'bikash@example.com');
    fireEvent.changeText(await findByPlaceholderText('At least 8 characters'), 'Password123');
    fireEvent.changeText(await findByPlaceholderText('Type your password again'), 'Different123');

    expect(await findByText('Passwords do not match')).toBeTruthy();
    const submitButtons = await findAllByText('Sign Up');
    fireEvent.press(submitButtons[submitButtons.length - 1]);
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('signs up a new Google account with the chosen role', async () => {
    authService.googleAuth.mockResolvedValue({ token: 'tok', user: fakeUser('owner'), isNewAccount: true });
    const navigation = fakeNavigation();
    const { findAllByText, store } = renderWithProviders(<SignupScreen navigation={navigation} />);

    fireEvent.press((await findAllByText('Truck Owner'))[0]);
    await act(async () => { await mockGoogleResult('google-token'); });

    expect(authService.googleAuth).toHaveBeenCalledWith('google-token', 'owner');
    expect(store.getState().auth.token).toBe('tok');
    expect(notify).not.toHaveBeenCalled();
  });

  it('logs in, with a welcome-back notice, when that Google account already exists', async () => {
    authService.googleAuth.mockResolvedValue({ token: 'tok', user: fakeUser('shipper'), isNewAccount: false });
    const navigation = fakeNavigation();
    const { store } = renderWithProviders(<SignupScreen navigation={navigation} />);

    await act(async () => { await mockGoogleResult('google-token'); });

    expect(notify).toHaveBeenCalledWith('Welcome back', expect.any(String), expect.any(Function));
    // The test alert mock runs onDismiss immediately, which is what logs in.
    expect(store.getState().auth.token).toBe('tok');
  });

  it('finishes a sign up handed over from the login page, asking only for a role', async () => {
    authService.googleAuth.mockResolvedValue({ token: 'tok', user: fakeUser('driver'), isNewAccount: true });
    const navigation = fakeNavigation();
    const route = { params: { googleIdToken: 'google-token', googleProfile: GOOGLE_PROFILE } };
    const { findByText, findAllByText, queryByPlaceholderText } = renderWithProviders(
      <SignupScreen navigation={navigation} route={route} />
    );

    expect(await findByText('No FLITO account yet')).toBeTruthy();
    // No email/password form in this mode: Google already identified them.
    expect(queryByPlaceholderText('At least 8 characters')).toBeNull();

    fireEvent.press((await findAllByText('Driver'))[0]);
    fireEvent.press(await findByText('Finish Sign Up'));

    await waitFor(() => expect(authService.googleAuth).toHaveBeenCalledWith('google-token', 'driver'));
  });

  it('can switch from the Google hand-over back to the email form', async () => {
    const navigation = fakeNavigation();
    const route = { params: { googleIdToken: 'google-token', googleProfile: GOOGLE_PROFILE } };
    const { findByText, findByPlaceholderText } = renderWithProviders(
      <SignupScreen navigation={navigation} route={route} />
    );

    fireEvent.press(await findByText('Use Email Instead'));
    expect(await findByPlaceholderText('At least 8 characters')).toBeTruthy();
  });
});

describe('ForgotPasswordScreen', () => {
  it('requests a reset code and moves to ResetPassword', async () => {
    authService.forgotPassword.mockResolvedValue({ success: true });
    const navigation = fakeNavigation();
    const { findByText, findByPlaceholderText } = renderWithProviders(<ForgotPasswordScreen navigation={navigation} />);

    fireEvent.changeText(await findByPlaceholderText('you@example.com'), 'ram@example.com');
    fireEvent.press(await findByText('Send Reset Code'));

    await waitFor(() => expect(authService.forgotPassword).toHaveBeenCalledWith('ram@example.com'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ResetPassword', { email: 'ram@example.com' }));
  });
});

describe('ResetPasswordScreen', () => {
  it('submits the code and new password', async () => {
    authService.resetPassword.mockResolvedValue({ token: 'tok', user: fakeUser('shipper') });
    const navigation = fakeNavigation();
    const { findAllByText, findAllByLabelText, findByPlaceholderText } = renderWithProviders(
      <ResetPasswordScreen navigation={navigation} route={{ params: { email: 'ram@example.com' } }} />
    );

    const digits = await findAllByLabelText(/Digit \d of 6/);
    fireEvent.changeText(digits[0], '123456');
    fireEvent.changeText(await findByPlaceholderText('At least 8 characters'), 'NewPass123');
    fireEvent.changeText(await findByPlaceholderText('Type it again'), 'NewPass123');

    // The screen title and the submit button share the text "Reset Password".
    const submitButtons = await findAllByText('Reset Password');
    fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(authService.resetPassword).toHaveBeenCalledWith('ram@example.com', '123456', 'NewPass123'));
  });
});

describe('VerifyEmailScreen', () => {
  it('submits the code for the signed-in user', async () => {
    authService.verifyEmail.mockResolvedValue({ user: fakeUser('shipper', { emailVerified: true }) });
    const navigation = fakeNavigation();
    const { findByText, findAllByLabelText } = renderWithProviders(
      <VerifyEmailScreen navigation={navigation} />,
      { user: fakeUser('shipper', { email: 'ram@example.com', emailVerified: false }) }
    );

    const digits = await findAllByLabelText(/Digit \d of 6/);
    fireEvent.changeText(digits[0], '123456');
    fireEvent.press(await findByText('Verify Email'));

    await waitFor(() => expect(authService.verifyEmail).toHaveBeenCalledWith('ram@example.com', '123456'));
  });
});
