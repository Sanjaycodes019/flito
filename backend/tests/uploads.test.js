// Uploads run through the real routes, middleware and database; only the calls
// to Cloudinary are replaced, so the suite never sends files to a live account.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(),
  uploadImages: jest.fn(),
  deleteAssets: jest.fn(),
}));

const storage = require('../src/services/storage');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
  storage.deleteAssets.mockResolvedValue(undefined);

  let counter = 0;
  storage.uploadImages.mockImplementation(async (files, { folder }) => files.map(() => {
    counter += 1;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/${folder}/photo${counter}.png`,
      publicId: `${folder}/photo${counter}`,
    };
  }));
});

// A 1x1 PNG. Storage is mocked so the bytes don't matter, but each part must
// declare an image type to get past the upload filter.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const withPhotos = (req, count, { contentType = 'image/png', buffer = PNG } = {}) => {
  for (let i = 0; i < count; i += 1) {
    req.attach('photos', buffer, { filename: `photo${i}.png`, contentType });
  }
  return req;
};

const newUser = (role) => signUp({ phone: uniquePhone(), role });

const postLoad = async (shipper, extra = {}) => (await as(shipper.token).post('/api/loads').send({
  goodsType: 'Cement',
  pickupLocation: { address: 'Kathmandu' },
  dropoffLocation: { address: 'Pokhara' },
  ...extra,
}).expect(201)).body.load;

describe('load photos', () => {
  const uploadTo = (actor, load, count, options) =>
    withPhotos(as(actor.token).post(`/api/loads/${load._id}/photos`), count, options);

  it("uploads photos to the shipper's own load", async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    const res = await uploadTo(shipper, load, 2).expect(201);

    expect(res.body.load.photos).toHaveLength(2);
    expect(res.body.load.photos[0]).toEqual(expect.objectContaining({
      url: expect.stringContaining('res.cloudinary.com'),
      publicId: `flito/loads/${load._id}/photo1`,
    }));
    expect(storage.uploadImages).toHaveBeenCalledWith(expect.any(Array), { folder: `flito/loads/${load._id}` });

    // Persisted, not just echoed back.
    const fetched = await as(shipper.token).get(`/api/loads/${load._id}`).expect(200);
    expect(fetched.body.load.photos).toHaveLength(2);
  });

  it('ignores photo URLs sent directly when creating a load', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper, { photos: [{ url: 'https://attacker.example/x.jpg', publicId: 'x' }] });
    expect(load.photos).toEqual([]);
  });

  it("refuses uploads to someone else's load", async () => {
    const shipper = await newUser('shipper');
    const otherShipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);

    expect((await uploadTo(otherShipper, load, 1)).status).toBe(403);
    expect((await uploadTo(owner, load, 1)).status).toBe(403);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('rejects files that are not images', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    const res = await uploadTo(shipper, load, 1, { contentType: 'text/plain', buffer: Buffer.from('hello') });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/images are allowed/i);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('rejects a photo over 5 MB', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    const res = await uploadTo(shipper, load, 1, { buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/5 MB/);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('rejects more photos than the limit in one request', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    const res = await uploadTo(shipper, load, 7);

    expect(res.status).toBe(400);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('enforces the photo limit across separate uploads', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    await uploadTo(shipper, load, 5).expect(201);
    const over = await uploadTo(shipper, load, 2);
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/at most 6/);

    const last = await uploadTo(shipper, load, 1).expect(201);
    expect(last.body.load.photos).toHaveLength(6);
    expect(storage.uploadImages).toHaveBeenCalledTimes(2);
  });

  it('requires at least one photo', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    const res = await as(shipper.token).post(`/api/loads/${load._id}/photos`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one/i);
  });

  it('answers 503 without touching storage when uploads are not configured', async () => {
    storage.isConfigured.mockReturnValue(false);
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);

    const res = await uploadTo(shipper, load, 1);

    expect(res.status).toBe(503);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('removes a photo from the load and from storage', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);
    const { photos } = (await uploadTo(shipper, load, 2).expect(201)).body.load;

    const res = await as(shipper.token).delete(`/api/loads/${load._id}/photos/${photos[0]._id}`).expect(200);

    expect(res.body.load.photos.map((p) => p._id)).toEqual([photos[1]._id]);
    expect(storage.deleteAssets).toHaveBeenCalledWith([photos[0].publicId]);
  });

  it('locks photos once the load is booked', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const { photos } = (await uploadTo(shipper, load, 1).expect(201)).body.load;

    const quote = (await as(owner.token).post('/api/quotes')
      .send({ loadId: load._id, quotedPrice: 15000 }).expect(201)).body.quote;
    await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);

    const add = await uploadTo(shipper, load, 1);
    expect(add.status).toBe(400);
    expect(add.body.message).toMatch(/booked/);

    const remove = await as(shipper.token).delete(`/api/loads/${load._id}/photos/${photos[0]._id}`);
    expect(remove.status).toBe(400);
    expect(storage.deleteAssets).not.toHaveBeenCalled();
  });
});

describe('malformed ids', () => {
  it('answers 400 rather than 500', async () => {
    const shipper = await newUser('shipper');
    const res = await as(shipper.token).get('/api/loads/not-a-valid-id');
    expect(res.status).toBe(400);
  });
});

describe('proof of delivery', () => {
  const setupBooking = async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const driver = await newUser('driver');
    const load = await postLoad(shipper);

    const quote = (await as(owner.token).post('/api/quotes')
      .send({ loadId: load._id, quotedPrice: 15000 }).expect(201)).body.quote;
    const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
    await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id }).expect(200);

    return { shipper, owner, driver, booking };
  };

  const pickUp = (driver, booking) => as(driver.token).patch(`/api/bookings/${booking._id}/status`)
    .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);

  const uploadProof = (actor, booking, count = 1) =>
    withPhotos(as(actor.token).post(`/api/bookings/${booking._id}/delivery-proof`), count);

  it('refuses proof before the load is picked up', async () => {
    const { driver, booking } = await setupBooking();

    const res = await uploadProof(driver, booking);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/picked up/i);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('lets the assigned driver add proof while in transit', async () => {
    const { driver, booking } = await setupBooking();
    await pickUp(driver, booking);

    const res = await uploadProof(driver, booking).expect(201);

    expect(res.body.booking.deliveryPhotos).toHaveLength(1);
    expect(res.body.booking.deliveryPhotos[0].uploadedAt).toBeTruthy();
    expect(storage.uploadImages).toHaveBeenCalledWith(expect.any(Array), { folder: `flito/delivery/${booking._id}` });
  });

  it('still accepts proof after the job is completed', async () => {
    const { driver, booking } = await setupBooking();
    await pickUp(driver, booking);
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);

    await uploadProof(driver, booking).expect(201);
  });

  it('refuses proof from the shipper or owner', async () => {
    const { shipper, owner, driver, booking } = await setupBooking();
    await pickUp(driver, booking);

    expect((await uploadProof(shipper, booking)).status).toBe(403);
    expect((await uploadProof(owner, booking)).status).toBe(403);
    expect(storage.uploadImages).not.toHaveBeenCalled();
  });

  it('enforces the delivery photo limit', async () => {
    const { driver, booking } = await setupBooking();
    await pickUp(driver, booking);

    await uploadProof(driver, booking, 5).expect(201);
    const over = await uploadProof(driver, booking, 1);

    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/at most 5/);
  });

  describe('signature', () => {
    const uploadSignature = (actor, booking) => as(actor.token)
      .post(`/api/bookings/${booking._id}/signature`)
      .attach('signature', PNG, { filename: 'sig.png', contentType: 'image/png' });

    it('refuses a signature before the load is picked up', async () => {
      const { driver, booking } = await setupBooking();

      const res = await uploadSignature(driver, booking);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/picked up/i);
      expect(storage.uploadImages).not.toHaveBeenCalled();
    });

    it('lets the assigned driver capture a signature while in transit', async () => {
      const { driver, booking } = await setupBooking();
      await pickUp(driver, booking);

      const res = await uploadSignature(driver, booking).expect(201);

      expect(res.body.booking.deliverySignature).toEqual(expect.objectContaining({
        url: expect.stringContaining('res.cloudinary.com'),
        capturedAt: expect.anything(),
      }));
      expect(storage.uploadImages).toHaveBeenCalledWith(
        expect.any(Array),
        { folder: `flito/delivery/${booking._id}/signature` },
      );
    });

    it('refuses a signature from the shipper or owner', async () => {
      const { shipper, owner, driver, booking } = await setupBooking();
      await pickUp(driver, booking);

      expect((await uploadSignature(shipper, booking)).status).toBe(403);
      expect((await uploadSignature(owner, booking)).status).toBe(403);
      expect(storage.uploadImages).not.toHaveBeenCalled();
    });

    it('replaces a prior signature and deletes the old file', async () => {
      const { driver, booking } = await setupBooking();
      await pickUp(driver, booking);
      const first = (await uploadSignature(driver, booking).expect(201)).body.booking.deliverySignature;

      const second = (await uploadSignature(driver, booking).expect(201)).body.booking.deliverySignature;

      expect(second.url).not.toBe(first.url);
      // Deletion targets storage's internal publicId, not the URL the client sees.
      expect(storage.deleteAssets).toHaveBeenCalledWith([`flito/delivery/${booking._id}/signature/photo1`]);
    });

    it('rejects a non-image file', async () => {
      const { driver, booking } = await setupBooking();
      await pickUp(driver, booking);

      const res = await as(driver.token).post(`/api/bookings/${booking._id}/signature`)
        .attach('signature', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(storage.uploadImages).not.toHaveBeenCalled();
    });

    it('rejects a signature over 1 MB', async () => {
      const { driver, booking } = await setupBooking();
      await pickUp(driver, booking);

      const res = await as(driver.token).post(`/api/bookings/${booking._id}/signature`)
        .attach('signature', Buffer.alloc(1024 * 1024 + 1), { filename: 'sig.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/1 MB/);
    });

    it('still accepts a signature after the job is completed', async () => {
      const { driver, booking } = await setupBooking();
      await pickUp(driver, booking);
      await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
        .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);

      await uploadSignature(driver, booking).expect(201);
    });
  });
});
