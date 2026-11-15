const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { query } = require("../models/db");
const { startTestServer } = require("./helpers/server");

let server;
test.before(async () => {
  await resetTestDb();
  server = await startTestServer();
});
test.after(() => server.stop());

test("total supplier tidak terkali jumlah produk", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const [s] = await query("INSERT INTO suppliers (name) VALUES ('Bu Ani') RETURNING id");
  const [c] = await query("INSERT INTO categories (name, is_reseller) VALUES ('PUBJ', true) RETURNING id");
  const [p1] = await query("INSERT INTO products (name, price, category_id, supplier_id, tax_percentage) VALUES ('Risol', 2000, $1, $2, 10) RETURNING id", [c.id, s.id]);
  await query("INSERT INTO products (name, price, category_id, supplier_id, tax_percentage) VALUES ('Lemper', 2000, $1, $2, 10)", [c.id, s.id]);
  await query("INSERT INTO products (name, price, category_id, supplier_id, tax_percentage) VALUES ('Pastel', 2000, $1, $2, 10)", [c.id, s.id]);
  await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, quantity_sold, total_revenue, supplier_earning)
     VALUES ($1, $2, current_date, 10, 5, 10000, 9000)`,
    [p1.id, s.id]
  );

  const res = await server.get("/api/suppliers", token);
  const row = res.body.find((r) => r.id === s.id);
  assert.strictEqual(row.product_count, 3);
  assert.strictEqual(Number(row.total_revenue), 10000);
  assert.strictEqual(Number(row.total_earnings), 9000);
});

test("PUT settings upsert", async () => {
  const token = await server.login("superadmin", "rahasia123");
  await server.put("/api/settings", { store_name: "Toko A", store_phone: "1" }, token);
  await server.put("/api/settings", { store_name: "Toko B", store_phone: "1" }, token);
  const res = await server.get("/api/settings", token);
  assert.strictEqual(res.body.store_name, "Toko B");
  assert.strictEqual(res.body.store_phone, "1");
});
