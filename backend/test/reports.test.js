const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { startTestServer } = require("./helpers/server");
const { query, withTransaction } = require("../models/db");
const { createSale } = require("../services/checkout");

let server;
let token;
let user;
let mixedSaleId;
let oldSaleId;
let earlySaleId;
const TOKO_IN_30_DAYS = 26000 + 4000;
const TOTAL_STORE_PROFIT = 26000 + 7000 + 4000 + 1200;

async function product(name, price, stock, categoryId, supplierId = null, tax = 0) {
  const [row] = await query(
    `INSERT INTO products (name, price, stock, category_id, supplier_id, tax_percentage)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, price, stock, categoryId, supplierId, tax]
  );
  return row.id;
}

const sell = (items) =>
  withTransaction((client) => createSale(client, { items, customerName: "Umum", paymentMethod: "Cash", user }));

async function backdate(saleId, sql) {
  await query(`UPDATE sales SET created_at = ${sql} WHERE id = $1`, [saleId]);
  await query("UPDATE transaction_logs SET created_at = (SELECT created_at FROM sales WHERE id = $1) WHERE sale_id = $1", [saleId]);
}

test.before(async () => {
  await resetTestDb();
  [user] = await query("INSERT INTO users (username, password, role) VALUES ('kasir1', 'x', 'cashier') RETURNING id, username");
  const [toko] = await query("INSERT INTO categories (name) VALUES ('Makanan') RETURNING id");
  const [pubj] = await query("INSERT INTO categories (name, is_reseller) VALUES ('PUBJ', true) RETURNING id");
  const [supplier] = await query("INSERT INTO suppliers (name) VALUES ('Bu Ani') RETURNING id");

  const a = await product("Nasi", 10000, 50, toko.id);
  const b = await product("Teh", 5000, 50, toko.id);
  const c = await product("Kerupuk", 2000, 50, toko.id);
  const d = await product("Gorengan", 7000, 50, toko.id);
  const e = await product("Roti", 4000, 50, toko.id);
  const risol = await product("Risol", 3000, 0, pubj.id, supplier.id, 10);
  await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, tax_percentage, price_per_unit)
     VALUES ($1, $2, current_date, 20, 10, 3000)`,
    [risol, supplier.id]
  );
  await query("UPDATE products SET stock = 20 WHERE id = $1", [risol]);

  mixedSaleId = (await sell([
    { product_id: a, quantity: 1 },
    { product_id: b, quantity: 2 },
    { product_id: c, quantity: 3 },
    { product_id: risol, quantity: 4 }
  ])).id;

  oldSaleId = (await sell([{ product_id: d, quantity: 1 }])).id;
  await backdate(oldSaleId, "now() - interval '40 days'");

  earlySaleId = (await sell([{ product_id: e, quantity: 1 }])).id;
  await backdate(
    earlySaleId,
    `CASE WHEN now() >= (current_date + time '00:30') AT TIME ZONE 'Asia/Jakarta'
          THEN (current_date + time '00:30') AT TIME ZONE 'Asia/Jakarta'
          ELSE (current_date + time '00:00:01') AT TIME ZONE 'Asia/Jakarta' END`
  );

  server = await startTestServer();
  token = await server.login("superadmin", "rahasia123");
});
test.after(() => server.stop());

test("GET /api/sales: pajak tidak terkali jumlah item", async () => {
  const res = await server.get("/api/sales", token);
  assert.strictEqual(res.status, 200);
  const sale = res.body.find((s) => s.id === mixedSaleId);
  assert.strictEqual(Number(sale.total_tax_amount), 1200);
  assert.strictEqual(Number(sale.total_store_profit), 26000 + 1200);
  assert.match(sale.categories, /Makanan/);
});

