// The Android Google sign-in hook (src/hooks/useGoogleAuth.js). Jest runs
// the native platform, so this is the native file, not useGoogleAuth.web.js.
const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(),
  signOut: jest.fn(),
  signIn: jest.fn(),
};
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: mockGoogleSignin }));

const WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';

// The client ID is baked in from the environment when the code is compiled,
// so each test loads the hook afresh against the constant it needs.
const loadHook = (clientId = WEB_CLIENT_ID) => {
  let hook;
  jest.isolateModules(() => {
    jest.doMock('../src/utils/constants', () => ({ GOOGLE_CLIENT_ID: clientId }));
    hook = require('../src/hooks/useGoogleAuth');
  });
  return hook;
};

const signInWith = async (hook) => {
  const onResult = jest.fn();
  await hook.useGoogleAuth(onResult).promptGoogleSignIn();
  return onResult;
};

describe('useGoogleAuth (Android)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleSignin.hasPlayServices.mockResolvedValue(true);
    mockGoogleSignin.signOut.mockResolvedValue(null);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('hands back the ID token, asking Google for one issued to the Web client', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ idToken: 'google-id-token', user: {} });
    const onResult = await signInWith(loadHook());

    expect(mockGoogleSignin.configure).toHaveBeenCalledWith({ webClientId: WEB_CLIENT_ID });
    expect(mockGoogleSignin.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
    expect(onResult).toHaveBeenCalledWith('google-id-token');
  });

  it('signs out of the last account first, so the account picker always opens', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ idToken: 'google-id-token' });
    await signInWith(loadHook());

    expect(mockGoogleSignin.signOut.mock.invocationCallOrder[0])
      .toBeLessThan(mockGoogleSignin.signIn.mock.invocationCallOrder[0]);
  });

  it('reports a closed picker as a quiet cancel, not an error', async () => {
    mockGoogleSignin.signIn.mockRejectedValue(Object.assign(new Error('cancelled'), { code: '12501' }));
    const onResult = await signInWith(loadHook());

    expect(onResult).toHaveBeenCalledWith(null);
  });

  it('says Google is not available when the app is not registered in Google Cloud', async () => {
    mockGoogleSignin.signIn.mockRejectedValue(Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' }));
    const onResult = await signInWith(loadHook());

    expect(onResult).toHaveBeenCalledWith(null, 'not_configured');
  });

  it('passes any other failure on with its message', async () => {
    mockGoogleSignin.hasPlayServices.mockRejectedValue(
      Object.assign(new Error('Play services not available'), { code: 'PLAY_SERVICES_NOT_AVAILABLE' })
    );
    const onResult = await signInWith(loadHook());

    expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(null, 'Play services not available');
  });

  it('never touches Google when the build has no client ID', async () => {
    const hook = loadHook('');
    const onResult = await signInWith(hook);

    expect(hook.isGoogleConfigured()).toBe(false);
    expect(mockGoogleSignin.configure).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(null, 'not_configured');
  });
});
