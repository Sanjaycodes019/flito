import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import TrackingMap from '../src/components/map/TrackingMap';
import { decodePolyline, measureLine, locateOnLine, formatDuration, freshnessOf } from '../src/components/map/routeMath';
import { _clearRouteCache } from '../src/components/map/routeCache';
import { worthSending, gpsQualityOf } from '../src/components/bookings/LocationSharingToggle';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  API_BASE_URL: 'https://api.flito.test/api',
}));

const api = require('../src/services/api').default;

// The reverse of decodePolyline, so a test can describe a route as points.
const encodePolyline = (points) => {
  let lastLat = 0;
  let lastLng = 0;
  const encodeValue = (value) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = '';
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return out + String.fromCharCode(v + 63);
  };
  return points.map(([lat, lng]) => {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    const chunk = encodeValue(la - lastLat) + encodeValue(ln - lastLng);
    lastLat = la;
    lastLng = ln;
    return chunk;
  }).join('');
};

describe('route geometry', () => {
  it('decodes an encoded polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
    expect(decodePolyline('')).toEqual([]);
  });

  it('finds how far along the road a truck is, and how far off it', () => {
    const line = [[27.7, 85.3], [27.7, 85.35], [27.7, 85.4]];
    const along = measureLine(line);

    const onRoad = locateOnLine(line, along, [27.7, 85.375]);
    expect(onRoad.index).toBe(1);
    expect(onRoad.fraction).toBeCloseTo(0.75, 2);
    expect(onRoad.offRouteMeters).toBeLessThan(1);

    const beside = locateOnLine(line, along, [27.701, 85.375]);
    expect(beside.offRouteMeters).toBeGreaterThan(100);
    expect(beside.offRouteMeters).toBeLessThan(120);
  });

  it('keeps a truck on its own side of a hairpin bend', () => {
    // Up one side of a valley and back down the other, 33 m apart.
    const line = [[27.7, 85.3], [27.7, 85.31], [27.7003, 85.31], [27.7003, 85.3]];
    const along = measureLine(line);
    const beforeBend = locateOnLine(line, along, [27.70012, 85.302], 0);
    expect(beforeBend.index).toBe(0);

    // The same spot, once the truck was last seen past the bend.
    const afterBend = locateOnLine(line, along, [27.70018, 85.302], along[2]);
    expect(afterBend.index).toBe(2);
  });

  it('formats durations and freshness', () => {
    const t = (key, values) => `${key.split('.').pop()}:${JSON.stringify(values)}`;
    expect(formatDuration(45, t)).toBe('min:{"value":45}');
    expect(formatDuration(200, t)).toBe('hMin:{"h":3,"min":20}');
    expect(formatDuration(60 * 26, t)).toBe('dH:{"d":1,"h":2}');

    const now = Date.parse('2026-10-06T10:00:00Z');
    expect(freshnessOf('2026-10-06T09:59:30Z', now)).toEqual({ state: 'live', seconds: 30 });
    expect(freshnessOf('2026-10-06T09:57:00Z', now).state).toBe('recent');
    expect(freshnessOf('2026-10-06T09:40:00Z', now).state).toBe('stale');
    expect(freshnessOf(null, now).state).toBe('unknown');
  });
});

