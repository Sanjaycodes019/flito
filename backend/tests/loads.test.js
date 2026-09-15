const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, placeIn, sampleLoad } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const newShipper = () => signUp({ phone: uniquePhone(), role: 'shipper' });

const postLoad = (shipper, body = {}) => as(shipper.token).post('/api/loads').send(sampleLoad(body));

describe('pickup and dropoff addresses on a load', () => {
  it('stores each stop with its full address and a short label built from the official lists', async () => {
    const shipper = await newShipper();
    const res = await postLoad(shipper, {
      pickupLocation: {
        ...placeIn('Kathmandu', 16, 'Balaju'),
        contactPerson: '  Ram  ',
        phone: '+9779841234567',
        coordinates: { lat: 27.734, lng: 85.3 },
      },
    }).expect(201);

    const { pickupLocation, dropoffLocation } = res.body.load;
    expect(pickupLocation).toMatchObject({
      ward: 16,
      tole: 'Balaju',
      address: 'Balaju, Ward 16, Kathmandu Metropolitan City, Kathmandu, Bagmati Province',
      label: 'Balaju, Kathmandu',
      contactPerson: 'Ram',
      phone: '+9779841234567',
      coordinates: { lat: 27.734, lng: 85.3 },
    });
    expect(dropoffLocation).toMatchObject({
      address: 'Lakeside, Ward 6, Pokhara Metropolitan City, Kaski, Gandaki Province',
      label: 'Lakeside, Pokhara',
    });
  });

  it('builds the address text itself instead of trusting the client', async () => {
    const shipper = await newShipper();
    const res = await postLoad(shipper, {
      pickupLocation: { ...placeIn('Kathmandu', 20, 'Basantapur'), address: 'Somewhere else', label: 'Elsewhere' },
    }).expect(201);

    expect(res.body.load.pickupLocation.label).toBe('Basantapur, Kathmandu');
    expect(res.body.load.pickupLocation.address).toMatch(/^Basantapur, Ward 20, Kathmandu Metropolitan City/);
  });

  it('refuses a free-text address', async () => {
    const shipper = await newShipper();
    const res = await postLoad(shipper, { pickupLocation: { address: 'Kathmandu' } });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Pickup: Choose a province');
  });

  it('refuses a ward the municipality does not have', async () => {
    const shipper = await newShipper();
    const res = await postLoad(shipper, { dropoffLocation: placeIn('Pokhara', 40, 'Lakeside') });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dropoff: Choose a ward from 1 to 33');
  });

  it('refuses a district outside the chosen province', async () => {
    const shipper = await newShipper();
    const pokhara = placeIn('Pokhara', 6, 'Lakeside');
    const res = await postLoad(shipper, { pickupLocation: { ...placeIn('Kathmandu', 20, 'Basantapur'), provinceId: pokhara.provinceId } });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Pickup: Choose a district in the selected province');
  });

  it('refuses a contact phone that is not a +977 number, and a point that is not real', async () => {
    const shipper = await newShipper();

    const badPhone = await postLoad(shipper, { dropoffLocation: { ...placeIn('Pokhara', 6, 'Lakeside'), phone: '98412' } });
    expect(badPhone.status).toBe(400);
    expect(badPhone.body.message).toMatch(/^Dropoff: contact phone/);

    const badPoint = await postLoad(shipper, { pickupLocation: { ...placeIn('Kathmandu', 20, 'Basantapur'), coordinates: { lat: 200, lng: 85 } } });
    expect(badPoint.status).toBe(400);
    expect(badPoint.body.message).toMatch(/^Pickup: Location coordinates/);
  });
});
