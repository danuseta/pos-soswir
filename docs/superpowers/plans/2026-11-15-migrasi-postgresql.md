# Migrasi PostgreSQL, Gambar Lokal, dan Laporan Skenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend POS Soswir pindah penuh dari MySQL ke PostgreSQL 17, gambar produk disimpan di folder lokal (bukan Cloudinary), bug hasil audit 2026-11-15 ikut diperbaiki, lalu semua skenario bisnis diuji dan hasilnya jadi laporan HTML bergambar.

**Architecture:** Satu modul `backend/models/db.js` berbasis `pg` menyediakan `query()` dan `withTransaction()`; route tidak lagi memegang koneksi manual sehingga kelas bug "koneksi bocor" hilang secara struktural. Skema hidup di satu file `backend/db/schema.sql`, tidak ada lagi `CREATE TABLE`/`ALTER` saat startup. Logika checkout dan stok harian dipindah ke `backend/services/` agar bisa diuji langsung terhadap database `pos_test`. Sesi Postgres memakai `timezone=Asia/Jakarta`, jadi `current_date` dan `to_char` otomatis WIB. Frontend tidak berubah kecuali cara menampilkan dan mengunggah gambar.

**Tech Stack:** Node 24.14, Express 4, `pg` 8.x, PostgreSQL 17.2 lokal (`C:\Program Files\PostgreSQL\17`, service `postgresql-x64-17`, port 5432), `node:test`, `multer` diskStorage, `node-cron`, Playwright (devDependency backend, khusus screenshot laporan), SvelteKit + Svelte 4.

**Audit acuan:** temuan #1-#13 di percakapan 2026-11-15 (ringkas di bagian "Peta bug ke task" di bawah).

## Global Constraints

- Semua pekerjaan di branch baru `feat/migrasi-postgresql` yang dibuat dari `feat/jadwal-shift-kasir` (branch itu belum di-merge, dan kerja shift adalah dasar kode sekarang).
- DB utama Postgres: `pos_db`. DB test: `pos_test`. DB skenario: `pos_scenario`. Fungsi yang men-drop database **wajib menolak** nama yang tidak berakhiran `_test` atau `_scenario`.
- MySQL `pos_db` hanya dibaca (oleh script migrasi data). Tidak boleh ada tulis ke MySQL.
- Zona waktu bisnis `Asia/Jakarta`. Diset sekali di opsi koneksi pool (`-c timezone=Asia/Jakarta`). Jangan pakai `toISOString().split('T')[0]` untuk tanggal bisnis.
- Kolom waktu memakai `timestamptz`. Kolom flag memakai `boolean`.
- `NUMERIC` tetap dikembalikan sebagai string (sama seperti `mysql2` dulu, frontend sudah `parseFloat`). `bigint` (`COUNT(*)`) dikembalikan sebagai number. `date` dikembalikan sebagai string `YYYY-MM-DD`.
- Harga transaksi selalu dari database. Nilai `price` dan `total_amount` kiriman client diabaikan.
- Gambar produk: `backend/uploads/products/`, hanya `image/jpeg`, `image/png`, `image/webp`, maksimal 5 MB. Folder ini masuk `.gitignore` kecuali `.gitkeep`.
- Jangan menambah dependency runtime selain `pg`. `playwright` dan `mysql2` (untuk script migrasi data) boleh sebagai devDependency.
- Placeholder SQL memakai `$1, $2, ...` ditulis eksplisit. Tidak ada helper konversi `?`.
- Pesan error untuk pengguna dalam Bahasa Indonesia.
- Commit message tanpa trailer `Co-Authored-By`.
- Shell lewat `rtk` sesuai aturan user (subagent juga).

## Keputusan yang perlu dikonfirmasi user sebelum Task 10

| # | Pertanyaan | Default yang dipakai plan ini |
|---|---|---|
| K1 | Laba toko untuk produk non-PUBJ: 100% omzet (dashboard sekarang) atau 20% (laporan transaksi sekarang)? | **100% omzet**, karena tidak ada data harga modal; angka 20% tidak punya dasar data. Satu rumus dipakai di semua laporan. |
| K2 | File mati `backend/app.js`, `routes/activity.js`, `routes/fixed-users.js` (tidak di-mount di `index.js`, isinya MySQL) | **Dihapus** di Task 12 |
| K3 | Kolom `products.supplier_name` dan tabel `product_deletion_audit` (tidak dipakai kode mana pun) | **Tidak dibawa** ke skema Postgres |
| K4 | Gambar fixture untuk skenario | Dibangkitkan script (PNG polos berlabel warna). Kalau user punya foto produk sendiri, taruh di `backend/scripts/fixtures/images/` dan script memakainya |

## Peta bug ke task

| Bug audit | Inti | Diperbaiki di |
|---|---|---|
| #1 | harga dari client | Task 8 |
| #2 | qty negatif / desimal | Task 8 |
| #3 | oversell tanpa lock | Task 8 |
| #4 | end-of-day `NaN` | Task 9 |
| #5 | PUT stok harian tanpa validasi | Task 9 |
| #6 | stok PUBJ katalog vs checkout beda | Task 8, Task 9 |
| #7 | fee pajak beda sumber | Task 8 |
| #8 | fan-out supplier | Task 6 |
| #9 | fan-out GET /sales | Task 10 |
| #10 | filter 30 hari di ON | Task 10 |
| #11 | rumus laba beda | Task 10 (K1) |
| #12 | revenue dihitung ulang pakai harga baru | Task 8, Task 9 |
| #13 | tanggal UTC | Task 2 (timezone sesi), Task 9 |
| koneksi bocor | semua route | Task 2 (pola), Task 5-11 |
| hard delete NOT NULL | products | Task 7 |
| profil tanpa username | auth | Task 5 |
| hapus kasir ber-transaksi | users | Task 5 |
| produk nonaktif terjual | sales | Task 8 |
| `recentActivities` tanpa LIMIT | dashboard | Task 10 |

## Aturan terjemahan MySQL ke PostgreSQL

Dipakai di semua task port (Task 5-11). Setiap query yang disentuh wajib mengikuti tabel ini.

| MySQL | PostgreSQL |
|---|---|
| `?` | `$1`, `$2`, ... |
| `const [rows] = await connection.query(sql, p)` | `const rows = await query(sql, p)` |
| `result.insertId` | `INSERT ... RETURNING id` lalu `rows[0].id` |
| `result.affectedRows` | `const { rowCount } = await pool.query(...)` |
| `CURDATE()` | `current_date` |
| `NOW()`, `UTC_TIMESTAMP()` | `now()` |
| `DATE(x)` | `x::date` |
| `DATE_SUB(NOW(), INTERVAL 30 DAY)` | `now() - interval '30 days'` |
| `DATE_SUB(CURDATE(), INTERVAL 30 DAY)` | `current_date - 30` |
| `INTERVAL ${n} DAY` (interpolasi) | `make_interval(days => $n)` (parameter, bukan interpolasi) |
| `DATE_FORMAT(x, '%Y-%m-%d')` | `to_char(x, 'YYYY-MM-DD')` |
| `DATE_FORMAT(x, '%Y-%m')` | `to_char(x, 'YYYY-MM')` |
| `YEAR(x)` / `MONTH(x)` | `EXTRACT(YEAR FROM x)::int` / `EXTRACT(MONTH FROM x)::int` |
| `WEEK(x, 1)` | `EXTRACT(WEEK FROM x)::int` (ISO week, Senin awal) |
| `WEEK(x)` (mode 0) | `EXTRACT(WEEK FROM x)::int` juga, label "Minggu N" tetap |
| `DAYOFMONTH(x)` | `EXTRACT(DAY FROM x)::int` |
| `MONTHNAME(x)` | `trim(to_char(x, 'TMMonth'))`, atau map angka bulan ke nama Indonesia di JS (lebih disukai) |
| `GROUP_CONCAT(DISTINCT c.name)` | `string_agg(DISTINCT c.name, ',')` |
| `ON DUPLICATE KEY UPDATE v = ?` | `ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value` |
| `is_active = 1` / `= 0` | `is_active = true` / `= false` |
| `COALESCE(c.is_reseller, 0)` | `COALESCE(c.is_reseller, false)` |
| `CONVERT_TZ(u.created_at, '+07:00', '+00:00')` | `u.created_at` (sudah `timestamptz`) |
| `ER_DUP_ENTRY` | `error.code === '23505'` |
| FK gagal (`ER_ROW_IS_REFERENCED_2`) | `error.code === '23503'` |
| `SELECT s.*, ... GROUP BY s.id` | sah di Postgres karena `s.id` primary key; biarkan |
| `LIMIT ?` dengan angka | `LIMIT $n` |

Pola route standar setelah port:

```js
router.get("/", authenticateToken, async (req, res) => {
  try {
    const rows = await query("SELECT ...", [/* params */]);
    res.json(rows);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Error ...:", error);
    res.status(500).json({ message: "Server error ..." });
  }
});
```

Tidak ada `pool.getConnection()` / `connection.release()` di route mana pun setelah migrasi.

## File Structure

**Backend, dibuat baru**

| File | Tanggung jawab |
|---|---|
| `backend/db/schema.sql` | Seluruh skema Postgres. Satu-satunya sumber DDL. |
| `backend/db/setup.js` | `createDatabaseIfMissing(name)`, `recreateDatabase(name)` (dijaga suffix), `applySchema(name)`. |
| `backend/db/init.js` | CLI `npm run db:init`: buat `pos_db` jika belum ada, pasang skema jika kosong, buat superadmin default. |
| `backend/db/migrate-from-mysql.js` | CLI `npm run db:migrate-mysql`: salin data MySQL `pos_db` ke Postgres `pos_db`, set ulang sequence, cocokkan jumlah baris. |
| `backend/utils/httpError.js` | `class HttpError extends Error` dengan `status`. |
| `backend/services/checkout.js` | `validateItems`, `mergeItems`, `createSale(client, input)`. |
| `backend/services/dailyStock.js` | `refreshPubjStock(client, productId)`, `completeEntries(client, upToDate)`. |
| `backend/utils/imageStorage.js` | multer diskStorage, `deleteProductImage(filename)`. |
| `backend/test/helpers/testDb.js` | Siapkan `pos_test` bersih untuk test integrasi. |
| `backend/test/db.test.js` | Test parser tipe + timezone. |
| `backend/test/checkout.test.js` | Test checkout (harga, qty, oversell, PUBJ). |
| `backend/test/dailyStock.test.js` | Test stok harian. |
| `backend/test/reports.test.js` | Test angka laporan (fan-out). |
| `backend/uploads/products/.gitkeep` | Folder gambar produk. |
| `backend/scripts/fixtures/make-images.js` | Bangkitkan PNG fixture tanpa dependency. |
| `backend/scripts/scenario/run.js` | Runner skenario (menggantikan `scenario-runtime.js`). |
| `backend/scripts/scenario/scenarios.js` | Daftar skenario S01-S24. |
| `backend/scripts/scenario/screens.js` | Screenshot UI pakai Playwright. |
| `backend/scripts/scenario/report.js` | Bangun `reports/skenario-<tanggal>.html` dari `results.json`. |

**Backend, diubah**

| File | Perubahan |
|---|---|
| `backend/models/db.js` | Ganti total: `pg` Pool, parser tipe, `query`, `withTransaction`. |
| `backend/index.js` | Hapus `create*Table`, tambah static `/uploads`, helmet CORP `cross-origin`. |
| `backend/middleware/authMiddleware.js` | Tidak berubah logika; ikut `shiftAccess`. |
| `backend/utils/shiftAccess.js` | Port query. |
| `backend/utils/activityCleanup.js` | MySQL EVENT diganti `node-cron`. |
| `backend/utils/dailyStockScheduler.js` | Pakai `services/dailyStock.completeEntries`. |
| semua file di `backend/routes/` | Port sesuai aturan terjemahan + fix bug. |
| `backend/package.json` | `pg` masuk, `mysql2`/`cloudinary`/`bcrypt` keluar dari dependencies; script baru. |
| `backend/.env.example` | `DB_PORT=5432`, hapus `CLOUDINARY_*`. |
| `.gitignore` | `backend/uploads/products/*`, `!backend/uploads/products/.gitkeep`, `backend/reports/`. |

