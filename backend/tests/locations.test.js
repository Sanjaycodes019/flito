// Address data and "use current location" run against the real boundary,
// ward and place data shipped with the server. Nothing is looked up online.
const request = require('supertest');
const { getTree, validateAddress, describeAddress } = require('../src/services/nepalLocations');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, app, sampleAddress } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

beforeEach(async () => {
  await clearDb();
});

const tree = getTree();
const nameOf = (list, id) => list.find((item) => item.id === id)?.name;

describe('Nepal address data', () => {
  it('covers every province, district, local level and ward', () => {
    expect(tree.provinces).toHaveLength(7);
    expect(tree.districts).toHaveLength(77);
    expect(tree.localLevels).toHaveLength(753);
    expect(tree.localLevels.reduce((sum, l) => sum + l.wards, 0)).toBe(6743);
  });

  it('links every district to a province and every local level to a district', () => {
    const provinceIds = new Set(tree.provinces.map((p) => p.id));
    const districtIds = new Set(tree.districts.map((d) => d.id));
    expect(tree.districts.every((d) => provinceIds.has(d.provinceId))).toBe(true);
    expect(tree.localLevels.every((l) => districtIds.has(l.districtId))).toBe(true);
  });

  it('serves the lists without logging in', async () => {
    const res = await request(app()).get('/api/locations').expect(200);
    expect(res.body.locations.localLevels).toHaveLength(753);
    expect(res.headers['cache-control']).toMatch(/max-age/);
  });
});

describe('validating an address', () => {
  it('accepts a complete address and describes it', () => {
    const { address, error } = validateAddress({ ...sampleAddress(), tole: '  Basantapur ' });

    expect(error).toBeUndefined();
    expect(address.tole).toBe('Basantapur');
    expect(describeAddress(address).formatted).toBe('Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province');
  });

  it('refuses a district that is not in the chosen province', () => {
    const otherDistrict = tree.districts.find((d) => d.provinceId !== sampleAddress().provinceId);
    expect(validateAddress({ ...sampleAddress(), districtId: otherDistrict.id }).error).toMatch(/district/);
  });

  it('refuses a municipality that is not in the chosen district', () => {
    const otherLocalLevel = tree.localLevels.find((l) => l.districtId !== sampleAddress().districtId);
    expect(validateAddress({ ...sampleAddress(), localLevelId: otherLocalLevel.id }).error).toMatch(/municipality/);
  });

  it("refuses a ward that doesn't exist there, and a missing tole", () => {
    const kathmandu = tree.localLevels.find((l) => l.id === sampleAddress().localLevelId);
    expect(validateAddress({ ...sampleAddress(), ward: kathmandu.wards + 1 }).error).toMatch(`1 to ${kathmandu.wards}`);
    expect(validateAddress({ ...sampleAddress(), ward: 0 }).error).toMatch(/ward/);
    expect(validateAddress({ ...sampleAddress(), tole: '   ' }).error).toMatch(/tole/);
  });
});

describe('detecting a location', () => {
  const detect = (actor, body) => as(actor.token).post('/api/locations/detect').send(body);

  it('finds the province, district and municipality for a point in Kathmandu, and suggests an area', async () => {
    const user = await signUp({ role: 'shipper' });

    // Kathmandu Durbar Square.
    const res = await detect(user, { lat: 27.7045, lng: 85.3076 }).expect(200);

    expect(res.body.inNepal).toBe(true);
    expect(nameOf(tree.provinces, res.body.provinceId)).toBe('Bagmati Province');
    expect(nameOf(tree.districts, res.body.districtId)).toBe('Kathmandu');
    expect(nameOf(tree.localLevels, res.body.localLevelId)).toBe('Kathmandu');
    expect(res.body.areaName).toMatch(/Basantapur/);
    expect(res.body.areaSource).toBe('OpenStreetMap');
  });

  it('finds the ward, from ward boundaries shipped with the server', async () => {
    const user = await signUp({ role: 'shipper' });

    // Baidam, on Pokhara's Lakeside: ward 6.
    const res = await detect(user, { lat: 28.2096, lng: 83.9596 }).expect(200);

    expect(res.body.ward).toBe(6);
    expect(res.body.wardSource).toBe('OpenStreetMap');
    const pokhara = tree.localLevels.find((l) => l.id === res.body.localLevelId);
    expect(res.body.ward).toBeLessThanOrEqual(pokhara.wards);
  });

  it('answers with no ward, not a wrong one, where the ward is not mapped', async () => {
    const user = await signUp({ role: 'shipper' });

    // Inside Chitwan National Park: no municipality, so no ward.
    const res = await detect(user, { lat: 27.5, lng: 84.35 }).expect(200);

    expect(res.body.inNepal).toBe(true);
    expect(res.body.ward).toBeNull();
    expect(res.body.wardSource).toBeNull();
  });

  it('never returns a ward number the municipality does not have', async () => {
    const user = await signUp({ role: 'driver' });
    const points = [[27.7154, 85.3123], [27.6727, 85.3251], [26.4525, 87.2718], [28.05, 81.6167]];

    for (const [lat, lng] of points) {
      const body = (await detect(user, { lat, lng }).expect(200)).body;
      const level = tree.localLevels.find((l) => l.id === body.localLevelId);
      if (body.ward !== null) expect(body.ward).toBeLessThanOrEqual(level.wards);
    }
  });

  it('finds other cities too', async () => {
    const user = await signUp({ role: 'driver' });

    // Pokhara, Lakeside.
    const pokhara = (await detect(user, { lat: 28.2096, lng: 83.9596 }).expect(200)).body;
    expect(nameOf(tree.districts, pokhara.districtId)).toBe('Kaski');
    expect(nameOf(tree.localLevels, pokhara.localLevelId)).toMatch(/Pokhara/);

    // Biratnagar city centre.
    const biratnagar = (await detect(user, { lat: 26.4525, lng: 87.2718 }).expect(200)).body;
    expect(nameOf(tree.provinces, biratnagar.provinceId)).toBe('Koshi Province');
    expect(nameOf(tree.districts, biratnagar.districtId)).toBe('Morang');
  });

  it('says so when the point is outside Nepal, ', async () => {
    const user = await signUp({ role: 'owner' });

    // New Delhi.
    const res = await detect(user, { lat: 28.6139, lng: 77.209 }).expect(200);

    expect(res.body).toEqual({ success: true, inNepal: false });
  });

  it('requires a login and valid coordinates', async () => {
    expect((await request(app()).post('/api/locations/detect').send({ lat: 27.7, lng: 85.3 })).status).toBe(401);

    const user = await signUp({ role: 'shipper' });
    expect((await detect(user, { lat: 'north', lng: 85.3 })).status).toBe(400);
    expect((await detect(user, { lat: 27.7, lng: 190 })).status).toBe(400);
  });
});

describe('saving an address on the account', () => {
  it('stores a valid address and returns it with names filled in', async () => {
    const user = await signUp({ role: 'shipper' });

    const res = await as(user.token).patch('/api/users/me').send({ address: sampleAddress() }).expect(200);

    expect(res.body.user.address).toEqual(expect.objectContaining({
      ward: 20,
      tole: 'Basantapur',
      localLevel: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati Province',
    }));
  });

  it('refuses an invalid address without saving it', async () => {
    const user = await signUp({ role: 'owner' });

    const res = await as(user.token).patch('/api/users/me').send({ address: { ...sampleAddress(), ward: 999 } });

    expect(res.status).toBe(400);
    const me = (await as(user.token).get('/api/auth/me').expect(200)).body.user;
    expect(me.address).toBeNull();
  });
});
