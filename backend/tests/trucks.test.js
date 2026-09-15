const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const newOwner = () => signUp({ phone: uniquePhone(), role: 'owner', firstName: 'Bikash' });

const addTruck = (owner, overrides = {}) =>
  as(owner.token).post('/api/trucks').send({
    registrationNumber: `BA 2 KHA ${Math.floor(1000 + Math.random() * 9000)}`,
    truckType: '6-wheeler',
    bodyType: 'open',
    capacity: 10000,
    ...overrides,
  });

describe('fleet ownership', () => {
  it('rejects non-owners', async () => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    const res = await as(shipper.token).get('/api/trucks');
    expect(res.status).toBe(403);
  });

  it('only lists the requesting owner\'s trucks', async () => {
    const ownerA = await newOwner();
    const ownerB = await newOwner();
    await addTruck(ownerA).expect(201);
    await addTruck(ownerA).expect(201);
    await addTruck(ownerB).expect(201);

    expect((await as(ownerA.token).get('/api/trucks').expect(200)).body.trucks).toHaveLength(2);
    expect((await as(ownerB.token).get('/api/trucks').expect(200)).body.trucks).toHaveLength(1);
  });

  it('stops one owner editing another owner\'s truck', async () => {
    const ownerA = await newOwner();
    const ownerB = await newOwner();
    const truck = (await addTruck(ownerA).expect(201)).body.truck;

    expect((await as(ownerB.token).patch(`/api/trucks/${truck._id}`).send({ status: 'inactive' })).status).toBe(403);
    expect((await as(ownerB.token).delete(`/api/trucks/${truck._id}`)).status).toBe(403);
  });
});

describe('truck validation', () => {
  it('requires a registration number', async () => {
    const owner = await newOwner();
    const res = await as(owner.token).post('/api/trucks').send({ truckType: '6-wheeler', bodyType: 'open', capacity: 10000 });
    expect(res.status).toBe(400);
  });

  it('refuses a duplicate registration for the same owner', async () => {
    const owner = await newOwner();
    await addTruck(owner, { registrationNumber: 'BA 1 KHA 0001' }).expect(201);
    const res = await addTruck(owner, { registrationNumber: 'BA 1 KHA 0001' });
    expect(res.status).toBe(409);
  });

  it('allows two owners to use the same registration', async () => {
    const ownerA = await newOwner();
    const ownerB = await newOwner();
    await addTruck(ownerA, { registrationNumber: 'BA 1 KHA 0002' }).expect(201);
    await addTruck(ownerB, { registrationNumber: 'BA 1 KHA 0002' }).expect(201);
  });

  it('rejects an invalid status', async () => {
    const owner = await newOwner();
    const truck = (await addTruck(owner).expect(201)).body.truck;
    const res = await as(owner.token).patch(`/api/trucks/${truck._id}`).send({ status: 'exploded' });
    expect(res.status).toBe(400);
  });
});

describe('driver assignment', () => {
  it('assigns and unassigns a driver by phone', async () => {
    const owner = await newOwner();
    const driverPhone = uniquePhone();
    await signUp({ phone: driverPhone, role: 'driver', firstName: 'Hari' });
    const truck = (await addTruck(owner).expect(201)).body.truck;

    const assigned = await as(owner.token).patch(`/api/trucks/${truck._id}/driver`)
      .send({ driverPhone }).expect(200);
    expect(assigned.body.truck.assignedDriverId.firstName).toBe('Hari');

    const cleared = await as(owner.token).patch(`/api/trucks/${truck._id}/driver`)
      .send({ driverPhone: '' }).expect(200);
    expect(cleared.body.truck.assignedDriverId).toBeFalsy();
  });

  it('404s for an unknown driver phone', async () => {
    const owner = await newOwner();
    const truck = (await addTruck(owner).expect(201)).body.truck;

    const res = await as(owner.token).patch(`/api/trucks/${truck._id}/driver`)
      .send({ driverPhone: uniquePhone() });
    expect(res.status).toBe(404);
  });

  it('will not assign a non-driver account', async () => {
    const owner = await newOwner();
    const shipperPhone = uniquePhone();
    await signUp({ phone: shipperPhone, role: 'shipper' });
    const truck = (await addTruck(owner).expect(201)).body.truck;

    const res = await as(owner.token).patch(`/api/trucks/${truck._id}/driver`)
      .send({ driverPhone: shipperPhone });
    expect(res.status).toBe(404);
  });
});
