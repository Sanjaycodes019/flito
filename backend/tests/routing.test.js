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
