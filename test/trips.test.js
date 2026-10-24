const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const createApp = require('../index');

async function setup(t) {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return async (method, path, body, role) => {
    const headers = {};
    if (role !== undefined) headers['x-role'] = role;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(baseUrl + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

const validTrip = { destination: 'Rome', country: 'Italy', cost: 500 };

test('Trips are public and both route prefixes read the same initial data', async (t) => {
  const request = await setup(t);
  const all = await request('GET', '/trips');
  assert.equal(all.status, 200);
  assert.equal(all.body.results, 3);
  assert.deepEqual(all.body.data.map((trip) => trip.destination), ['Paris', 'Tokyo', 'Cairo']);
  const one = await request('GET', '/api/v1/trips/1');
  assert.equal(one.status, 200);
  assert.deepEqual(one.body.data, all.body.data[0]);
  assert.equal((await request('GET', '/trips/999')).status, 404);
  assert.equal((await request('GET', '/trips/not-a-number')).status, 400);
});

test('Write routes reject missing and non-admin roles before validation without mutation', async (t) => {
  const request = await setup(t);
  const before = (await request('GET', '/trips')).body.data;
  for (const role of [undefined, 'user', 'Admin']) {
    for (const [method, path] of [['POST', '/trips'], ['PUT', '/trips/1'], ['DELETE', '/trips/1']]) {
      const denied = await request(method, path, {}, role);
      assert.equal(denied.status, 403);
      assert.deepEqual(denied.body, { message: 'Admin access required' });
    }
  }
  assert.deepEqual((await request('GET', '/trips')).body.data, before);
});

test('Invalid admin creation never creates a trip', async (t) => {
  const request = await setup(t);
  const invalidBodies = [
    {}, null, [],
    { ...validTrip, destination: '   ' },
    { ...validTrip, destination: 5 },
    { ...validTrip, country: '' },
    { ...validTrip, country: false },
    { ...validTrip, cost: 0 },
    { ...validTrip, cost: -10 },
    { ...validTrip, cost: '500' },
    { ...validTrip, cost: null },
    { destination: 'Rome', country: 'Italy' },
    { ...validTrip, description: {} }
  ];
  for (const body of invalidBodies) {
    assert.equal((await request('POST', '/trips', body, 'admin')).status, 400);
  }
  assert.equal((await request('GET', '/trips')).body.results, 3);
});

test('Admin CRUD trims fields, updates cost and country, and uses IDs that are never reused', async (t) => {
  const request = await setup(t);
  const created = await request('POST', '/trips', {
    destination: '  Rome  ', country: ' Italy ', cost: 500, id: 42
  }, 'admin');
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.data, {
    id: 4, destination: 'Rome', country: 'Italy', cost: 500,
    description: 'No description available'
  });

  const updated = await request('PUT', '/trips/4', {
    destination: '  Milan ', country: ' Italy ', cost: 450, description: ' City break '
  }, 'admin');
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.data, {
    id: 4, destination: 'Milan', country: 'Italy', cost: 450, description: 'City break'
  });
  const partial = await request('PUT', '/trips/4', { cost: 425 }, 'admin');
  assert.equal(partial.body.data.destination, 'Milan');
  assert.equal(partial.body.data.cost, 425);

  const deleted = await request('DELETE', '/trips/4', undefined, 'admin');
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, null);
  assert.equal((await request('GET', '/trips/4')).status, 404);
  const nextTrip = await request('POST', '/api/v1/trips', validTrip, 'admin');
  assert.equal(nextTrip.body.data.id, 5);
  assert.equal((await request('GET', '/trips/5')).status, 200);
  assert.equal((await request('DELETE', '/trips/999', undefined, 'admin')).status, 404);
});

test('Invalid updates leave every existing field unchanged', async (t) => {
  const request = await setup(t);
  const before = (await request('GET', '/trips/1')).body.data;
  for (const body of [{}, { cost: 0 }, { country: ' ' }, { destination: 5 }, { id: 10 }]) {
    assert.equal((await request('PUT', '/trips/1', body, 'admin')).status, 400);
  }
  assert.deepEqual((await request('GET', '/trips/1')).body.data, before);
  assert.equal((await request('PUT', '/trips/999', { cost: 200 }, 'admin')).status, 404);
});

test('Public comparison reports destinations, absolute cost difference, and cheaper trip at both URLs', async (t) => {
  const request = await setup(t);
  const before = (await request('GET', '/trips')).body.data;
  for (const path of ['/trips/compare', '/api/v1/trips/compare']) {
    const comparison = await request('POST', path, { tripId1: 2, tripId2: 1 });
    assert.equal(comparison.status, 200);
    assert.deepEqual(comparison.body.data, {
      destination1: 'Tokyo', destination2: 'Paris', costDifference: 400,
      cheaperDestination: 'Paris', message: 'Paris is cheaper than Tokyo'
    });
  }
  assert.deepEqual((await request('GET', '/trips')).body.data, before);
});

test('Comparison handles equal costs and rejects invalid or unknown IDs without mutation', async (t) => {
  const request = await setup(t);
  await request('PUT', '/trips/2', { cost: 400 }, 'admin');
  const equal = await request('POST', '/trips/compare', { tripId1: 1, tripId2: 2 });
  assert.equal(equal.status, 200);
  assert.equal(equal.body.data.costDifference, 0);
  assert.equal(equal.body.data.cheaperDestination, null);
  assert.match(equal.body.data.message, /Neither trip is cheaper/);

  const before = (await request('GET', '/trips')).body.data;
  for (const body of [
    {}, { tripId1: 1, tripId2: 1 }, { tripId1: 0, tripId2: 2 },
    { tripId1: -1, tripId2: 2 }, { tripId1: 1.5, tripId2: 2 },
    { tripId1: '1', tripId2: 2 }, { tripId1: true, tripId2: 2 },
    { tripId1: null, tripId2: 2 }
  ]) {
    assert.equal((await request('POST', '/trips/compare', body)).status, 400);
  }
  assert.equal((await request('POST', '/trips/compare', { tripId1: 1, tripId2: 999 })).status, 404);
  assert.deepEqual((await request('GET', '/trips')).body.data, before);
});

test('Trip router logs methods and complete request URLs', async (t) => {
  const request = await setup(t);
  const originalLog = console.log;
  const messages = [];
  console.log = (message) => messages.push(message);
  try {
    await request('GET', '/api/v1/trips?check=logging');
    await request('POST', '/trips', validTrip, 'admin');
  } finally {
    console.log = originalLog;
  }
  assert.ok(messages.includes('GET /api/v1/trips?check=logging'));
  assert.ok(messages.includes('POST /trips'));
});