**Backend, dihapus**

`backend/models/product.js`, `models/sale.js`, `models/settings.js`, `models/shift.js`, `models/activity.js` (bagian `createActivityLogTable`; `getRecentActivities` dipindah jika masih dipakai, cek dengan `rtk rg "getRecentActivities" backend`), `backend/config/cloudinary.js`, `backend/app.js`, `backend/routes/activity.js`, `backend/routes/fixed-users.js`, `backend/scripts/scenario-runtime.js`, `pos.sql` (dipindah ke `docs/archive/pos-mysql.sql` sebagai arsip).

**Frontend, diubah**

| File | Perubahan |
|---|---|
| `frontend/src/lib/utils/product.ts` | `imageSrc(url)`; payload `image_filename` menggantikan `public_id`. |
| `frontend/src/routes/superadmin/products/+page.svelte` | `cloudinaryPublicId` jadi `imageFilename`; pesan batas 5MB. |
| `frontend/src/lib/components/pos/ProductCatalog.svelte` | `src={imageSrc(product.image_url)}` |
| `frontend/src/lib/components/products/CashierProductTable.svelte` | idem |
| `frontend/src/lib/components/products/ProductManagementTable.svelte` | idem |

---

### Task 1: Branch, database Postgres, dan skema

**Files:**
- Create: `backend/db/schema.sql`, `backend/db/setup.js`, `backend/db/init.js`
- Modify: `backend/package.json`, `backend/.env`, `backend/.env.example`

**Interfaces:**
- Produces: `setup.createDatabaseIfMissing(name: string): Promise<void>`, `setup.recreateDatabase(name: string): Promise<void>`, `setup.applySchema(name: string): Promise<void>`, `setup.adminConfig(database: string): object`

- [ ] **Step 1: Branch dan dependency**

```bash
cd /e/pos-soswir
git checkout -b feat/migrasi-postgresql
cd backend
npm install pg@8
```

- [ ] **Step 2: Kredensial Postgres**

User mengisi password role `postgres` (atau role khusus `pos`) di `backend/.env`. Agent **tidak** menebak password.

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<diisi user>
DB_NAME=pos_db
```

Kredensial MySQL lama untuk script migrasi data disimpan terpisah:

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=<password mysql lama>
MYSQL_DATABASE=pos_db
```

Cek koneksi:

```bash
PGPASSWORD=<pw> "/c/Program Files/PostgreSQL/17/bin/psql" -h localhost -U postgres -c "select version()"
```

Expected: satu baris `PostgreSQL 17.2`.

- [ ] **Step 3: Tulis `backend/db/schema.sql`**

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE shifts (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  label varchar(50) NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_shift_slot UNIQUE (start_time, end_time)
);

