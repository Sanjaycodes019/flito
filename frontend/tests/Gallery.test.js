import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, act } from '@testing-library/react-native';
import { getStateFromPath, NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { changeLanguage } from '../src/i18n';
import GalleryScreen from '../src/public/screens/GalleryScreen';
import { buildLinking } from '../src/navigation/RootNavigator';
import { SHOTS, LANDING_SHOTS, justifyRows, aspectOf } from '../src/public/gallery';
import { renderWithProviders, fakeNavigation } from './testUtils';
import siteEn from '../src/i18n/locales/en/site.json';
import siteNe from '../src/i18n/locales/ne/site.json';

jest.mock('../src/services/auth', () => ({
  authService: { me: jest.fn(() => Promise.resolve({ user: {} })), logout: jest.fn() },
}));

const SIGNED_OUT = { auth: { user: null, token: null, isLoading: false, error: null, hydrated: true } };
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const renderGallery = () => renderWithProviders(
  <SafeAreaProvider initialMetrics={METRICS}>
    <NavigationContext.Provider value={fakeNavigation()}>
      <NavigationRouteContext.Provider value={{ key: 'test', name: 'Gallery' }}>
        <GalleryScreen />
      </NavigationRouteContext.Provider>
    </NavigationContext.Provider>
  </SafeAreaProvider>,
  { preloadedState: SIGNED_OUT },
);

// The rows only lay out once they know their width, as on a real screen.
const layOut = (getAllByTestId, width = 358) => getAllByTestId('shot-rows').forEach((rows) => {
  fireEvent(rows, 'layout', { nativeEvent: { layout: { width, height: 0 } } });
});

beforeEach(async () => {
  await changeLanguage('en');
});

describe('gallery rows', () => {
  const PHONE = { width: 358, gap: 12, maxAspect: 1, maxHeight: 520 };

  it('gives a laptop screen its own row on a phone, and puts two phone screens side by side', () => {
    const rows = justifyRows(['liveMap', 'mapFullscreen', 'driverSharing'], PHONE);
    expect(rows.map((row) => row.keys)).toEqual([['liveMap'], ['mapFullscreen', 'driverSharing']]);
  });

  it('fills the width with every shot in a row at one height', () => {
    const [row] = justifyRows(['mapFullscreen', 'driverSharing'], PHONE);
    const widths = row.keys.map((key) => row.height * aspectOf(key));
    expect(widths.reduce((a, b) => a + b, 0) + PHONE.gap).toBeCloseTo(PHONE.width);
  });

  it('never makes a row taller than the cap', () => {
    const [row] = justifyRows(['driverJob'], PHONE);
    expect(row.height).toBe(520);
  });
});

describe('gallery content', () => {
  const pageShots = (site) => site.gallery.sections.flatMap((section) => section.shots);

  it('has a file for every screenshot', () => {
    Object.values(SHOTS).forEach(({ file }) => {
      expect(fs.existsSync(path.join(__dirname, '..', 'public', 'gallery', `${file}.webp`))).toBe(true);
    });
  });

  it('shows every screenshot once, each with a caption in English and Nepali', () => {
    const keys = pageShots(siteEn);
    expect([...keys].sort()).toEqual(Object.keys(SHOTS).sort());
    expect(pageShots(siteNe)).toEqual(keys);
    [...keys, ...LANDING_SHOTS].forEach((key) => {
      expect(siteEn.gallery.shots[key]).toBeTruthy();
      expect(siteNe.gallery.shots[key]).toBeTruthy();
    });
  });

  it('opens at /gallery whether signed in or not', () => {
    expect(getStateFromPath('/gallery', buildLinking(false).config).routes[0].name).toBe('Gallery');
    const signedIn = getStateFromPath('/gallery', buildLinking(true).config);
    expect(signedIn.routes[0].state.routes.map((r) => r.name)).toEqual(['ProfileHome', 'Gallery']);
  });
});

describe('gallery page', () => {
  it('opens a screen full size and steps through the rest', async () => {
    const { findByText, getAllByTestId, getByLabelText, getAllByLabelText, queryByText, findByLabelText } = renderGallery();
    expect(await findByText('The truck on the road, and when it arrives')).toBeTruthy();
    layOut(getAllByTestId);

    fireEvent.press(await findByLabelText(`See full size: ${siteEn.gallery.shots.liveMap}`));
    expect(await findByText('1 of 14')).toBeTruthy();

    fireEvent.press(getByLabelText('Next screen'));
    expect(await findByText('2 of 14')).toBeTruthy();

    fireEvent.press(getByLabelText('Previous screen'));
    fireEvent.press(getByLabelText('Previous screen'));
    expect(await findByText('14 of 14')).toBeTruthy();

    // The backdrop closes it too; this is the button.
    fireEvent.press(getAllByLabelText('Close').pop());
    expect(queryByText('14 of 14')).toBeNull();
  });

  it('reads in Nepali', async () => {
    await act(() => changeLanguage('ne'));
    const { findByText } = renderGallery();
    expect(await findByText('FLITO काम गर्दै हेर्नुहोस्')).toBeTruthy();
  });
});