test("dashboard: categoryStats hanya menghitung 30 hari terakhir", async () => {
  const res = await server.get("/api/dashboard", token);
  assert.strictEqual(res.status, 200);
  const cat = res.body.categoryStats.find((c) => c.name === "Makanan");
  assert.strictEqual(Number(cat.total_revenue), TOKO_IN_30_DAYS);
  const pubj = res.body.categoryStats.find((c) => c.name === "PUBJ");
  assert.strictEqual(Number(pubj.total_tax_amount), 1200);
  assert.strictEqual(Number(pubj.total_supplier_amount), 10800);
});

test("laba toko sama di dashboard dan laporan transaksi", async () => {
  const dash = await server.get("/api/dashboard", token);
  const trx = await server.get("/api/transactions", token);
  assert.strictEqual(trx.status, 200);
  const sumTrx = trx.body.reduce((sum, r) => sum + Number(r.keuntungan_toko), 0);
  assert.strictEqual(Math.round(dash.body.totalStats.storeProfit * 100), Math.round(sumTrx * 100));
  assert.strictEqual(Math.round(sumTrx * 100), TOTAL_STORE_PROFIT * 100);

  const [{ today }] = await query("SELECT current_date::text AS today");
  const detail = await server.get(`/api/sales/revenue/detail?type=daily&date=${today}`, token);
  assert.strictEqual(detail.status, 200);
  const sumDetail = detail.body.reduce((sum, r) => sum + Number(r.keuntungan_toko), 0);
  assert.strictEqual(Math.round(sumDetail * 100), (26000 + 1200 + 4000) * 100);
});

test("transaksi jam 00:30 WIB masuk hari ini", async () => {
  const res = await server.get("/api/dashboard", token);
  assert.strictEqual(res.body.todayStats.transactions, 2);
  assert.strictEqual(Math.round(res.body.todayStats.storeProfit * 100), (26000 + 1200 + 4000) * 100);
});

test("transactions/bydate mencakup hari terakhir penuh", async () => {
  const [{ today }] = await query("SELECT current_date::text AS today");
  const res = await server.get(`/api/transactions/bydate?startDate=${today}&endDate=${today}`, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.length, 5);
});

test("sales/revenue: laba toko per hari tidak terkali", async () => {
  const res = await server.get("/api/sales/revenue", token);
  assert.strictEqual(res.status, 200);
  const today = res.body.daily[0];
  assert.strictEqual(Number(today.transaction_count), 2);
  assert.strictEqual(Math.round(Number(today.store_profit) * 100), (26000 + 1200 + 4000) * 100);
  const detail = await server.get(`/api/sales/revenue/detail?type=daily&date=${today.date}`, token);
  const sumDetail = detail.body.reduce((sum, r) => sum + Number(r.keuntungan_toko), 0);
  assert.strictEqual(Math.round(Number(today.store_profit) * 100), Math.round(sumDetail * 100));
});

test("sales/chart monthly memberi label bulan Indonesia", async () => {
  const res = await server.get("/api/sales/chart?view=monthly", token);
  assert.strictEqual(res.status, 200);
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  assert.ok(res.body.labels.every((l) => names.includes(l)));
  assert.strictEqual(res.body.labels.length, res.body.values.length);
});

test("dashboard/revenue dan sales/:id dan tax-report merespons", async () => {
  const rev = await server.get("/api/dashboard/revenue", token);
  assert.strictEqual(rev.status, 200);
  assert.strictEqual(Math.round(Number(rev.body.daily[0].keuntungan_toko) * 100), (26000 + 1200 + 4000) * 100);
  assert.match(rev.body.weekly[0].periode, /^Minggu [1-5] - [A-Za-z]+ \d{4}$/);
  assert.match(rev.body.monthly[0].periode, /^[A-Za-z]+ \d{4}$/);
  const one = await server.get(`/api/sales/${mixedSaleId}`, token);
  assert.strictEqual(one.body.items.length, 4);
  const tax = await server.get("/api/sales/tax-report", token);
  assert.strictEqual(tax.body.summary.total_tax_amount, 1200);
  const cashier = await server.get("/api/dashboard/cashier", token);
  assert.strictEqual(cashier.status, 200);
});
