const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { startTestServer } = require("./helpers/server");

let server;
test.before(async () => {
  await resetTestDb();
  server = await startTestServer();
});
test.after(() => server.stop());

test("login superadmin berhasil", async () => {
  const res = await server.post("/api/auth/login", { username: "superadmin", password: "rahasia123" });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
});

test("profil tanpa username ditolak 400", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const res = await server.put("/api/auth/profile", { newPassword: "x" }, token);
  assert.strictEqual(res.status, 400);
});

test("hapus kasir yang punya transaksi dibalas 409", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const kasirId = await server.seedCashierWithSale();
  const res = await server.del(`/api/users/cashiers/${kasirId}`, token);
  assert.strictEqual(res.status, 409);
});
