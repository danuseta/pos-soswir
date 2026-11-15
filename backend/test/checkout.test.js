const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { pool, query, withTransaction } = require("../models/db");
const { validateItems, mergeItems, createSale } = require("../services/checkout");

let user;
let toko;
let pubj;
let supplier;

test.before(async () => {
  await resetTestDb();
  [user] = await query("INSERT INTO users (username, password, role) VALUES ('kasir1', 'x', 'cashier') RETURNING id, username");
  [toko] = await query("INSERT INTO categories (name) VALUES ('Makanan') RETURNING id");
  [pubj] = await query("INSERT INTO categories (name, is_reseller) VALUES ('PUBJ', true) RETURNING id");
  [supplier] = await query("INSERT INTO suppliers (name) VALUES ('Bu Ani') RETURNING id");
});
test.after(() => pool.end());

async function product(name, price, stock, extra = {}) {
  const [row] = await query(
    `INSERT INTO products (name, price, stock, category_id, supplier_id, tax_percentage, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, price, stock, extra.category ?? toko.id, extra.supplier ?? null, extra.tax ?? 0, extra.active ?? true]
  );
  return row.id;
}

const sell = (items) =>
  withTransaction((client) => createSale(client, { items, customerName: "Umum", paymentMethod: "Cash", user }));

test("validateItems menolak qty nol, negatif, desimal, dan kosong", () => {
  assert.ok(validateItems([]));
  assert.ok(validateItems([{ product_id: 1, quantity: 0 }]));
  assert.ok(validateItems([{ product_id: 1, quantity: -5 }]));
  assert.ok(validateItems([{ product_id: 1, quantity: 1.5 }]));
  assert.ok(validateItems([{ product_id: "1", quantity: 1 }]));
  assert.strictEqual(validateItems([{ product_id: 1, quantity: 2 }]), null);
});

test("mergeItems menggabung produk ganda dan mengurutkan", () => {
  assert.deepStrictEqual(
    mergeItems([{ product_id: 5, quantity: 1 }, { product_id: 2, quantity: 1 }, { product_id: 5, quantity: 2 }]),
    [{ product_id: 2, quantity: 1 }, { product_id: 5, quantity: 3 }]
  );
});

test("harga dari database, bukan dari client", async () => {
  const id = await product("Nasi Goreng", 15000, 10);
  const sale = await sell([{ product_id: id, quantity: 2, price: 1 }]);
  assert.strictEqual(sale.total, 30000);
  const [item] = await query("SELECT price_at_sale FROM sale_items WHERE sale_id = $1", [sale.id]);
  assert.strictEqual(item.price_at_sale, "15000.00");
  const [p] = await query("SELECT stock FROM products WHERE id = $1", [id]);
  assert.strictEqual(p.stock, 8);
});

test("stok kurang ditolak dan tidak ada yang tersimpan", async () => {
  const id = await product("Es Teh", 5000, 1);
  await assert.rejects(sell([{ product_id: id, quantity: 2 }]), (e) => e.status === 400);
  const [p] = await query("SELECT stock FROM products WHERE id = $1", [id]);
  assert.strictEqual(p.stock, 1);
});

test("produk nonaktif ditolak", async () => {
  const id = await product("Lama", 5000, 10, { active: false });
  await assert.rejects(sell([{ product_id: id, quantity: 1 }]), (e) => e.status === 400);
});

test("checkout menunggu lock baris, lalu ditolak karena stok habis (bukan CHECK)", async () => {
  const id = await product("Terakhir", 5000, 1);
  const holder = await pool.connect();
  let blocked;
  try {
    await holder.query("BEGIN");
    await holder.query("UPDATE products SET stock = 0 WHERE id = $1", [id]);
    blocked = sell([{ product_id: id, quantity: 1 }]).then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason })
    );
    for (;;) {
      const waiting = await query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()");
      if (waiting.length > 0) break;
    }
    await holder.query("COMMIT");
  } finally {
    holder.release();
  }
  const result = await blocked;
  assert.strictEqual(result.status, "rejected");
  assert.strictEqual(result.reason.status, 400);
  assert.match(result.reason.message, /tidak mencukupi/);
  const [p] = await query("SELECT stock FROM products WHERE id = $1", [id]);
  assert.strictEqual(p.stock, 0);
});

test("PUBJ: fee memakai persentase entry harian, stok katalog ikut turun", async () => {
  const id = await product("Risol", 3000, 0, { category: pubj.id, supplier: supplier.id, tax: 10 });
  const [entry] = await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, tax_percentage, price_per_unit)
     VALUES ($1, $2, current_date, 20, 10, 3000) RETURNING id`,
    [id, supplier.id]
  );
  await query("UPDATE products SET stock = 20, tax_percentage = 25 WHERE id = $1", [id]);

  const sale = await sell([{ product_id: id, quantity: 4 }]);

  const [tax] = await query("SELECT tax_percentage, tax_amount, supplier_amount FROM sale_taxes WHERE sale_id = $1", [sale.id]);
  assert.strictEqual(tax.tax_percentage, "10.00");
  assert.strictEqual(tax.tax_amount, "1200.00");
  assert.strictEqual(tax.supplier_amount, "10800.00");

  const [e] = await query("SELECT quantity_sold, total_revenue, store_fee, supplier_earning FROM daily_stock_entries WHERE id = $1", [entry.id]);
  assert.deepStrictEqual(e, { quantity_sold: 4, total_revenue: "12000.00", store_fee: "1200.00", supplier_earning: "10800.00" });

  const [p] = await query("SELECT stock FROM products WHERE id = $1", [id]);
  assert.strictEqual(p.stock, 16);
});

test("PUBJ tanpa entry hari ini ditolak", async () => {
  const id = await product("Lemper", 3000, 5, { category: pubj.id, supplier: supplier.id, tax: 10 });
  await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, tax_percentage, price_per_unit)
     VALUES ($1, $2, current_date - 1, 5, 10, 3000)`,
    [id, supplier.id]
  );
  await assert.rejects(sell([{ product_id: id, quantity: 1 }]), (e) => e.status === 400 && /belum ada stok hari ini/.test(e.message));
});
