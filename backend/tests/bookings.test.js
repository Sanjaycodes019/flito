const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

// Drives the real flow up to a confirmed booking with a driver assigned.
const setupBooking = async ({ withDriver = true } = {}) => {
  const shipper = await signUp({ phone: uniquePhone(), role: 'shipper', firstName: 'Ram' });
  const owner = await signUp({ phone: uniquePhone(), role: 'owner', firstName: 'Bikash' });
  const driverPhone = uniquePhone();
  const driver = await signUp({ phone: driverPhone, role: 'driver', firstName: 'Hari' });

  const load = (await as(shipper.token).post('/api/loads').send({
    goodsType: 'Cement',
    pickupLocation: { address: 'Kathmandu' },
    dropoffLocation: { address: 'Pokhara' },
  }).expect(201)).body.load;

  const quote = (await as(owner.token).post('/api/quotes')
    .send({ loadId: load._id, quotedPrice: 15000 }).expect(201)).body.quote;

  let booking = (await as(shipper.token)
    .patch(`/api/quotes/${quote._id}/accept`).expect(200)).body.booking;

  if (withDriver) {
    booking = (await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`)
      .send({ driverId: driver.id }).expect(200)).body.booking;
  }

  return { shipper, owner, driver, driverPhone, load, quote, booking };
};

describe('booking access', () => {
  // Regression: getBooking populates the party refs, so a naive String(ref)
  // comparison stringified a whole document and returned 403 for everyone.
  it('lets each party read the booking', async () => {
    const { shipper, owner, driver, booking } = await setupBooking();

    for (const actor of [shipper, owner, driver]) {
      const res = await as(actor.token).get(`/api/bookings/${booking._id}`);
      expect(res.status).toBe(200);
      expect(res.body.booking._id).toBe(booking._id);
    }
  });

  it('hides the booking from an unrelated user', async () => {
    const { booking } = await setupBooking();
    const outsider = await signUp({ phone: uniquePhone(), role: 'shipper' });

    const res = await as(outsider.token).get(`/api/bookings/${booking._id}`);
    expect(res.status).toBe(403);
  });

  it('scopes the bookings list to the requesting user', async () => {
    const { shipper } = await setupBooking();
    const otherShipper = await signUp({ phone: uniquePhone(), role: 'shipper' });

    expect((await as(shipper.token).get('/api/bookings').expect(200)).body.bookings).toHaveLength(1);
    expect((await as(otherShipper.token).get('/api/bookings').expect(200)).body.bookings).toHaveLength(0);
  });
});

describe('booking status permissions', () => {
  it('lets the driver report pickup and delivery', async () => {
    const { driver, booking } = await setupBooking();

    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);

    const res = await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);

    expect(res.body.booking.status).toBe('completed');
  });

  it('stops a shipper marking the job completed', async () => {
    const { shipper, booking } = await setupBooking();

    const res = await as(shipper.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ status: 'completed' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only the assigned driver/i);
  });

  it('stops an owner reporting pickup progress', async () => {
    const { owner, booking } = await setupBooking();

    const res = await as(owner.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up' });

    expect(res.status).toBe(403);
  });

  it('stops a driver cancelling the booking', async () => {
    const { driver, booking } = await setupBooking();

    const res = await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(403);
  });

  it('lets the shipper cancel before transit', async () => {
    const { shipper, booking } = await setupBooking();

    const res = await as(shipper.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ status: 'cancelled' }).expect(200);

    expect(res.body.booking.status).toBe('cancelled');
  });

  it('refuses to cancel a completed booking', async () => {
    const { shipper, driver, booking } = await setupBooking();
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);

    const res = await as(shipper.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown status value', async () => {
    const { driver, booking } = await setupBooking();

    const res = await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ status: 'teleported' });

    expect(res.status).toBe(400);
  });
});

describe('driver assignment and location', () => {
  it('stops a shipper assigning a driver', async () => {
    const { shipper, driver, booking } = await setupBooking({ withDriver: false });

    const res = await as(shipper.token).patch(`/api/bookings/${booking._id}/assign-driver`)
      .send({ driverId: driver.id });

    expect(res.status).toBe(403);
  });

  it('confirms the booking when a driver is assigned', async () => {
    const { booking } = await setupBooking();
    expect(booking.status).toBe('confirmed');
  });

  it('refuses a location ping before the booking is in transit', async () => {
    const { driver, booking } = await setupBooking();

    const res = await as(driver.token).patch(`/api/bookings/${booking._id}/location`)
      .send({ lat: 27.7, lng: 85.3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/in transit/);
  });

  it('only lets the assigned driver push a location, once in transit', async () => {
    const { owner, driver, booking } = await setupBooking();
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);

    await as(driver.token).patch(`/api/bookings/${booking._id}/location`)
      .send({ lat: 27.7, lng: 85.3 }).expect(200);

    const res = await as(owner.token).patch(`/api/bookings/${booking._id}/location`)
      .send({ lat: 27.7, lng: 85.3 });
    expect(res.status).toBe(403);
  });

  it('rejects out-of-range coordinates', async () => {
    const { driver, booking } = await setupBooking();
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);

    for (const body of [{ lat: 91, lng: 85 }, { lat: 27, lng: 181 }, { lat: 'x', lng: 85 }, { lat: 27 }]) {
      const res = await as(driver.token).patch(`/api/bookings/${booking._id}/location`).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('records when the location was last updated', async () => {
    const { driver, booking } = await setupBooking();
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);

    const before = Date.now();
    const res = await as(driver.token).patch(`/api/bookings/${booking._id}/location`)
      .send({ lat: 27.7, lng: 85.3 }).expect(200);

    expect(res.body.currentLocation).toEqual({ lat: 27.7, lng: 85.3 });
    expect(new Date(res.body.locationUpdatedAt).getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('ratings', () => {
  it('refuses a rating before completion', async () => {
    const { shipper, booking } = await setupBooking();

    const res = await as(shipper.token).post(`/api/bookings/${booking._id}/rate`)
      .send({ rating: 5 });

    expect(res.status).toBe(400);
  });

  it('records the shipper rating once completed', async () => {
    const { shipper, driver, booking } = await setupBooking();
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);

    const res = await as(shipper.token).post(`/api/bookings/${booking._id}/rate`)
      .send({ rating: 5, review: 'On time' }).expect(200);

    expect(res.body.booking.ownerRating.rating).toBe(5);
  });
});
