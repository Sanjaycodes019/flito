jest.mock('axios');

const axios = require('axios');
const { placeIn } = require('./helpers');
const routing = require('../src/services/routing');

const kathmandu = placeIn('Kathmandu', 1, 'x');
const pokhara = placeIn('Pokhara', 1, 'x');

beforeEach(() => {
  jest.clearAllMocks();
  routing._clearCache();
  process.env.OSRM_URL = 'http://osrm.test';
});
afterAll(() => { process.env.OSRM_URL = 'off'; });

describe('road distances', () => {
  it('uses the routing server and rounds to whole km', async () => {
    axios.get.mockResolvedValue({ data: { code: 'Ok', distances: [[199843.1]] } });

    expect(await routing.roadDistance(kathmandu, pokhara)).toEqual({ km: 200, source: 'route' });
    expect(axios.get.mock.calls[0][0]).toMatch(/^http:\/\/osrm\.test\/table\/v1\/driving\//);
  });

  it('remembers an answer instead of asking again', async () => {
    axios.get.mockResolvedValue({ data: { code: 'Ok', distances: [[199843.1]] } });

    await routing.roadDistance(kathmandu, pokhara);
    await routing.roadDistance(kathmandu, pokhara);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('falls back to the straight-line estimate when the server fails', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { km, source } = await routing.roadDistance(kathmandu, pokhara);

    expect(source).toBe('estimate');
    expect(km).toBeGreaterThan(150);
    expect(km).toBeLessThan(260);
  });

  it('does not call a server when routing is switched off', async () => {
    process.env.OSRM_URL = 'off';

    expect((await routing.roadDistance(kathmandu, pokhara)).source).toBe('estimate');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('asks once for many origins, and shares an answer between trucks in the same place', async () => {
    axios.get.mockResolvedValue({ data: { code: 'Ok', distances: [[127000], [199843]] } });
    const birgunj = placeIn('Birgunj', 1, 'x');

    const kms = await routing.roadDistancesTo([birgunj, kathmandu, birgunj], pokhara);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(kms).toEqual([127, 200, 127]);
  });
});

describe('route lines', () => {
  const a = { lat: 27.7172, lng: 85.324 };
  const b = { lat: 28.2096, lng: 83.9856 };

  it('asks for the full line and returns it with distance and car time', async () => {
    axios.get.mockResolvedValue({ data: { code: 'Ok', routes: [{ distance: 201234.6, duration: 18000.4, geometry: '_p~iF~ps|U_ulLnnqC' }] } });

    expect(await routing.roadRoute([a, b])).toEqual({ meters: 201235, seconds: 18000, polyline: '_p~iF~ps|U_ulLnnqC' });
    const [url, { params }] = axios.get.mock.calls[0];
    expect(url).toBe('http://osrm.test/route/v1/driving/85.324,27.7172;83.9856,28.2096');
    expect(params).toMatchObject({ overview: 'full', geometries: 'polyline' });
  });

  it('remembers a line instead of asking again', async () => {
    axios.get.mockResolvedValue({ data: { code: 'Ok', routes: [{ distance: 1000, duration: 60, geometry: 'abc' }] } });

    await routing.roadRoute([a, b]);
    await routing.roadRoute([a, b]);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('thins a long line to within a few metres of the road', async () => {
    // 1 km of straight road with a point every metre, then a turn.
    const { encode, decode } = require('../src/services/polyline');
    const straight = Array.from({ length: 1001 }, (_, i) => [27.7, 85.3 + i * 0.00001]);
    const turn = [27.701, 85.31];
    axios.get.mockResolvedValue({ data: { code: 'Ok', routes: [{ distance: 1110, duration: 90, geometry: encode([...straight, turn]) }] } });

    const { polyline } = await routing.roadRoute([a, b]);

    expect(decode(polyline)).toEqual([[27.7, 85.3], [27.7, 85.31], turn]);
  });

  it('returns null rather than a made-up line when there is no route', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockResolvedValue({ data: { code: 'NoRoute', routes: [] } });
    expect(await routing.roadRoute([a, b])).toBeNull();

    axios.get.mockRejectedValue(new Error('timeout'));
    expect(await routing.roadRoute([a, { lat: 26.45, lng: 87.27 }])).toBeNull();

    process.env.OSRM_URL = 'off';
    expect(await routing.roadRoute([a, b])).toBeNull();
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
