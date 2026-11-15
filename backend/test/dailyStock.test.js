const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { startTestServer } = require("./helpers/server");
const { query, withTransaction } = require("../models/db");
const { completeEntries } = require("../services/dailyStock");

let server;
let token;
let categoryId;
let supplier;

async function makeProduct(name, price = 2500, tax = 10) {
  const [p] = await query(
    "INSERT INTO products (name, price, category_id, supplier_id, tax_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [name, price, categoryId, supplier.id, tax]
  );
  return p.id;
}

async function makeEntry(productId, quantityIn, quantitySold = 0) {
  const [e] = await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, quantity_sold, tax_percentage, price_per_unit)
     VALUES ($1, $2, current_date, $3, $4, 10, 2500) RETURNING id`,
    [productId, supplier.id, quantityIn, quantitySold]
  );
  return e.id;
}

test.before(async () => {
  await resetTestDb();
  server = await startTestServer();
  token = await server.login("superadmin", "rahasia123");
  [{ id: categoryId }] = await query("INSERT INTO categories (name, is_reseller) VALUES ('PUBJ', true) RETURNING id");
  [supplier] = await query("INSERT INTO suppliers (name) VALUES ('Pak Budi') RETURNING id");
});
test.after(() => server.stop());

test("completeEntries menutup entry hari ini dan yang tertinggal, revenue tidak dihitung ulang", async () => {
  const productId = await makeProduct("Kue", 2000);
  await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, quantity_sold, total_revenue, store_fee, supplier_earning, tax_percentage, price_per_unit)
     VALUES ($1, $2, current_date - 2, 10, 3, 6000, 600, 5400, 10, 2000),
            ($1, $2, current_date, 10, 4, 8000, 800, 7200, 10, 2000)`,
    [productId, supplier.id]
  );
  await query("UPDATE products SET price = 9999 WHERE id = $1", [productId]);

  const result = await withTransaction((client) => completeEntries(client, null));
  assert.strictEqual(result.completed, 2);

  const rows = await query(
    "SELECT status, quantity_returned, total_revenue FROM daily_stock_entries WHERE product_id = $1 ORDER BY entry_date",
    [productId]
  );
  assert.deepStrictEqual(rows, [
    { status: "completed", quantity_returned: 7, total_revenue: "6000.00" },
    { status: "completed", quantity_returned: 6, total_revenue: "8000.00" }
  ]);
  const [p] = await query("SELECT stock FROM products WHERE id = $1", [productId]);
  assert.strictEqual(p.stock, 0);
});

test("end-of-day menutup entry aktif hari ini", async () => {
  const productId = await makeProduct("EOD");
  const entryId = await makeEntry(productId, 5, 2);
  const res = await server.post("/api/daily-stock/end-of-day", {}, token);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.completed_count >= 1);
  const [e] = await query("SELECT status, quantity_returned FROM daily_stock_entries WHERE id = $1", [entryId]);
  assert.deepStrictEqual(e, { status: "completed", quantity_returned: 3 });
});

test("PUT quantity_in kurang dari quantity_sold ditolak 400", async () => {
  const productId = await makeProduct("Edit1");
  const entryId = await makeEntry(productId, 10, 6);
  const res = await server.put(`/api/daily-stock/${entryId}`, { quantity_in: 4 }, token);
  assert.strictEqual(res.status, 400);
  const [e] = await query("SELECT quantity_in FROM daily_stock_entries WHERE id = $1", [entryId]);
  assert.strictEqual(e.quantity_in, 10);
});

test("PUT quantity_in bukan angka ditolak 400", async () => {
  const productId = await makeProduct("Edit2");
  const entryId = await makeEntry(productId, 10, 1);
  const res = await server.put(`/api/daily-stock/${entryId}`, { quantity_in: "abc" }, token);
  assert.strictEqual(res.status, 400);
});

test("POST stok harian mengisi price_per_unit dan tax dari produk", async () => {
  const productId = await makeProduct("Baru", 2500, 15);
  const res = await server.post(
    "/api/daily-stock",
    { product_id: productId, supplier_id: supplier.id, quantity_in: 8 },
    token
  );
  assert.strictEqual(res.status, 201);
  const [e] = await query("SELECT price_per_unit, tax_percentage, entry_date::text AS d FROM daily_stock_entries WHERE id = $1", [res.body.id]);
  assert.strictEqual(e.price_per_unit, "2500.00");
  assert.strictEqual(Number(e.tax_percentage), 15);
  const [{ today }] = await query("SELECT current_date::text AS today");
  assert.strictEqual(e.d, today);
});