CREATE TABLE users (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username varchar(255) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'cashier' CHECK (role IN ('cashier', 'superadmin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  shift_id integer REFERENCES shifts(id) ON DELETE SET NULL
);

CREATE TABLE categories (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  description text,
  icon_name varchar(100),
  is_reseller boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  phone varchar(20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  image_url varchar(500),
  image_filename varchar(255),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
  tax_percentage numeric(5,2) NOT NULL DEFAULT 0,
  tax_description varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_is_active ON products (is_active);

CREATE TABLE daily_stock_entries (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  quantity_in integer NOT NULL DEFAULT 0 CHECK (quantity_in >= 0),
  quantity_sold integer NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  quantity_returned integer NOT NULL DEFAULT 0,
  total_revenue numeric(10,2) NOT NULL DEFAULT 0,
  supplier_earning numeric(10,2) NOT NULL DEFAULT 0,
  store_fee numeric(10,2) NOT NULL DEFAULT 0,
  tax_percentage numeric(5,2) NOT NULL DEFAULT 0,
  price_per_unit numeric(10,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'returned')),
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_daily_entry UNIQUE (product_id, supplier_id, entry_date),
  CONSTRAINT sold_not_above_in CHECK (quantity_sold <= quantity_in)
);
CREATE INDEX idx_dse_date_status ON daily_stock_entries (entry_date, status);
CREATE INDEX idx_dse_supplier_date ON daily_stock_entries (supplier_id, entry_date);

CREATE TABLE sales (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  customer_name varchar(255) NOT NULL DEFAULT 'Umum',
  total_amount numeric(12,2) NOT NULL,
  payment_method varchar(50) NOT NULL DEFAULT 'Cash',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_created_at ON sales (created_at);

CREATE TABLE sale_items (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price_at_sale numeric(10,2) NOT NULL,
  daily_stock_entry_id integer REFERENCES daily_stock_entries(id) ON DELETE SET NULL
);
CREATE INDEX idx_sale_items_sale ON sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON sale_items (product_id);

CREATE TABLE sale_taxes (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  category_name varchar(255) NOT NULL,
  gross_amount numeric(12,2) NOT NULL,
  tax_percentage numeric(5,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL,
  net_amount numeric(12,2) NOT NULL,
  store_profit numeric(12,2) NOT NULL,
  supplier_amount numeric(12,2) NOT NULL,
  quantity integer NOT NULL,
  price_per_item numeric(10,2) NOT NULL,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name varchar(255) NOT NULL,
  daily_stock_entry_id integer REFERENCES daily_stock_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_taxes_sale ON sale_taxes (sale_id);

CREATE TABLE transaction_logs (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  username varchar(255),
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name varchar(255) NOT NULL,
  quantity integer NOT NULL,
  price numeric(10,2) NOT NULL,
  total numeric(12,2) NOT NULL,
  daily_stock_entry_id integer REFERENCES daily_stock_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tl_created_at ON transaction_logs (created_at);
CREATE INDEX idx_tl_user ON transaction_logs (user_id);

CREATE TABLE store_settings (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  setting_key varchar(255) NOT NULL UNIQUE,
  setting_value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_activities (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username varchar(255),
  activity_type varchar(20) NOT NULL CHECK (activity_type IN ('login', 'logout', 'route_change')),
  route_path varchar(255),
  ip_address varchar(45),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_cleanup ON user_activities (created_at);
CREATE INDEX idx_activities_user_time ON user_activities (user_id, created_at);

CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dse_updated BEFORE UPDATE ON daily_stock_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Catatan: `products.stock CHECK (stock >= 0)` dan `sold_not_above_in` adalah jaring terakhir untuk bug #2, #3, #5. Kode tetap memvalidasi sendiri supaya pesan errornya jelas.

- [ ] **Step 4: Tulis `backend/db/setup.js`**

```js
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const DROPPABLE = /^[a-z0-9_]+_(test|scenario)$/;

function adminConfig(database) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database
  };
}

async function withClient(database, work) {
  const client = new Client(adminConfig(database));
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing(name) {
  await withClient("postgres", async (client) => {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  });
}

async function recreateDatabase(name) {
  if (!DROPPABLE.test(name)) {
    throw new Error(`Menolak drop database "${name}": hanya *_test atau *_scenario yang boleh.`);
  }
  await withClient("postgres", async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });
}

async function applySchema(name) {
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  await withClient(name, (client) => client.query(sql));
}

module.exports = { adminConfig, createDatabaseIfMissing, recreateDatabase, applySchema };
```

- [ ] **Step 5: Tulis `backend/db/init.js`**

```js
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const { adminConfig, createDatabaseIfMissing, applySchema } = require("./setup");

async function hasSchema(name) {
  const client = new Client(adminConfig(name));
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.users') AS t");
    return rows[0].t !== null;
  } finally {
    await client.end();
  }
}

async function main() {
  const name = process.env.DB_NAME;
  await createDatabaseIfMissing(name);
  if (!(await hasSchema(name))) await applySchema(name);

  const seed = new Client(adminConfig(name));
  await seed.connect();
  try {
    const { rowCount } = await seed.query("SELECT 1 FROM users WHERE role = 'superadmin'");
    if (rowCount === 0) {
      const hash = await bcrypt.hash("superadminpassword", 10);
      await seed.query("INSERT INTO users (username, password, role) VALUES ($1, $2, 'superadmin')", ["superadmin", hash]);
      console.log("Superadmin default dibuat (superadmin / superadminpassword). Segera ganti password.");
    }
  } finally {
    await seed.end();
  }
  console.log(`Database ${name} siap.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Script npm**

Di `backend/package.json` bagian `scripts`:

```json
"db:init": "node db/init.js",
"db:migrate-mysql": "node db/migrate-from-mysql.js",
"test": "node --test --test-concurrency=1",
"scenario": "node scripts/scenario/run.js"
```

`--test-concurrency=1` wajib karena semua test integrasi memakai satu DB `pos_test`.

- [ ] **Step 7: Verifikasi skema terpasang**

```bash
cd /e/pos-soswir/backend
DB_NAME=pos_init_test node -e "require('./db/setup').recreateDatabase('pos_init_test').then(()=>require('./db/setup').applySchema('pos_init_test')).then(()=>console.log('ok'))"
DB_NAME=pos_init_test node -e "require('./db/setup').recreateDatabase('pos_db').catch(e=>console.log(e.message))"
```

Expected: `ok`, lalu `Menolak drop database "pos_db"...`. Hapus `pos_init_test` setelahnya dengan `psql -c 'DROP DATABASE pos_init_test'`.

- [ ] **Step 8: Commit**

```bash
git add backend/db backend/package.json backend/package-lock.json backend/.env.example
git commit -m "feat(db): skema PostgreSQL dan script init database"
```

---

### Task 2: Modul koneksi `db.js` berbasis `pg`

**Files:**
- Modify: `backend/models/db.js` (ganti total)
- Create: `backend/utils/httpError.js`, `backend/test/helpers/testDb.js`, `backend/test/db.test.js`

**Interfaces:**
- Consumes: `setup.recreateDatabase`, `setup.applySchema` (Task 1)
- Produces: `db.pool: pg.Pool`, `db.query(text: string, params?: any[]): Promise<object[]>`, `db.withTransaction(work: (client) => Promise<T>): Promise<T>`, `HttpError(status: number, message: string)`, `testDb.resetTestDb(): Promise<void>`

- [ ] **Step 1: Helper DB test**

`backend/test/helpers/testDb.js`:

```js
const { recreateDatabase, applySchema } = require("../../db/setup");

const TEST_DB = "pos_test";
process.env.DB_NAME = TEST_DB;

async function resetTestDb() {
  await recreateDatabase(TEST_DB);
  await applySchema(TEST_DB);
}

module.exports = { TEST_DB, resetTestDb };
```

File ini harus di-`require` **sebelum** `models/db.js` di setiap test, karena `db.js` membaca `DB_NAME` saat dimuat.

- [ ] **Step 2: Test yang gagal**

`backend/test/db.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { pool, query, withTransaction } = require("../models/db");

test.before(resetTestDb);
test.after(() => pool.end());

test("COUNT(*) keluar sebagai number", async () => {
  const [row] = await query("SELECT COUNT(*) AS n FROM users");
  assert.strictEqual(row.n, 0);
});

test("NUMERIC tetap string seperti mysql2", async () => {
  const [row] = await query("SELECT 12.50::numeric(10,2) AS v");
  assert.strictEqual(row.v, "12.50");
});

test("date keluar sebagai string YYYY-MM-DD", async () => {
  const [row] = await query("SELECT DATE '2026-11-15' AS d");
  assert.strictEqual(row.d, "2026-11-15");
});

test("sesi memakai zona Asia/Jakarta", async () => {
  const [row] = await query("SELECT current_setting('TimeZone') AS tz");
  assert.strictEqual(row.tz, "Asia/Jakarta");
  const [d] = await query("SELECT ('2026-11-14T17:30:00Z'::timestamptz)::date AS d");
  assert.strictEqual(d.d, "2026-11-15");
});

test("withTransaction rollback saat error", async () => {
  await assert.rejects(
    withTransaction(async (client) => {
      await client.query("INSERT INTO store_settings (setting_key, setting_value) VALUES ('x', '1')");
      throw new Error("batal");
    }),
    /batal/
  );
  const rows = await query("SELECT 1 FROM store_settings WHERE setting_key = 'x'");
  assert.strictEqual(rows.length, 0);
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd /e/pos-soswir/backend && node --test test/db.test.js`
Expected: FAIL (db.js masih `mysql2`, tidak punya `query`).

- [ ] **Step 4: Tulis `backend/models/db.js`**

```js
const { Pool, types } = require("pg");
require("dotenv").config();

types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  options: "-c timezone=Asia/Jakarta"
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
```

`backend/utils/httpError.js`:

```js
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { HttpError };
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `node --test test/db.test.js`
Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/models/db.js backend/utils/httpError.js backend/test
git commit -m "feat(db): pool pg dengan zona Asia/Jakarta, query dan withTransaction"
```

---

### Task 3: Migrasi data dari MySQL ke Postgres

**Files:**
- Create: `backend/db/migrate-from-mysql.js`
- Modify: `backend/package.json` (`mysql2` pindah ke `devDependencies`)

**Interfaces:**
- Consumes: `setup.adminConfig` (Task 1)
- Produces: CLI `npm run db:migrate-mysql`

Prasyarat: MySQL XAMPP dinyalakan user, dan Postgres `pos_db` sudah `npm run db:init` dengan skema kosong (selain superadmin default; script menghapus isi tabel target dulu).

- [ ] **Step 1: Backup MySQL dulu**

```bash
"/c/xampp/mysql/bin/mysqldump.exe" -u root -p pos_db > /e/pos-soswir/docs/archive/pos_db-mysql-$(date +%Y%m%d).sql
```

Expected: file > 0 byte. Tanpa backup, task berhenti.

- [ ] **Step 2: Tulis script**

```js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");
const { Client } = require("pg");
const { adminConfig } = require("./setup");

const TABLES = [
  { name: "shifts", cols: ["id", "label", "start_time", "end_time", "is_active", "created_at", "updated_at"], bool: ["is_active"] },
  { name: "users", cols: ["id", "username", "password", "role", "created_at", "last_login", "is_active", "shift_id"], bool: ["is_active"] },
  { name: "categories", cols: ["id", "name", "description", "icon_name", "is_reseller", "created_at", "updated_at"], bool: ["is_reseller"] },
  { name: "suppliers", cols: ["id", "name", "phone", "is_active", "created_at", "updated_at"], bool: ["is_active"] },
  { name: "products", cols: ["id", "name", "description", "image_url", "price", "stock", "category_id", "supplier_id", "tax_percentage", "tax_description", "is_active", "created_at", "updated_at"], bool: ["is_active"] },
  { name: "daily_stock_entries", cols: ["id", "product_id", "supplier_id", "entry_date", "quantity_in", "quantity_sold", "quantity_returned", "total_revenue", "supplier_earning", "store_fee", "tax_percentage", "price_per_unit", "status", "is_paid", "paid_at", "notes", "created_at", "updated_at"], bool: ["is_paid"] },
  { name: "sales", cols: ["id", "user_id", "customer_name", "total_amount", "payment_method", "created_at"], bool: [] },
  { name: "sale_items", cols: ["id", "sale_id", "product_id", "quantity", "price_at_sale", "daily_stock_entry_id"], bool: [] },
  { name: "sale_taxes", cols: ["id", "sale_id", "category_id", "category_name", "gross_amount", "tax_percentage", "tax_amount", "net_amount", "store_profit", "supplier_amount", "quantity", "price_per_item", "product_id", "product_name", "daily_stock_entry_id", "created_at"], bool: [] },
  { name: "transaction_logs", cols: ["id", "sale_id", "user_id", "username", "product_id", "product_name", "quantity", "price", "total", "daily_stock_entry_id", "created_at"], bool: [] },
  { name: "store_settings", cols: ["id", "setting_key", "setting_value", "updated_at"], bool: [] },
  { name: "user_activities", cols: ["id", "user_id", "username", "activity_type", "route_path", "ip_address", "user_agent", "created_at"], bool: [] }
];

async function main() {
  const source = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    timezone: "Z",
    dateStrings: ["DATE"]
  });
  const target = new Client({ ...adminConfig(process.env.DB_NAME), options: "-c timezone=UTC" });
  await target.connect();

  const report = [];
  try {
    await target.query("BEGIN");
    await target.query(`TRUNCATE ${TABLES.map((t) => t.name).reverse().join(", ")} RESTART IDENTITY CASCADE`);

    for (const table of TABLES) {
      const [exists] = await source.query("SHOW TABLES LIKE ?", [table.name]);
      if (exists.length === 0) {
        report.push({ table: table.name, source: 0, target: 0, note: "tidak ada di MySQL" });
        continue;
      }
      const [rows] = await source.query(`SELECT ${table.cols.map((c) => "`" + c + "`").join(", ")} FROM \`${table.name}\``);
      const placeholders = table.cols.map((_, i) => `$${i + 1}`).join(", ");
      const insert = `INSERT INTO ${table.name} (${table.cols.join(", ")}) OVERRIDING SYSTEM VALUE VALUES (${placeholders})`;
      for (const row of rows) {
        const values = table.cols.map((c) => (table.bool.includes(c) ? Boolean(row[c]) : row[c]));
        await target.query(insert, values);
      }
      await target.query(
        `SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table.name}`
      );
      const { rows: [{ n }] } = await target.query(`SELECT COUNT(*)::int AS n FROM ${table.name}`);
      report.push({ table: table.name, source: rows.length, target: n });
    }

    const mismatch = report.filter((r) => r.source !== r.target);
    if (mismatch.length > 0) throw new Error(`Jumlah baris tidak cocok: ${JSON.stringify(mismatch)}`);
    await target.query("COMMIT");
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
  console.table(report);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Catatan: `cloudinary_public_id` sengaja tidak disalin. `image_url` lama (URL Cloudinary `https://...`) tetap jalan karena `imageSrc()` hanya memberi prefix pada path yang diawali `/`.

Jika tabel `shifts` di MySQL punya kolom `day_of_week` sisa plan lama, script tetap aman karena hanya memilih kolom di daftar.

- [ ] **Step 3: Jalankan dan cocokkan**

```bash
npm run db:init
npm run db:migrate-mysql
```

Expected: tabel `console.table` dengan kolom `source` = `target` untuk semua tabel, exit 0.

Verifikasi tambahan, total uang tidak berubah:

```bash
# MySQL
"/c/xampp/mysql/bin/mysql.exe" -u root -p pos_db -e "SELECT COUNT(*), SUM(total_amount) FROM sales"
# Postgres
psql -h localhost -U postgres -d pos_db -c "SELECT COUNT(*), SUM(total_amount) FROM sales"
```

Expected: angka identik.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrate-from-mysql.js backend/package.json backend/package-lock.json
git commit -m "feat(db): script salin data MySQL ke PostgreSQL dengan cek jumlah baris"
```

Backup SQL di `docs/archive/` **tidak** di-commit kalau berisi hash password dan data pelanggan; tambahkan `docs/archive/*.sql` ke `.gitignore` kecuali `pos-mysql.sql` (skema lama).

---

### Task 4: Startup server tanpa DDL

**Files:**
- Modify: `backend/index.js`
- Delete: `backend/models/product.js`, `backend/models/sale.js`, `backend/models/settings.js`, `backend/models/shift.js`, fungsi `createActivityLogTable` di `backend/models/activity.js`

**Interfaces:**
- Consumes: `db.pool`, `db.query` (Task 2)

- [ ] **Step 1: Ganti `initializeDatabase` di `index.js`**

```js
const initializeDatabase = async () => {
  try {
    await query("SELECT 1");
    const [{ t }] = await query("SELECT to_regclass('public.users') AS t");
    if (t === null) {
      console.error("❌ Skema belum dipasang. Jalankan: npm run db:init");
      process.exit(1);
    }
    console.log("✅ Database connection established successfully");
    if (isProduction || isStaging) {
      await activityCleanup.initialize();
    }
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
};
```

Hapus import `createUserTable`, `createProductTable`, `createSalesTables`, `createStoreSettingsTable`, `createActivityLogTable`, `createShiftTables`. Import `{ pool, query }` dari `./models/db`.

- [ ] **Step 2: Health check**

Ganti isi try di `/health`:

```js
const [result] = await query("SELECT 1 AS healthy");
```

dan `database: result.healthy === 1 ? 'connected' : 'disconnected'`. Hapus `cloudinaryConfigured` dari `configuration`.

- [ ] **Step 3: Verifikasi**

Run: `npm start` (dengan `DB_NAME=pos_db` hasil Task 3), lalu `curl -s localhost:3002/health`
Expected: `"status":"healthy","database":"connected"`. Route lain belum diport jadi boleh 500; itu urusan Task 5-11.

- [ ] **Step 4: Commit**

```bash
git add -A backend/index.js backend/models
git commit -m "refactor(db): startup hanya cek koneksi dan skema, DDL pindah ke schema.sql"
```

---

### Task 5: Port auth, middleware shift, users, shifts

**Files:**
- Modify: `backend/utils/shiftAccess.js`, `backend/routes/auth.js`, `backend/routes/users.js`, `backend/routes/shifts.js`
- Create: `backend/test/auth.test.js`

**Interfaces:**
- Consumes: `db.query`, `HttpError`
- Produces: perilaku API identik, plus: `PUT /api/auth/profile` tanpa `username` → 400; `DELETE /api/users/cashiers/:id` untuk kasir yang punya transaksi → 409.

- [ ] **Step 1: Test yang gagal**

`backend/test/auth.test.js` memakai `supertest`? **Tidak**, dilarang tambah dependency. Pakai server sungguhan:

```js
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
```

Tambahkan `backend/test/helpers/server.js`:

```js
const { spawn } = require("child_process");
const path = require("path");
const bcrypt = require("bcryptjs");
const { query } = require("../../models/db");

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

async function call(method, url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function startTestServer() {
  const hash = await bcrypt.hash("rahasia123", 4);
  await query("INSERT INTO users (username, password, role) VALUES ('superadmin', $1, 'superadmin')", [hash]);

  const child = spawn(process.execPath, ["index.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, DB_NAME: "pos_test", PORT: String(PORT), NODE_ENV: "test" },
    stdio: "ignore"
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(BASE + "/")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    post: (u, b, t) => call("POST", u, b, t),
    put: (u, b, t) => call("PUT", u, b, t),
    patch: (u, b, t) => call("PATCH", u, b, t),
    get: (u, t) => call("GET", u, undefined, t),
    del: (u, t, b) => call("DELETE", u, b, t),
    async login(username, password) {
      return (await call("POST", "/api/auth/login", { username, password })).body.token;
    },
    async seedCashierWithSale() {
      const [u] = await query("INSERT INTO users (username, password, role) VALUES ('kasir_hapus', 'x', 'cashier') RETURNING id");
      await query("INSERT INTO sales (user_id, total_amount) VALUES ($1, 1000)", [u.id]);
      return u.id;
    },
    stop() {
      child.kill();
    }
  };
}

module.exports = { startTestServer, BASE };
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/auth.test.js`
Expected: FAIL (route masih `connection.query` ala MySQL).

- [ ] **Step 3: Port `shiftAccess.js`**

```js
async function isOnShift(userId, role, at = new Date()) {
  if (role === "superadmin") {
    return { allowed: true, shift: null };
  }

  const rows = await query(
    `SELECT s.id, s.label, s.start_time, s.end_time
     FROM users u
     JOIN shifts s ON s.id = u.shift_id AND s.is_active = true
     WHERE u.id = $1`,
    [userId]
  );

  const shift = rows[0] || null;
  if (!shift) {
    return { allowed: false, shift: null };
  }

  return {
    allowed: isWithinWindow(minutesNowInJakarta(at), shift.start_time, shift.end_time),
    shift
  };
}
```

Import berubah jadi `const { query } = require("../models/db");`. `start_time` dari `pg` berupa string `"08:00:00"`, sama dengan `mysql2`, jadi `shiftWindow.js` tidak berubah.

- [ ] **Step 4: Port `auth.js`**

Ikuti aturan terjemahan. Bagian yang bukan mekanis:

```js
router.put("/profile", authenticateToken, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (typeof username !== "string" || username.trim() === "") {
    return res.status(400).json({ message: "Username wajib diisi" });
  }

  try {
    const [user] = await query("SELECT * FROM users WHERE id = $1", [userId]);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (username !== user.username) {
      const taken = await query("SELECT id FROM users WHERE username = $1 AND id <> $2", [username, userId]);
      if (taken.length > 0) return res.status(400).json({ message: "Username sudah digunakan" });
    }

    let passwordHash = user.password;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: "Password lama harus diisi" });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "Password lama tidak benar" });
      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await query("UPDATE users SET username = $1, password = $2 WHERE id = $3", [username, passwordHash, userId]);
    res.json({ message: "Profil berhasil diperbarui", user: { id: userId, username, role: user.role } });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
});
```

Login: `UPDATE users SET last_login = now(), is_active = true WHERE id = $1`, insert `user_activities` dengan `now()`.

- [ ] **Step 5: Port `users.js`**

`GET /cashiers`:

```sql
SELECT u.id, u.username, u.role, u.created_at, u.last_login, u.is_active, u.shift_id,
       COUNT(ua.id) AS total_activities, MAX(ua.created_at) AS last_activity
FROM users u
LEFT JOIN user_activities ua ON u.id = ua.user_id
WHERE u.role = 'cashier'
GROUP BY u.id
ORDER BY u.username ASC
```

`DELETE /cashiers/:id`:

```js
} catch (error) {
  if (error.code === "23503") {
    return res.status(409).json({ message: "Kasir masih punya riwayat transaksi, tidak bisa dihapus" });
  }
  console.error("Error deleting cashier:", error);
  res.status(500).json({ message: "Server error deleting cashier" });
}
```

`ER_DUP_ENTRY` di POST/PUT jadi `error.code === "23505"`.

- [ ] **Step 6: Port `shifts.js`**

`validatePayload(body, excludeShiftId)` tidak lagi menerima `connection`:

```js
const bentrok = await query(
  "SELECT id FROM shifts WHERE id <> $1 AND start_time < $2 AND end_time > $3",
  [excludeShiftId || 0, end_time, start_time]
);
```

Tambahkan di awal `validatePayload`:

```js
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
if (!TIME.test(String(start_time)) || !TIME.test(String(end_time))) {
  return "Format jam harus HH:MM.";
}
if (typeof label !== "string" || label.trim() === "") {
  return "Nama sesi tidak boleh kosong.";
}
```

`INSERT ... RETURNING id`, `rowCount` untuk 404.

- [ ] **Step 7: Jalankan test**

Run: `node --test test/auth.test.js && node --test utils/shiftWindow.test.js`
Expected: semua PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/utils/shiftAccess.js backend/routes/auth.js backend/routes/users.js backend/routes/shifts.js backend/test
git commit -m "feat(pg): port auth, users, shifts; validasi profil dan hapus kasir"
```

---

### Task 6: Port categories, suppliers, settings

**Files:**
- Modify: `backend/routes/categories.js`, `backend/routes/suppliers.js`, `backend/routes/settings.js`
- Create: `backend/test/suppliers.test.js`

**Interfaces:**
- Consumes: `db.query`, `helpers/server.js`
- Produces: `GET /api/suppliers` dengan `total_revenue` dan `total_earnings` yang tidak terkali jumlah produk (bug #8).

- [ ] **Step 1: Test yang gagal (fan-out)**

```js
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/suppliers.test.js`
Expected: FAIL.

- [ ] **Step 3: Query supplier tanpa fan-out**

```sql
SELECT s.*,
       COALESCE(p.product_count, 0) AS product_count,
       COALESCE(d.entries, 0) AS daily_entries_count,
       COALESCE(d.revenue, 0) AS total_revenue,
       COALESCE(d.earnings, 0) AS total_earnings
FROM suppliers s
LEFT JOIN (
  SELECT supplier_id, COUNT(*) AS product_count FROM products GROUP BY supplier_id
) p ON p.supplier_id = s.id
LEFT JOIN (
  SELECT supplier_id, COUNT(*) AS entries, SUM(total_revenue) AS revenue, SUM(supplier_earning) AS earnings
  FROM daily_stock_entries
  WHERE entry_date >= current_date - 30
  GROUP BY supplier_id
) d ON d.supplier_id = s.id
WHERE s.is_active = true
ORDER BY s.created_at DESC
```

`product_count` dari `COUNT(*)` adalah bigint, jadi keluar number lewat parser. Bungkus `COALESCE` tetap number.

- [ ] **Step 4: Port sisanya**

- `categories.js`: `COALESCE(c.is_reseller, false)`, `LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true`, `GROUP BY c.id`, insert `RETURNING id`, `Boolean(is_reseller)` saat simpan.
- `suppliers.js`: `is_active = false` saat nonaktifkan, `23505` untuk nama ganda, `rowCount`.
- `settings.js` PUT:

```js
await withTransaction(async (client) => {
  for (const [key, value] of Object.entries(settings)) {
    await client.query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ($1, $2)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [key, value]
    );
  }
});
```

- [ ] **Step 5: Jalankan test**

Run: `node --test test/suppliers.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/categories.js backend/routes/suppliers.js backend/routes/settings.js backend/test/suppliers.test.js
git commit -m "feat(pg): port kategori, supplier, settings; fix total supplier terkali jumlah produk"
```

---

### Task 7: Produk dan penyimpanan gambar lokal

**Files:**
- Create: `backend/utils/imageStorage.js`, `backend/uploads/products/.gitkeep`, `backend/test/products.test.js`
- Modify: `backend/routes/products.js`, `backend/index.js`, `.gitignore`, `frontend/src/lib/utils/product.ts`, `frontend/src/routes/superadmin/products/+page.svelte`, `frontend/src/lib/components/pos/ProductCatalog.svelte`, `frontend/src/lib/components/products/CashierProductTable.svelte`, `frontend/src/lib/components/products/ProductManagementTable.svelte`
- Delete: `backend/config/cloudinary.js`; `npm uninstall cloudinary bcrypt` (bcrypt hanya dipakai `products.js`, ganti ke `bcryptjs` yang dipakai file lain)

**Interfaces:**
- Produces:
  - `POST /api/products/upload-image` → `{ imageUrl: "/uploads/products/<file>", imageFilename: "<file>" }`
  - `POST/PUT /api/products` menerima `image_url`, `image_filename`
  - `GET /uploads/products/<file>` melayani file
  - `imageStorage.upload` (multer), `imageStorage.deleteProductImage(filename: string|null): Promise<void>`
  - frontend `imageSrc(url: string | null): string`

- [ ] **Step 1: Test yang gagal**

```js
const fs = require("fs");
const path = require("path");

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
```

Fixture `merah.png` dibuat di Task 13. Task 13 tidak bergantung pada task lain, jadi **kerjakan Task 13 sebelum Task 7**.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/products.test.js`
Expected: FAIL.

- [ ] **Step 3: `backend/utils/imageStorage.js`**

```js
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${EXTENSIONS[file.mimetype]}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) return cb(null, true);
    const error = new Error("Format gambar harus JPG, PNG, atau WEBP");
    error.status = 400;
    cb(error);
  }
});

async function deleteProductImage(filename) {
  if (!filename) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(filename)));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Gagal hapus gambar produk:", error);
  }
}

module.exports = { UPLOAD_DIR, upload, deleteProductImage };
```

- [ ] **Step 4: Route upload**

```js
router.post("/upload-image", authenticateToken, authorizeRole(["superadmin"]), (req, res) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      const status = error.status || (error.code === "LIMIT_FILE_SIZE" ? 413 : 500);
      return res.status(status).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Ukuran gambar maksimal 5MB" : error.message });
    }
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    res.json({ imageUrl: `/uploads/products/${req.file.filename}`, imageFilename: req.file.filename });
  });
});
```

- [ ] **Step 5: Validasi produk**

Fungsi lokal di `products.js`:

```js
function validateProduct(body, { requireStock }) {
  const price = Number(body.price);
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") return "Nama produk wajib diisi";
  if (!Number.isFinite(price) || price <= 0) return "Harga harus angka lebih dari 0";
  if (!body.category_id) return "Kategori wajib dipilih";
  if (requireStock) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) return "Stok harus bilangan bulat 0 atau lebih";
  }
  return null;
}
```

POST memanggil `validateProduct(req.body, { requireStock: true })`, PUT `{ requireStock: false }`. Kategori tidak ditemukan di PUT → 404 (sekarang lolos dan jadi 500 FK). PUT memakai `RETURNING id`; kosong → 404. PUT yang mengganti gambar: ambil `image_filename` lama dulu, setelah UPDATE sukses panggil `deleteProductImage(lama)` jika berbeda dari yang baru.

- [ ] **Step 6: Hard delete dan delete**

Hard delete jadi:

```js
const product = await withTransaction(async (client) => {
  const { rows: [row] } = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [id]);
  if (!row) throw new HttpError(404, "Produk tidak ditemukan");
  await client.query("DELETE FROM products WHERE id = $1", [id]);
  return row;
});
await deleteProductImage(product.image_filename);
```

Empat `UPDATE ... SET product_id = NULL` dihapus: FK di skema sudah `ON DELETE SET NULL` untuk `sale_items`, `sale_taxes`, `transaction_logs`, `daily_stock_entries`. Verifikasi password tetap memakai `bcryptjs.compare`.

`DELETE /:id` (soft-check referensi) cukup satu query:

```sql
SELECT
  (SELECT COUNT(*) FROM sale_items WHERE product_id = $1) AS sales,
  (SELECT COUNT(*) FROM daily_stock_entries WHERE product_id = $1) AS daily_stock,
  (SELECT COUNT(*) FROM transaction_logs WHERE product_id = $1) AS transactions
```

- [ ] **Step 7: Static dan helmet di `index.js`**

```js
app.use(helmet({
  contentSecurityPolicy: /* tetap */,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads"), { fallthrough: false, maxAge: "7d" }));
```

Letakkan `app.use("/uploads", ...)` sebelum middleware yang memasang `Cache-Control: no-cache` dan sebelum handler 404. Tambah `const path = require("path");`. Hapus `optionalEnvVars` Cloudinary dan log `Cloudinary Cloud`.

- [ ] **Step 8: `.gitignore`**

```gitignore
backend/uploads/products/*
!backend/uploads/products/.gitkeep
backend/reports/
docs/archive/*.sql
!docs/archive/pos-mysql.sql
```

- [ ] **Step 9: Frontend**

`frontend/src/lib/utils/product.ts`, tambahkan:

```ts
import { BACKEND_URL } from '$lib/apiConfig';

export function imageSrc(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/') ? `${BACKEND_URL}${url}` : url;
}
```

`createProductPayload(product, isReseller, isEditing, imageUrl, imageFilename)` mengirim `image_filename: imageFilename` menggantikan `public_id`.

Di tiga komponen tabel/katalog: `src={imageSrc(product.image_url)}` dan import `imageSrc` dari `$lib/utils/product`.

`superadmin/products/+page.svelte`: ganti nama variabel `cloudinaryPublicId` jadi `imageFilename`, isi dari `data.imageFilename` dan `product.image_filename`; preview gambar memakai `imageSrc(product.image_url)`; pesan 413 jadi "Ukuran gambar terlalu besar. Maksimal 5MB".

- [ ] **Step 10: Verifikasi**

```bash
cd /e/pos-soswir/backend && node --test test/products.test.js
cd ../frontend && npm run check
```

Expected: test PASS; `svelte-check` tidak menambah error baru dibanding sebelum task (catat jumlah error sebelum mulai).

- [ ] **Step 11: Commit**

```bash
git add -A backend/utils/imageStorage.js backend/uploads/products/.gitkeep backend/routes/products.js backend/index.js backend/config backend/package.json backend/package-lock.json backend/test/products.test.js .gitignore frontend/src
git commit -m "feat(produk): gambar produk disimpan di folder lokal, port produk ke pg, validasi harga dan stok"
```

---

### Task 8: Checkout aman (bug #1, #2, #3, #6, #7, #12, produk nonaktif)

**Files:**
- Create: `backend/services/checkout.js`, `backend/services/dailyStock.js` (fungsi `refreshPubjStock` saja dulu), `backend/test/checkout.test.js`
- Modify: `backend/routes/sales.js` (handler `POST /` saja; GET diport di Task 10)

**Interfaces:**
- Consumes: `db.withTransaction`, `HttpError`
- Produces:
  - `validateItems(items: unknown): string | null`
  - `mergeItems(items: {product_id:number, quantity:number}[]): {product_id:number, quantity:number}[]` (terurut `product_id` naik)
  - `createSale(client, { items, customerName: string, paymentMethod: string, user: { id:number, username:string } }): Promise<{ id:number, total:number }>`
  - `dailyStock.refreshPubjStock(client, productId: number): Promise<void>`

- [ ] **Step 1: Test yang gagal**

`backend/test/checkout.test.js`:

```js
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

test("dua checkout bersamaan untuk stok 1: satu berhasil, satu ditolak", async () => {
  const id = await product("Terakhir", 5000, 1);
  const results = await Promise.allSettled([sell([{ product_id: id, quantity: 1 }]), sell([{ product_id: id, quantity: 1 }])]);
  assert.strictEqual(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.strictEqual(results.filter((r) => r.status === "rejected").length, 1);
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/checkout.test.js`
Expected: FAIL `Cannot find module '../services/checkout'`.

- [ ] **Step 3: `backend/services/dailyStock.js` (bagian awal)**

```js
async function refreshPubjStock(client, productId) {
  await client.query(
    `UPDATE products
     SET stock = COALESCE((
       SELECT SUM(quantity_in - quantity_sold)
       FROM daily_stock_entries
       WHERE product_id = $1 AND status = 'active' AND entry_date = current_date
     ), 0)
     WHERE id = $1`,
    [productId]
  );
}

module.exports = { refreshPubjStock };
```

Stok katalog PUBJ sekarang hanya dari entry hari ini, sama dengan sumber yang dipakai checkout (bug #6).

- [ ] **Step 4: `backend/services/checkout.js`**

```js
const { HttpError } = require("../utils/httpError");
const { refreshPubjStock } = require("./dailyStock");

const round2 = (value) => Math.round(value * 100) / 100;

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "Keranjang kosong";
  for (const item of items) {
    if (!item || !Number.isInteger(item.product_id) || item.product_id <= 0) return "Produk tidak valid";
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return "Jumlah barang harus bilangan bulat lebih dari 0";
  }
  return null;
}

function mergeItems(items) {
  const totals = new Map();
  for (const item of items) {
    totals.set(item.product_id, (totals.get(item.product_id) || 0) + item.quantity);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([product_id, quantity]) => ({ product_id, quantity }));
}

async function lockProduct(client, productId) {
  const { rows } = await client.query(
    `SELECT p.id, p.name, p.price, p.stock, p.is_active, p.category_id,
            c.name AS category_name, COALESCE(c.is_reseller, false) AS is_reseller
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1
     FOR UPDATE OF p`,
    [productId]
  );
  if (rows.length === 0) throw new HttpError(404, `Produk ${productId} tidak ditemukan`);
  return rows[0];
}

async function takeShopStock(client, product, quantity) {
  if (product.stock < quantity) {
    throw new HttpError(400, `Stok ${product.name} tidak mencukupi. Tersedia: ${product.stock}`);
  }
  await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [quantity, product.id]);
  return { entryId: null, fee: null };
}

async function takePubjStock(client, product, quantity, gross) {
  const { rows } = await client.query(
    `SELECT id, quantity_in, quantity_sold, tax_percentage
     FROM daily_stock_entries
     WHERE product_id = $1 AND entry_date = current_date AND status = 'active'
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE`,
    [product.id]
  );
  const entry = rows[0];
  if (!entry) throw new HttpError(400, `Produk PUBJ ${product.name} belum ada stok hari ini`);

  const available = entry.quantity_in - entry.quantity_sold;
  if (available < quantity) {
    throw new HttpError(400, `Stok ${product.name} tidak mencukupi. Tersedia: ${available}`);
  }

  const percentage = Number(entry.tax_percentage);
  const storeFee = round2(gross * (percentage / 100));
  const supplierEarning = round2(gross - storeFee);

  await client.query(
    `UPDATE daily_stock_entries
     SET quantity_sold = quantity_sold + $1,
         quantity_returned = quantity_in - (quantity_sold + $1),
         total_revenue = total_revenue + $2,
         store_fee = store_fee + $3,
         supplier_earning = supplier_earning + $4,
         status = CASE WHEN quantity_sold + $1 = quantity_in THEN 'completed' ELSE 'active' END
     WHERE id = $5`,
    [quantity, gross, storeFee, supplierEarning, entry.id]
  );
  await refreshPubjStock(client, product.id);

  return { entryId: entry.id, fee: { percentage, storeFee, supplierEarning } };
}

async function createSale(client, { items, customerName, paymentMethod, user }) {
  const lines = [];
  for (const item of mergeItems(items)) {
    const product = await lockProduct(client, item.product_id);
    if (!product.is_active) throw new HttpError(400, `Produk ${product.name} sedang nonaktif`);

    const price = Number(product.price);
    const gross = round2(price * item.quantity);
    const taken = product.is_reseller
      ? await takePubjStock(client, product, item.quantity, gross)
      : await takeShopStock(client, product, item.quantity);

    lines.push({ product, quantity: item.quantity, price, gross, ...taken });
  }

  const total = round2(lines.reduce((sum, line) => sum + line.gross, 0));
  const { rows: [sale] } = await client.query(
    "INSERT INTO sales (user_id, customer_name, total_amount, payment_method) VALUES ($1, $2, $3, $4) RETURNING id",
    [user.id, customerName, total, paymentMethod]
  );

  for (const line of lines) {
    await client.query(
      "INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, daily_stock_entry_id) VALUES ($1, $2, $3, $4, $5)",
      [sale.id, line.product.id, line.quantity, line.price, line.entryId]
    );

    if (line.fee) {
      await client.query(
        `INSERT INTO sale_taxes (
           sale_id, category_id, category_name, gross_amount, tax_percentage, tax_amount, net_amount,
           store_profit, supplier_amount, quantity, price_per_item, product_id, product_name, daily_stock_entry_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7, $8, $9, $10, $11, $12)`,
        [
          sale.id, line.product.category_id, line.product.category_name, line.gross, line.fee.percentage,
          line.fee.storeFee, line.fee.supplierEarning, line.quantity, line.price, line.product.id,
          line.product.name, line.entryId
        ]
      );
    }

    await client.query(
      `INSERT INTO transaction_logs (sale_id, user_id, username, product_id, product_name, quantity, price, total, daily_stock_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sale.id, user.id, user.username, line.product.id, line.product.name, line.quantity, line.price, line.gross, line.entryId]
    );
  }

  return { id: sale.id, total };
}

module.exports = { validateItems, mergeItems, createSale };
```

Catatan desain:
- Lock diambil berurutan `product_id` naik (dari `mergeItems`), jadi dua checkout dengan produk sama tidak deadlock.
- Checkout PUBJ menambah `total_revenue` secara akumulatif dengan harga saat jual. Penutupan entry (Task 9) tidak lagi menghitung ulang revenue dari harga produk terbaru (bug #12).
- `sale_taxes.tax_percentage` dan `daily_stock_entries.tax_percentage` sekarang dari sumber yang sama (bug #7).
- PUBJ dengan `tax_percentage` 0 tetap menulis `sale_taxes` (sebelumnya dilewati), supaya laporan supplier lengkap.

- [ ] **Step 5: Handler route**

```js
router.post("/", authenticateToken, async (req, res) => {
  const { items, customer_name = "Umum", payment_method = "Cash" } = req.body;
  const problem = validateItems(items);
  if (problem) return res.status(400).json({ message: problem });

  try {
    const sale = await withTransaction((client) =>
      createSale(client, {
        items,
        customerName: String(customer_name).trim() || "Umum",
        paymentMethod: String(payment_method),
        user: { id: req.user.id, username: req.user.username }
      })
    );
    res.status(201).json({ message: "Sale completed successfully", sale_id: sale.id, total_amount: sale.total });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Error creating sale:", error);
    res.status(500).json({ message: "Server error creating sale" });
  }
});
```

Respons tidak lagi menyertakan `error.message` mentah pada 500.

- [ ] **Step 6: Jalankan test**

Run: `node --test test/checkout.test.js`
Expected: 8 PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/services backend/routes/sales.js backend/test/checkout.test.js
git commit -m "fix(sales): harga dari DB, validasi qty, lock stok, fee PUBJ dari entry harian"
```

---

### Task 9: Stok harian dan scheduler (bug #4, #5, #6, #12, #13)

**Files:**
- Modify: `backend/services/dailyStock.js`, `backend/routes/dailyStock.js`, `backend/utils/dailyStockScheduler.js`
- Create: `backend/test/dailyStock.test.js`

**Interfaces:**
- Consumes: `refreshPubjStock` (Task 8), `withTransaction`
- Produces: `completeEntries(client, upToDate: string | null): Promise<{ completed: number, products: number }>` (`null` berarti `current_date`)

- [ ] **Step 1: Test yang gagal**

```js
const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { pool, query, withTransaction } = require("../models/db");
const { completeEntries } = require("../services/dailyStock");

let product;
let supplier;
test.before(async () => {
  await resetTestDb();
  const [c] = await query("INSERT INTO categories (name, is_reseller) VALUES ('PUBJ', true) RETURNING id");
  [supplier] = await query("INSERT INTO suppliers (name) VALUES ('Pak Budi') RETURNING id");
  [product] = await query(
    "INSERT INTO products (name, price, category_id, supplier_id, tax_percentage) VALUES ('Kue', 2000, $1, $2, 10) RETURNING id",
    [c.id, supplier.id]
  );
});
test.after(() => pool.end());

test("completeEntries menutup entry hari ini dan yang tertinggal, revenue tidak dihitung ulang", async () => {
  await query(
    `INSERT INTO daily_stock_entries (product_id, supplier_id, entry_date, quantity_in, quantity_sold, total_revenue, store_fee, supplier_earning, tax_percentage, price_per_unit)
     VALUES ($1, $2, current_date - 2, 10, 3, 6000, 600, 5400, 10, 2000),
            ($1, $2, current_date, 10, 4, 8000, 800, 7200, 10, 2000)`,
    [product.id, supplier.id]
  );
  await query("UPDATE products SET price = 9999 WHERE id = $1", [product.id]);

  const result = await withTransaction((client) => completeEntries(client, null));
  assert.strictEqual(result.completed, 2);

  const rows = await query("SELECT status, quantity_returned, total_revenue FROM daily_stock_entries ORDER BY entry_date");
  assert.deepStrictEqual(rows, [
    { status: "completed", quantity_returned: 7, total_revenue: "6000.00" },
    { status: "completed", quantity_returned: 6, total_revenue: "8000.00" }
  ]);
  const [p] = await query("SELECT stock FROM products WHERE id = $1", [product.id]);
  assert.strictEqual(p.stock, 0);
});
```

Tambahkan test HTTP (pakai `helpers/server.js`):
- `POST /api/daily-stock/end-of-day` dengan entry aktif → 200 dan `completed_count` > 0 (bug #4).
- `PUT /api/daily-stock/:id` dengan `quantity_in` lebih kecil dari `quantity_sold` → 400 (bug #5).
- `PUT` dengan `quantity_in: "abc"` → 400.
- `POST /api/daily-stock` mengisi `price_per_unit` = harga produk.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/dailyStock.test.js`
Expected: FAIL.

- [ ] **Step 3: `completeEntries`**

Tambahkan ke `backend/services/dailyStock.js`:

```js
async function completeEntries(client, upToDate) {
  const { rows } = await client.query(
    `UPDATE daily_stock_entries
     SET status = 'completed', quantity_returned = quantity_in - quantity_sold
     WHERE status = 'active' AND entry_date <= COALESCE($1::date, current_date)
     RETURNING product_id`,
    [upToDate]
  );
  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
  for (const productId of productIds) {
    await refreshPubjStock(client, productId);
  }
  return { completed: rows.length, products: productIds.length };
}

module.exports = { refreshPubjStock, completeEntries };
```

- [ ] **Step 4: Route stok harian**

- `POST /`: validasi `Number.isInteger(Number(quantity_in)) && Number(quantity_in) > 0`; `entry_date` default `current_date` jika kosong; simpan `price_per_unit = product.price`, `tax_percentage = product.tax_percentage`; dalam `withTransaction` lalu `refreshPubjStock`. `23505` → 400 "Sudah ada entry...".
- `PUT /:id`:

```js
const quantityIn = Number(req.body.quantity_in);
if (!Number.isInteger(quantityIn) || quantityIn <= 0) {
  return res.status(400).json({ message: "Jumlah stok harus bilangan bulat lebih dari 0" });
}
await withTransaction(async (client) => {
  const { rows: [entry] } = await client.query(
    "SELECT id, product_id, quantity_sold FROM daily_stock_entries WHERE id = $1 AND status = 'active' FOR UPDATE",
    [req.params.id]
  );
  if (!entry) throw new HttpError(404, "Entry tidak ditemukan atau sudah selesai");
  if (quantityIn < entry.quantity_sold) {
    throw new HttpError(400, `Stok masuk tidak boleh kurang dari yang sudah terjual (${entry.quantity_sold})`);
  }
  await client.query(
    "UPDATE daily_stock_entries SET quantity_in = $1, quantity_returned = $1 - quantity_sold, notes = $2 WHERE id = $3",
    [quantityIn, req.body.notes || null, entry.id]
  );
  await refreshPubjStock(client, entry.product_id);
});
```

  Revenue/fee tidak lagi dihitung ulang di PUT (sudah akumulatif dari checkout).
- `PATCH /:id/complete`: dalam transaksi, `UPDATE ... SET status='completed', quantity_returned = quantity_in - quantity_sold WHERE id = $1 AND status='active' RETURNING *`, lalu `refreshPubjStock`. Respons tetap memuat `quantity_returned`, `total_revenue`, `supplier_earning`, `store_fee`, `updated_product_stock` (ambil dari row yang di-RETURNING dan `SELECT stock`).
- `POST /end-of-day`: `withTransaction((c) => completeEntries(c, null))`, respons `completed_count`, `updated_products`, `date` dari `SELECT to_char(current_date, 'YYYY-MM-DD')`.
- `POST /auto-complete`: sama, `upToDate = req.body.date || null`; validasi format `YYYY-MM-DD` jika diisi.
- `GET /`, `GET /summary/:date`: port mekanis; `is_paid = true`.
- `PATCH /:id/paid`: `is_paid = true, paid_at = now()`.

- [ ] **Step 5: Scheduler**

`performAutoCompletion()` jadi:

```js
async performAutoCompletion() {
  try {
    const result = await withTransaction((client) => completeEntries(client, null));
    console.log(`Auto-completion: ${result.completed} entry, ${result.products} produk`);
    return { success: true, completed_count: result.completed, updated_products: result.products, message: "Auto-completion successful" };
  } catch (error) {
    console.error("❌ Error in daily stock auto-completion:", error);
    return { success: false, error: error.message, message: "Failed to complete daily stock entries" };
  }
}
```

Tidak ada lagi `toISOString()` (bug #13).

- [ ] **Step 6: Jalankan test**

Run: `node --test test/dailyStock.test.js test/checkout.test.js`
Expected: semua PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/services/dailyStock.js backend/routes/dailyStock.js backend/utils/dailyStockScheduler.js backend/test/dailyStock.test.js
git commit -m "fix(stok-harian): tutup hari tanpa NaN, validasi edit stok, tanggal WIB, revenue tidak dihitung ulang"
```

---

### Task 10: Laporan: sales GET, dashboard, transactions (bug #9, #10, #11)

**Prasyarat:** user sudah menjawab K1.

**Files:**
- Modify: `backend/routes/sales.js` (semua GET), `backend/routes/dashboard.js`, `backend/routes/transactions.js`
- Create: `backend/test/reports.test.js`

**Interfaces:**
- Consumes: `db.query`, fixture checkout via `createSale` (Task 8)
- Produces: semua angka laporan konsisten dengan K1; bentuk JSON respons tidak berubah.

Aturan laba (K1 default): laba toko per baris = `CASE WHEN is_reseller THEN st.store_profit ELSE si.quantity * si.price_at_sale END`. Ganti semua `ROUND(... * 0.2, 2)` di `sales.js /revenue/detail` dan `transactions.js` (3 tempat) dengan rumus ini.

Aturan anti fan-out: `sale_taxes` selalu diagregasi per `sale_id` (atau per `sale_id, product_id` untuk join tingkat item) di subquery sebelum di-join:

```sql
LEFT JOIN (
  SELECT sale_id, product_id,
         SUM(store_profit) AS store_profit,
         SUM(supplier_amount) AS supplier_amount,
         SUM(tax_amount) AS tax_amount
  FROM sale_taxes
  GROUP BY sale_id, product_id
) st ON st.sale_id = si.sale_id AND st.product_id IS NOT DISTINCT FROM si.product_id
```

`IS NOT DISTINCT FROM` menggantikan `COALESCE(x,0) = COALESCE(y,0)`.

- [ ] **Step 1: Test yang gagal**

```js
test("GET /api/sales: pajak tidak terkali jumlah item", async () => {
  // fixture: 1 sale berisi 3 item toko + 1 item PUBJ dengan fee 1200
  const res = await server.get("/api/sales", token);
  const sale = res.body.find((s) => s.id === saleId);
  assert.strictEqual(Number(sale.total_tax_amount), 1200);
});

test("dashboard: categoryStats hanya menghitung 30 hari terakhir", async () => {
  // fixture: sale 40 hari lalu (UPDATE sales SET created_at = now() - interval '40 days')
  const res = await server.get("/api/dashboard", token);
  const cat = res.body.categoryStats.find((c) => c.name === "Makanan");
  assert.strictEqual(Number(cat.total_revenue), totalTokoDalam30Hari);
});

test("laba toko non-PUBJ sama di dashboard dan laporan transaksi", async () => {
  const dash = await server.get("/api/dashboard", token);
  const trx = await server.get("/api/transactions", token);
  const sumTrx = trx.body.reduce((sum, r) => sum + Number(r.keuntungan_toko), 0);
  assert.strictEqual(dash.body.totalStats.storeProfit, sumTrx);
});

test("transaksi jam 00:30 WIB masuk hari ini, bukan kemarin", async () => {
  // fixture: sale dengan created_at = (current_date + time '00:30') AT TIME ZONE 'Asia/Jakarta'
  const res = await server.get("/api/dashboard", token);
  assert.ok(res.body.todayStats.transactions >= 1);
});
```

Fixture dibangun dengan `createSale` lewat `withTransaction`, lalu `UPDATE sales SET created_at = ...` untuk menggeser waktu. Nilai `saleId`, `totalTokoDalam30Hari` dihitung dari fixture di `test.before`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/reports.test.js`
Expected: FAIL.

- [ ] **Step 3: Port `sales.js` GET**

- `GET /`:

```sql
SELECT s.*, u.username AS cashier_name,
       (SELECT string_agg(DISTINCT c.name, ',')
        FROM sale_items si JOIN products p ON p.id = si.product_id JOIN categories c ON c.id = p.category_id
        WHERE si.sale_id = s.id) AS categories,
       COALESCE(st.tax_amount, 0) AS total_tax_amount,
       COALESCE(st.store_profit, 0) AS total_store_profit
FROM sales s
LEFT JOIN users u ON u.id = s.user_id
LEFT JOIN (
  SELECT sale_id, SUM(tax_amount) AS tax_amount, SUM(store_profit) AS store_profit
  FROM sale_taxes GROUP BY sale_id
) st ON st.sale_id = s.id
ORDER BY s.created_at DESC
```

- `GET /chart`: `EXTRACT(MONTH FROM created_at)::int AS month`, `EXTRACT(WEEK ...)`, `created_at::date AS date`; filter `date_trunc('year', created_at) = date_trunc('year', now())` dst. Label harian: `date` sudah string `YYYY-MM-DD`, ubah jadi `D/M` dengan `const [, m, d] = row.date.split('-'); \`${Number(d)}/${Number(m)}\``.
- `GET /tax-report`: `WHERE s.created_at::date BETWEEN $1 AND $2`.
- `GET /revenue`: `to_char(s.created_at, 'YYYY-MM-DD')`, `EXTRACT(...)`, `now() - interval '30 days'` dst. `taxTotalsJoin` sudah benar (agregat per sale), tinggal port.
- `GET /revenue/detail`: `to_char(s.created_at, 'YYYY-MM-DD') = $1`, `EXTRACT(YEAR ...) = $1 AND EXTRACT(WEEK ...) = $2` dst; hapus query `debugSales` dan semua `console.log` debug di handler ini.
- `GET /:id`: port mekanis.

- [ ] **Step 4: Port `dashboard.js`**

- `todayStats`: `WHERE created_at::date = current_date`.
- `todayStoreProfit` / `totalStoreProfit`: pakai subquery `st` per `(sale_id, product_id)` di atas, `JOIN products` jadi `LEFT JOIN` agar produk terhapus tetap terhitung, `c.is_reseller = false/true`.
- `categoryStats` (bug #10): filter tanggal pindah ke dalam subquery item:

```sql
SELECT c.id, c.name, c.is_reseller,
       COUNT(DISTINCT p.id) AS product_count,
       COALESCE(SUM(x.revenue), 0) AS total_revenue,
       COALESCE(SUM(x.tax_amount), 0) AS total_tax_amount,
       COALESCE(SUM(x.supplier_amount), 0) AS total_supplier_amount
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
LEFT JOIN (
  SELECT si.product_id,
         si.quantity * si.price_at_sale AS revenue,
         COALESCE(st.tax_amount, 0) AS tax_amount,
         COALESCE(st.supplier_amount, 0) AS supplier_amount
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id AND s.created_at >= now() - interval '30 days'
  LEFT JOIN (
    SELECT sale_id, product_id, SUM(tax_amount) AS tax_amount, SUM(supplier_amount) AS supplier_amount
    FROM sale_taxes GROUP BY sale_id, product_id
  ) st ON st.sale_id = si.sale_id AND st.product_id IS NOT DISTINCT FROM si.product_id
) x ON x.product_id = p.id
GROUP BY c.id
ORDER BY total_revenue DESC
```

- `recentActivities`: tambah `LIMIT 50`.
- `/revenue` (dashboard): `WEEK(...)` dan `MONTHNAME` diganti `EXTRACT`; label bulan dibuat di JS dengan array nama bulan Indonesia yang sama seperti `sales.js /chart`. Join `sale_taxes` pakai subquery per `sale_id`.
- `/revenue/detail`: rumus laba K1, join anti fan-out.
- `/cashier`: port mekanis, `is_reseller = true`, `current_date - 30`.

- [ ] **Step 5: Port `transactions.js`**

- Hapus blok "buat tabel `transaction_logs` jika belum ada" (baris 11-71 sekarang); tabel sudah ada di `schema.sql`.
- `DATE_FORMAT(tl.created_at, '%Y-%m')` jadi `to_char(tl.created_at, 'YYYY-MM')`.
- `keuntungan_toko` pakai rumus K1, join `sale_taxes` anti fan-out per `(sale_id, product_id)`.
- `/bydate`: `WHERE tl.created_at::date BETWEEN $1 AND $2` (sebelumnya `BETWEEN` timestamp memotong hari terakhir pada jam 00:00).

- [ ] **Step 6: Jalankan test**

Run: `node --test test/reports.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/sales.js backend/routes/dashboard.js backend/routes/transactions.js backend/test/reports.test.js
git commit -m "fix(laporan): port ke pg, hilangkan fan-out join, satu rumus laba toko"
```

---

### Task 11: Activity cleanup tanpa MySQL EVENT

**Files:**
- Modify: `backend/utils/activityCleanup.js`, `backend/routes/activity-cleanup.js`
- Create: `backend/test/activityCleanup.test.js`

**Interfaces:**
- Consumes: `db.query`, `node-cron`
- Produces: endpoint `/api/activity-cleanup/{status,manual,logs,test,update-retention,retention-options}` dengan bentuk JSON sama seperti sekarang. Field yang dulu dibaca dari `information_schema.EVENTS` diisi dari state cron.

Sebelum mulai: baca penuh `backend/routes/activity-cleanup.js` dan `backend/utils/activityCleanup.js` (358 + 243 baris) dan catat setiap field respons yang dipakai `frontend/src/routes/superadmin/activities/+page.svelte`. Field itu yang wajib tetap ada.

- [ ] **Step 1: Test yang gagal**

```js
test("cleanup manual menghapus aktivitas lebih tua dari retensi", async () => {
  const [u] = await query("SELECT id FROM users LIMIT 1");
  await query(
    `INSERT INTO user_activities (user_id, activity_type, created_at)
     VALUES ($1, 'login', now() - interval '10 days'), ($1, 'login', now())`,
    [u.id]
  );
  const res = await server.post("/api/activity-cleanup/manual", {}, token);
  assert.strictEqual(res.status, 200);
  const rows = await query("SELECT COUNT(*) AS n FROM user_activities");
  assert.strictEqual(rows[0].n, 1);
});

test("status tidak error tanpa information_schema.EVENTS", async () => {
  const res = await server.get("/api/activity-cleanup/status", token);
  assert.strictEqual(res.status, 200);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node --test test/activityCleanup.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

Inti `activityCleanup.js`:

```js
const cron = require("node-cron");
const { query } = require("../models/db");

class ActivityCleanup {
  constructor() {
    this.retentionDays = Number(process.env.ACTIVITY_RETENTION_DAYS || 3);
    this.batchSize = Number(process.env.CLEANUP_BATCH_SIZE || 1000);
    this.task = null;
  }

  async initialize() {
    const [row] = await query("SELECT setting_value FROM store_settings WHERE setting_key = 'activity_retention_days'");
    if (row) this.retentionDays = Number(row.setting_value);
    this.task = cron.schedule("0 0 * * *", () => this.runCleanup(), { timezone: "Asia/Jakarta" });
  }

  async runCleanup() {
    let total = 0;
    for (;;) {
      const rows = await query(
        `DELETE FROM user_activities
         WHERE id IN (
           SELECT id FROM user_activities
           WHERE created_at < now() - make_interval(days => $1)
           LIMIT $2
         )
         RETURNING id`,
        [this.retentionDays, this.batchSize]
      );
      total += rows.length;
      if (rows.length < this.batchSize) break;
    }
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('last_activity_cleanup', now()::text)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`
    );
    return total;
  }

  async setRetention(days) {
    this.retentionDays = days;
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('activity_retention_days', $1)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [String(days)]
    );
  }

  status() {
    return { isRunning: this.task !== null, schedule: "00:00 WIB setiap hari", retentionDays: this.retentionDays };
  }

  destroy() {
    if (this.task) this.task.stop();
    this.task = null;
  }
}

module.exports = new ActivityCleanup();
```

Route: `status` membaca `activityCleanup.status()` + statistik dari `user_activities` (port mekanis), `cleanupInterval` diisi `"1 DAY"`, `nextCleanupFormatted` diisi tanggal besok 00:00 WIB. `manual` memanggil `runCleanup()`. `update-retention` memvalidasi angka bulat 1-365 lalu `setRetention`. Semua `DROP EVENT`/`CREATE EVENT`/`SHOW VARIABLES` dihapus. Interpolasi `${retentionDays}` di SQL diganti parameter `make_interval(days => $1)`.

`index.js`: `activityCleanup.initialize()` dipanggil di semua environment (bukan hanya production/staging) supaya perilaku dev dan prod sama; tetap hormati `CLEANUP_ENABLED !== 'false'`.

- [ ] **Step 4: Jalankan test**

Run: `node --test test/activityCleanup.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/activityCleanup.js backend/routes/activity-cleanup.js backend/index.js backend/test/activityCleanup.test.js
git commit -m "feat(aktivitas): cleanup pakai node-cron menggantikan MySQL EVENT"
```

---

### Task 12: Bersihkan sisa MySQL

**Files:**
- Delete: `backend/app.js`, `backend/routes/activity.js`, `backend/routes/fixed-users.js`, `backend/scripts/scenario-runtime.js`, `backend/scripts/crud-smoke.js` (diganti runner skenario), sisa `backend/models/activity.js` jika kosong
- Move: `pos.sql` ke `docs/archive/pos-mysql.sql`
- Modify: `backend/package.json`, `backend/.env.example`, `backend/scripts/seed-users.js`, `backend/scripts/seed-products.js`

- [ ] **Step 1: Cari sisa**

```bash
cd /e/pos-soswir/backend
rtk rg -n "mysql2|getConnection|connection\.release|insertId|affectedRows|CURDATE|DATE_SUB|DATE_FORMAT|GROUP_CONCAT|ON DUPLICATE|cloudinary|ER_DUP_ENTRY|is_active = 1|is_reseller = 1" --glob '!db/migrate-from-mysql.js' --glob '!node_modules'
```

Expected setelah step 2: tidak ada hasil.

- [ ] **Step 2: Bereskan hasil pencarian**

Port `seed-users.js` dan `seed-products.js` ke `query()` dengan aturan terjemahan; seed produk tidak lagi mengisi `cloudinary_public_id`. Hapus file mati (K2). `npm uninstall cloudinary bcrypt` jika belum di Task 7; `mysql2` hanya ada di `devDependencies`. Hapus script `smoke:crud`. `.env.example`:

```env
# ---- Database PostgreSQL (WAJIB) ----
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=pos_db

# ---- Hanya untuk npm run db:migrate-mysql ----
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=pos_db
```

- [ ] **Step 3: Semua test**

Run: `cd /e/pos-soswir/backend && npm test`
Expected: semua PASS, termasuk `utils/shiftWindow.test.js`.

- [ ] **Step 4: Commit**

```bash
git add -A backend pos.sql docs/archive/pos-mysql.sql
git commit -m "chore: hapus sisa MySQL dan Cloudinary"
```

---

### Task 13: Folder gambar fixture

**Files:**
- Create: `backend/scripts/fixtures/make-images.js`, `backend/scripts/fixtures/images/*.png` (hasil generate, di-commit karena kecil)

**Interfaces:**
- Produces: `scripts/fixtures/images/{merah,hijau,biru,kuning,ungu,oranye}.png`, 200x200, dipakai test produk (Task 7) dan skenario (Task 14)

- [ ] **Step 1: Script PNG tanpa dependency**

```js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "images");
const COLORS = {
  merah: [220, 38, 38], hijau: [22, 163, 74], biru: [37, 99, 235],
  kuning: [234, 179, 8], ungu: [147, 51, 234], oranye: [234, 88, 12]
};
const SIZE = 200;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png([r, g, b]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + SIZE * 3);
  for (let x = 0; x < SIZE; x += 1) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: SIZE }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, rgb] of Object.entries(COLORS)) {
  const file = path.join(OUT, `${name}.png`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, png(rgb));
}
console.log(`Fixture gambar ada di ${OUT}`);
```

Script tidak menimpa file yang sudah ada, jadi kalau user menaruh foto asli bernama sama, foto itu yang dipakai (K4). Runner skenario juga memakai file `.jpg`/`.webp` lain di folder ini jika ada.

- [ ] **Step 2: Jalankan**

Run: `node scripts/fixtures/make-images.js && ls scripts/fixtures/images`
Expected: enam file `.png`, masing-masing beberapa ratus byte, bisa dibuka di viewer gambar.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/fixtures
git commit -m "test: fixture gambar produk lokal"
```

---

### Task 14: Runner skenario di Postgres

**Files:**
- Create: `backend/scripts/scenario/run.js`, `backend/scripts/scenario/scenarios.js`

**Interfaces:**
- Consumes: `setup.recreateDatabase('pos_scenario')`, `setup.applySchema`, fixture gambar (Task 13)
- Produces: `backend/reports/<stamp>/results.json` dengan bentuk:

```json
{
  "startedAt": "2026-11-15T10:00:00+07:00",
  "env": { "node": "v24.14.0", "postgres": "17.2", "backend": "http://localhost:3003", "frontend": "http://localhost:5174" },
  "scenarios": [
    {
      "id": "S04",
      "group": "Penjualan",
      "title": "Beli 1 barang toko",
      "steps": ["Kasir login", "Tambah Nasi Goreng x1", "Checkout tunai"],
      "expected": "Status 201, total 15.000, stok 10 jadi 9",
      "actual": "Status 201, total 15000, stok 9",
      "status": "pass",
      "screen": { "page": "/cashier/pos", "as": "kasir1" },
      "screenshot": null,
      "evidence": { "request": {}, "response": {} }
    }
  ]
}
```

- [ ] **Step 1: Kerangka runner**

`run.js` melakukan, berurutan:
1. `recreateDatabase('pos_scenario')`, `applySchema('pos_scenario')`.
2. Spawn backend: `node index.js` dengan `DB_NAME=pos_scenario`, `PORT=3003`, `NODE_ENV=development`; tunggu `GET /health` 200 (maks 30 detik).
3. Spawn frontend: `npm run dev -- --port 5174 --strictPort` di `frontend/` dengan env `VITE_BACKEND_URL=http://localhost:3003`; tunggu `GET http://localhost:5174/` 200 (maks 60 detik).
4. Seed fixture lewat **API** (bukan SQL langsung) supaya jalur API ikut teruji: superadmin dibuat via `INSERT` (satu-satunya SQL langsung, karena belum ada endpoint), lalu login, buat shift yang mencakup jam sekarang (`start = max(00:00, sekarang-60 menit)`, `end = min(23:59, sekarang+60 menit)`), buat `kasir1` dan `kasir2` di shift itu, buat `kasir_luar` di shift yang tidak mencakup jam sekarang, kategori Makanan/Minuman/PUBJ, supplier Bu Ani, upload 6 gambar fixture, buat produk dengan gambar itu.
5. Jalankan setiap skenario dari `scenarios.js` secara berurutan; error tak terduga di satu skenario dicatat `status: "error"` dan runner lanjut ke skenario berikutnya.
6. Tulis `results.json`, panggil `screens.js` (Task 15), panggil `report.js` (Task 15).
7. `finally`: matikan backend dan frontend (`child.kill()`; di Windows pakai `taskkill /pid <pid> /T /F` untuk proses `npm`), lalu drop `pos_scenario` kecuali `--keep-db`.

Bentuk satu skenario di `scenarios.js`:

```js
module.exports = [
  {
    id: "S04",
    group: "Penjualan",
    title: "Beli 1 barang toko",
    steps: ["Kasir login", "Tambah Nasi Goreng x1", "Checkout tunai"],
    expected: "Status 201, total 15.000, stok 10 jadi 9",
    screen: { page: "/cashier/pos", as: "kasir1" },
    async run(ctx) {
      const before = await ctx.product("Nasi Goreng");
      const res = await ctx.as("kasir1").post("/api/sales", {
        items: [{ product_id: before.id, quantity: 1, price: Number(before.price) }],
        payment_method: "Cash"
      });
      const after = await ctx.product("Nasi Goreng");
      ctx.actual(`Status ${res.status}, total ${res.body?.total_amount}, stok ${after.stock}`);
      ctx.expect(res.status === 201 && res.body.total_amount === 15000 && after.stock === before.stock - 1);
    }
  }
];
```

`ctx` menyediakan: `as(username)` (klien HTTP dengan token, login otomatis), `product(name)`, `sql(text, params)` (hanya untuk **membaca** bukti dan menggeser `created_at` di S20), `actual(text)`, `expect(condition, note?)`, `evidence(obj)`.

- [ ] **Step 2: Daftar skenario**

| ID | Grup | Skenario | Diharapkan |
|---|---|---|---|
| S01 | Akses | Superadmin login | 200 + token |
| S02 | Akses | Kasir login di dalam jam shift | 200 |
| S03 | Akses | Kasir login di luar jam shift | 403 `OUT_OF_SHIFT` |
| S04 | Penjualan | Beli 1 barang toko | 201, total benar, stok -1 |
| S05 | Penjualan | Beli banyak barang (3 produk, qty 2/1/5, termasuk satu produk dua baris di keranjang) | 201, total = jumlah harga DB, tiap stok berkurang sesuai, baris ganda digabung |
| S06 | Penjualan | Beli melebihi stok | 400, stok tidak berubah, tidak ada baris `sales` baru |
| S07 | Penjualan | Qty 0, -5, 1.5 | 400 untuk ketiganya, stok tidak berubah |
| S08 | Penjualan | Harga dimanipulasi client (`price: 1`) | 201, total memakai harga DB |
| S09 | Penjualan | Produk nonaktif | 400 |
| S10 | Penjualan | Dua kasir checkout bersamaan, stok 1 | tepat satu 201, satu 400, stok 0 |
| S11 | PUBJ | Stok harian masuk 20, jual 4 | stok katalog 16, `sale_taxes` fee = persentase entry, revenue entry 4 x harga |
| S12 | PUBJ | Jual PUBJ tanpa entry hari ini | 400 "belum ada stok hari ini" |
| S13 | PUBJ | Harga produk dinaikkan setelah terjual, lalu entry diselesaikan | revenue entry tetap harga lama |
| S14 | PUBJ | Tutup hari (`end-of-day`) dengan entry aktif | 200, entry `completed`, stok katalog PUBJ 0 |
| S15 | PUBJ | Edit stok harian lebih kecil dari terjual | 400 |
| S16 | Produk | Tambah stok produk toko (+10) | stok +10 |
| S17 | Produk | Upload gambar lokal dan tampil di katalog POS | URL `/uploads/products/...` 200, `<img>` di POS termuat (`naturalWidth > 0`) |
| S18 | Produk | Hard delete produk yang punya riwayat | 200, riwayat penjualan tetap ada dengan `product_id` null |
| S19 | Pengguna | Hapus kasir yang punya transaksi | 409 |
| S20 | Laporan | Transaksi jam 00:30 WIB | masuk `todayStats` hari ini |
| S21 | Laporan | Total supplier vs jumlah entry | `total_revenue` = jumlah revenue entry (tidak terkali produk) |
| S22 | Laporan | Laba toko dashboard vs laporan transaksi | sama |
| S23 | Profil | Update profil tanpa username | 400 |
| S24 | Stabilitas | 30 request yang memicu error 400/404 berturut-turut, lalu 1 request normal | request normal tetap 200 dalam < 2 detik |

Setiap skenario yang punya padanan UI mengisi `screen` (halaman dan akun yang login). Skenario tanpa padanan UI (S07, S10, S24) tidak punya screenshot, dan laporan menampilkan bukti request/response sebagai gantinya.

- [ ] **Step 3: Jalankan runner tanpa screenshot**

Run: `cd /e/pos-soswir/backend && node scripts/scenario/run.js --no-screens --keep-db`
Expected: `results.json` terisi 24 skenario; ringkasan `PASS/FAIL` tercetak di konsol. Semua seharusnya PASS setelah Task 5-11; FAIL berarti ada regresi yang harus dicek sebelum lanjut.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/scenario/run.js backend/scripts/scenario/scenarios.js backend/package.json
git commit -m "test: runner skenario bisnis di database pos_scenario"
```

---

### Task 15: Screenshot UI dan laporan HTML

**Files:**
- Create: `backend/scripts/scenario/screens.js`, `backend/scripts/scenario/report.js`
- Modify: `backend/package.json` (devDependency `playwright`)

**Interfaces:**
- Consumes: `results.json` (Task 14)
- Produces: `backend/reports/<stamp>/shots/<id>.png`, `backend/reports/<stamp>/laporan-skenario.html` (satu file, gambar di-embed base64 supaya bisa dikirim sebagai satu file)

- [ ] **Step 1: Pasang Playwright**

```bash
cd /e/pos-soswir/backend
npm install -D playwright
npx playwright install chromium
```

- [ ] **Step 2: `screens.js`**

```js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function captureScreens({ results, outDir, frontendUrl, loginAs }) {
  fs.mkdirSync(path.join(outDir, "shots"), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const scenario of results.scenarios) {
      if (!scenario.screen) continue;
      const session = await loginAs(scenario.screen.as);
      const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
      await context.addInitScript((s) => {
        localStorage.setItem("pos_token", s.token);
        localStorage.setItem("pos_user_role", s.role);
        localStorage.setItem("pos_user_id", String(s.id));
        localStorage.setItem("pos_username", s.username);
      }, session);
      const page = await context.newPage();
      await page.goto(frontendUrl + scenario.screen.page, { waitUntil: "networkidle" });
      if (scenario.screen.highlight) {
        await page.locator(scenario.screen.highlight).first().evaluate((el) => {
          el.style.outline = "4px solid #dc2626";
          el.scrollIntoView({ block: "center" });
        });
      }
      const file = path.join(outDir, "shots", `${scenario.id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      scenario.screenshot = path.relative(outDir, file);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

module.exports = { captureScreens };
```

Untuk skenario yang gagal, runner menyimpan `scenario.screen.highlight` (selector elemen yang relevan, misalnya baris produk atau kartu statistik) supaya bagian yang salah diberi garis merah di screenshot. Untuk S03 (di luar shift) halaman yang di-screenshot adalah `/login` setelah percobaan login `kasir_luar` lewat UI, memakai `page.fill` pada field username/password (selector dicek dari `frontend/src/routes/login/+page.svelte` saat implementasi).

Screenshot diambil untuk **semua** skenario yang punya `screen`, lulus maupun gagal. Laporan menampilkan screenshot gagal dalam ukuran penuh di bagian atas, dan screenshot lulus sebagai thumbnail yang bisa diklik.

- [ ] **Step 3: `report.js`**

Membaca `results.json`, menghasilkan satu file HTML:

1. Header: judul "Laporan Skenario POS Soswir", waktu jalan (WIB), versi Node/Postgres, commit (`git rev-parse --short HEAD`).
2. Ringkasan: total, lulus, gagal, error; bar proporsi; tabel per grup (Akses, Penjualan, PUBJ, Produk, Pengguna, Laporan, Profil, Stabilitas).
3. Bagian "Yang gagal" (hanya muncul jika ada): per skenario gagal, kartu berisi ID, judul, langkah, diharapkan vs aktual (dua kolom), screenshot ukuran penuh dengan sorotan merah, dan bukti request/response dalam `<details>`.
4. Tabel semua skenario: ID, grup, judul, status (badge), diharapkan, aktual, thumbnail.
5. Lampiran: daftar bug audit #1-#13 dan skenario yang membuktikan tiap perbaikan (S08 untuk #1, S07 untuk #2, S10 untuk #3, S14 untuk #4, S15 untuk #5, S11/S12 untuk #6, S11 untuk #7, S21 untuk #8, S22 untuk #11, S13 untuk #12, S20 untuk #13).

Aturan HTML: satu file, CSS inline di `<style>`, tanpa CDN dan tanpa JS eksternal; gambar `data:image/png;base64,...`; semua teks dari hasil (pesan error, body response) di-escape (`& < > " '`) sebelum masuk HTML; warna lewat variabel CSS dengan `@media (prefers-color-scheme: dark)`; lebar aman di layar HP (tabel dibungkus `overflow-x: auto`). Laporan ini file lokal, **bukan** Artifact claude.ai (aturan user).

- [ ] **Step 4: Jalankan penuh**

Run: `cd /e/pos-soswir/backend && npm run scenario`
Expected: konsol mencetak ringkasan dan path `backend/reports/<stamp>/laporan-skenario.html`. Buka file itu di browser: ringkasan tampil, setiap skenario dengan `screen` punya gambar, bagian "Yang gagal" berisi screenshot penuh untuk tiap kegagalan (atau bagian itu tidak muncul jika semua lulus).

Verifikasi bahwa jalur "gagal" benar-benar tergambar (bukan hanya jalur lulus): jalankan sekali dengan skenario sengaja dirusak:

```bash
SCENARIO_FORCE_FAIL=S04 npm run scenario
```

`run.js` membaca `SCENARIO_FORCE_FAIL` dan membalik hasil `expect` untuk ID itu. Expected: S04 muncul di bagian "Yang gagal" lengkap dengan screenshot halaman POS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/scenario backend/package.json backend/package-lock.json
git commit -m "test: screenshot UI dan laporan HTML hasil skenario"
```

---

### Task 16: Verifikasi akhir dan serah terima

- [ ] **Step 1: Test unit dan integrasi**

Run: `cd /e/pos-soswir/backend && npm test`
Expected: semua PASS.

- [ ] **Step 2: Skenario penuh**

Run: `npm run scenario`
Expected: 24/24 PASS. Kalau ada FAIL, jangan diakali di skenario; perbaiki kodenya atau laporkan ke user sebagai temuan dengan screenshot di laporan.

- [ ] **Step 3: Aplikasi asli di `pos_db`**

```bash
cd /e/pos-soswir/backend && npm start
cd /e/pos-soswir/frontend && npm run dev
```

Login superadmin, buka dashboard, daftar produk, laporan transaksi, POS kasir. Angka total penjualan di dashboard harus sama dengan `SELECT SUM(total_amount) FROM sales` di Postgres dan di MySQL lama (dari Task 3). Gambar produk lama (URL Cloudinary) dan baru (`/uploads/...`) sama-sama tampil.

- [ ] **Step 4: Frontend check**

Run: `cd /e/pos-soswir/frontend && npm run check`
Expected: jumlah error tidak lebih banyak dari sebelum Task 7.

- [ ] **Step 5: Catatan deploy**

Tulis di PR body (bukan file baru):
- server produksi butuh PostgreSQL 17 dan variabel `DB_PORT`;
- urutan deploy: backup MySQL, `npm run db:init`, `npm run db:migrate-mysql`, start backend;
- folder `backend/uploads/products/` harus persisten di server (tidak ikut terhapus saat deploy ulang);
- rollback: checkout commit sebelum branch ini dan arahkan `.env` ke MySQL lagi; data yang masuk ke Postgres setelah cutover tidak ikut kembali.

- [ ] **Step 6: Simpan catatan Obsidian Brain** sesuai protokol `CLAUDE.md` (`save_and_ingest.ps1 -NoIngest`).

## Risiko yang tersisa setelah plan ini

- `pos_db` produksi belum pernah dilihat isinya (MySQL lokal mati saat audit). Data aneh (misalnya `daily_stock_entries` dengan `quantity_sold > quantity_in`) akan membuat migrasi gagal di constraint `sold_not_above_in`. Kalau itu terjadi, script berhenti dan rollback; datanya dilaporkan ke user, bukan diubah diam-diam.
- Hosting produksi belum dicek mendukung Postgres.
- Gambar lama di Cloudinary tetap bergantung pada akun Cloudinary. Memindahkannya ke folder lokal di luar cakupan plan ini.
- Label minggu dari `EXTRACT(WEEK)` (ISO) bisa beda satu angka dengan `WEEK()` mode 0 MySQL untuk minggu di awal tahun. Ini kosmetik di grafik.
