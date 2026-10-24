const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../index");

async function startApi(t) {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/users`;
  return async function request(method, suffix = "", body) {
    const response = await fetch(base + suffix, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
}

const sara = { name: "Sara", email: "sara@example.com" };

test("users: POST creates a trimmed user containing only id, name and email", async (t) => {
  const request = await startApi(t);
  assert.deepEqual(await request("GET"), { status: 200, body: [] });
  const created = await request("POST", "", {
    id: 999, name: " Sara ", email: " sara@example.com ", role: "admin"
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { id: 1, ...sara });
  assert.deepEqual(await request("GET"), { status: 200, body: [created.body] });
  assert.deepEqual(await request("GET", "/1"), { status: 200, body: created.body });
});

test("users: POST rejects missing, non-string and blank name or email", async (t) => {
  const request = await startApi(t);
  const invalidBodies = [
    {}, { name: "Sara" }, { email: sara.email },
    { name: 42, email: sara.email }, { name: "Sara", email: 42 },
    { name: "  ", email: sara.email }, { name: "Sara", email: " \t " },
    { name: null, email: sara.email }, { name: "Sara", email: null }, []
  ];
  for (const body of invalidBodies) {
    assert.equal((await request("POST", "", body)).status, 400);
  }
  assert.equal((await request("POST")).status, 400);
  assert.deepEqual((await request("GET")).body, []);
});

test("users: PUT requires both fields, updates both and preserves the ID", async (t) => {
  const request = await startApi(t);
  await request("POST", "", sara);
  for (const body of [{ name: "Ali" }, { email: "ali@example.com" },
    { name: " ", email: "ali@example.com" }, { name: "Ali", email: 5 }]) {
    assert.equal((await request("PUT", "/1", body)).status, 400);
  }
  const updated = await request("PUT", "/1", {
    id: 700, name: " Ali ", email: " ali@example.com ", ignored: true
  });
  assert.deepEqual(updated, {
    status: 200, body: { id: 1, name: "Ali", email: "ali@example.com" }
  });
  assert.deepEqual(await request("GET", "/1"), updated);
});

test("users: invalid IDs return 400 for GET, PUT and DELETE", async (t) => {
  const request = await startApi(t);
  await request("POST", "", sara);
  for (const id of ["0", "-1", "1.5", "abc", "1e0", "0x1", "9007199254740992"]) {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await request(method, `/${id}`, method === "PUT" ? sara : undefined);
      assert.equal(response.status, 400, `${method} /${id}`);
    }
  }
});

test("users: unknown positive IDs return 404", async (t) => {
  const request = await startApi(t);
  for (const method of ["GET", "PUT", "DELETE"]) {
    const response = await request(method, "/100", method === "PUT" ? sara : undefined);
    assert.equal(response.status, 404);
    assert.equal(response.body.message, "User not found");
  }
});

test("users: DELETE confirms removal; creating after deletion never reuses an ID", async (t) => {
  const request = await startApi(t);
  const first = (await request("POST", "", sara)).body;
  const second = (await request("POST", "", { name: "Ali", email: "ali@example.com" })).body;
  const third = (await request("POST", "", { name: "Mona", email: "mona@example.com" })).body;
  const removed = await request("DELETE", `/${second.id}`);
  assert.equal(removed.status, 200);
  assert.equal(typeof removed.body.message, "string");
  assert.equal((await request("GET", `/${second.id}`)).status, 404);
  assert.equal((await request("DELETE", `/${second.id}`)).status, 404);
  const fourth = (await request("POST", "", { name: "Omar", email: "omar@example.com" })).body;
  assert.ok(fourth.id > third.id);
  assert.equal(new Set([first.id, second.id, third.id, fourth.id]).size, 4);
  assert.deepEqual((await request("GET")).body.map((user) => user.id), [first.id, third.id, fourth.id]);
});

test("users: application instances keep their in-memory arrays independent", async (t) => {
  const first = await startApi(t);
  const second = await startApi(t);
  await first("POST", "", sara);
  assert.deepEqual((await second("GET")).body, []);
});