describe('TrackingMap', () => {
  const routeLine = [[27.7, 85.3], [27.7, 85.35], [27.7, 85.4]];
  const serverRoute = (overrides = {}) => ({
    from: { lat: 27.7, lng: 85.3 },
    to: { lat: 27.7, lng: 85.4 },
    fromTruck: false,
    km: 9.8,
    minutes: 30,
    polyline: encodePolyline(routeLine),
    approximate: { pickup: false, dropoff: false },
    ...overrides,
  });

  const renderMap = (props, route = serverRoute()) => {
    api.get.mockResolvedValue({ data: { route } });
    return renderWithProviders(
      <TrackingMap
        bookingId="booking-1"
        pickup={{ lat: 27.7, lng: 85.3 }}
        dropoff={{ lat: 27.7, lng: 85.4 }}
        pickupName="Kalanki, Kathmandu"
        dropoffName="Lakeside, Pokhara"
        {...props}
      />,
      { user: fakeUser('shipper') },
    );
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await _clearRouteCache();
  });

  it('shows the road route before the trip starts', async () => {
    const { findByText, getByText, getByLabelText } = renderMap({ live: false });

    expect(await findByText('9.8 km by road')).toBeTruthy();
    expect(getByText('About 30 min of driving for a loaded truck')).toBeTruthy();
    expect(getByText('Kalanki, Kathmandu')).toBeTruthy();
    expect(getByText('Lakeside, Pokhara')).toBeTruthy();
    expect(getByLabelText('0% of the way to the drop-off')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/bookings/booking-1/route', undefined);
  });

  it('shows a delivered trip as done', async () => {
    const { findByText, getByLabelText } = renderMap({ live: false, delivered: true });

    expect(await findByText('Delivered')).toBeTruthy();
    expect(getByLabelText('100% of the way to the drop-off')).toBeTruthy();
  });

  it('keeps the planned road on the phone, so opening the trip again asks nothing', async () => {
    const first = renderMap({ live: false });
    await first.findByText(/by road$/);
    first.unmount();

    const again = renderMap({ live: false });
    expect(await again.findByText(/by road$/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('can be made full screen and back', async () => {
    const { findByLabelText, getByLabelText } = renderMap({ live: false });

    fireEvent.press(await findByLabelText('Make the map bigger'));
    expect(getByLabelText(/open in full screen/)).toBeTruthy();
    fireEvent.press(getByLabelText('Make the map smaller'));
    expect(getByLabelText('Make the map bigger')).toBeTruthy();
  });

  it('shows the distance and time left from where the truck is, live', async () => {
    const { findByText, getByText, getByLabelText } = renderMap({
      live: true,
      driverLocation: { lat: 27.7, lng: 85.35, speed: 12.5, accuracy: 8, updatedAt: new Date().toISOString() },
    });

    expect(await findByText('15 min · 4.9 km left')).toBeTruthy();
    expect(getByText(/^Arrives around /)).toBeTruthy();
    expect(getByText(/^Live · \d+ s ago$/)).toBeTruthy();
    expect(getByText('45 km/h')).toBeTruthy();
    expect(getByText('GPS ±8 m')).toBeTruthy();
    expect(getByLabelText('50% of the way to the drop-off')).toBeTruthy();
  });

  it('asks for a new route from the truck when it leaves the road', async () => {
    const { findByText } = renderMap({
      live: true,
      driverLocation: { lat: 27.71, lng: 85.35, updatedAt: new Date().toISOString() },
    });

    expect(await findByText(/off the planned road/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/bookings/booking-1/route', { params: { from: 'truck' } });
  });

  it('shows the stops from the server, marked approximate, when they have no pin', async () => {
    api.get.mockResolvedValue({ data: { route: serverRoute({ approximate: { pickup: true, dropoff: false } }) } });
    const { findByText } = renderWithProviders(
      <TrackingMap bookingId="booking-1" pickup={null} dropoff={null} live={false} />,
      { user: fakeUser('shipper') },
    );

    expect(await findByText(/shown at the centre of its municipality/)).toBeTruthy();
  });

  it('says there is nothing to show when the stops cannot be placed', async () => {
    api.get.mockResolvedValue({ data: { route: null } });
    const { findByText } = renderWithProviders(
      <TrackingMap bookingId="booking-1" pickup={null} dropoff={null} />,
      { user: fakeUser('shipper') },
    );

    expect(await findByText('No location data for this load')).toBeTruthy();
  });
});

describe("what the driver's phone sends", () => {
  const at = Date.parse('2026-10-06T10:00:00Z');
  const last = { fix: { lat: 27.7, lng: 85.3, heading: 90 }, at };

  it('rates GPS accuracy for the driver', () => {
    expect(gpsQualityOf(8)).toBe('good');
    expect(gpsQualityOf(45)).toBe('fair');
    expect(gpsQualityOf(300)).toBe('poor');
    expect(gpsQualityOf(null)).toBeNull();
  });

  it('sends the first fix at once', () => {
    expect(worthSending({ lat: 27.7, lng: 85.3 }, null, at)).toBe(true);
  });

  it('waits at least 8 s between fixes, however far the truck went', () => {
    expect(worthSending({ lat: 27.71, lng: 85.3 }, last, at + 5000)).toBe(false);
    expect(worthSending({ lat: 27.71, lng: 85.3 }, last, at + 8000)).toBe(true);
  });

  it('skips a fix that barely moved or turned, until a minute has passed', () => {
    const crawl = { lat: 27.7001, lng: 85.3, heading: 95 };
    expect(worthSending(crawl, last, at + 20000)).toBe(false);
    expect(worthSending(crawl, last, at + 60000)).toBe(true);
  });

  it('sends a turn even when the truck has hardly moved', () => {
    expect(worthSending({ lat: 27.7, lng: 85.3, heading: 140 }, last, at + 9000)).toBe(true);
    expect(worthSending({ lat: 27.7, lng: 85.3, heading: 70 }, { ...last, fix: { ...last.fix, heading: 350 } }, at + 9000)).toBe(true);
  });
});
