const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { resetTestDb } = require("./helpers/testDb");
const { query } = require("../models/db");
const { startTestServer, BASE } = require("./helpers/server");

let server;
test.before(async () => {
  await resetTestDb();
  server = await startTestServer();
});
test.after(() => server.stop());

test("upload gambar tersimpan di folder dan bisa diambil", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const png = fs.readFileSync(path.join(__dirname, "..", "scripts", "fixtures", "images", "merah.png"));
  const form = new FormData();
  form.append("image", new Blob([png], { type: "image/png" }), "merah.png");
  const res = await fetch(`${BASE}/api/products/upload-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.match(body.imageUrl, /^\/uploads\/products\/.+\.png$/);
  const img = await fetch(BASE + body.imageUrl);
  assert.strictEqual(img.status, 200);
  assert.strictEqual(img.headers.get("cross-origin-resource-policy"), "cross-origin");
});

test("upload file bukan gambar ditolak", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const form = new FormData();
  form.append("image", new Blob(["<svg/>"], { type: "image/svg+xml" }), "x.svg");
  const res = await fetch(`${BASE}/api/products/upload-image`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form
  });
  assert.strictEqual(res.status, 400);
});

test("harga negatif ditolak", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const [c] = await query("INSERT INTO categories (name) VALUES ('Snack') RETURNING id");
  const res = await server.post("/api/products", { name: "X", price: -1, stock: 1, category_id: c.id }, token);
  assert.strictEqual(res.status, 400);
});

test("PUT produk yang tidak ada dibalas 404", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const [c] = await query("SELECT id FROM categories LIMIT 1");
  const res = await server.put("/api/products/99999", { name: "X", price: 1000, category_id: c.id }, token);
  assert.strictEqual(res.status, 404);
});

test("hard delete produk yang punya riwayat penjualan berhasil", async () => {
  const token = await server.login("superadmin", "rahasia123");
  const [c] = await query("SELECT id FROM categories LIMIT 1");
  const [p] = await query("INSERT INTO products (name, price, stock, category_id) VALUES ('Hapus', 1000, 5, $1) RETURNING id", [c.id]);
  const [u] = await query("SELECT id FROM users WHERE role = 'superadmin'");
  const [s] = await query("INSERT INTO sales (user_id, total_amount) VALUES ($1, 1000) RETURNING id", [u.id]);
  await query("INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES ($1, $2, 1, 1000)", [s.id, p.id]);
  const res = await server.del(`/api/products/${p.id}/hard-delete`, token, { password: "rahasia123" });
  assert.strictEqual(res.status, 200);
  const [item] = await query("SELECT product_id FROM sale_items WHERE sale_id = $1", [s.id]);
  assert.strictEqual(item.product_id, null);
});
