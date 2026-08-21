# Jadwal Shift Kasir Implementation Plan

> **SUDAH TIDAK BERLAKU (2026-08-21).** Plan ini dieksekusi sampai selesai, lalu modelnya diganti atas permintaan user: sesi tidak lagi per hari, tab Jadwal Shift dibuang, dan jadwalnya menyatu ke tabel Manajemen Kasir. Kolom `day_of_week` dan tabel `shift_assignments` sudah tidak ada. Dokumen ini disimpan sebagai catatan sejarah. Yang berlaku sekarang ada di `docs/superpowers/specs/2026-08-21-jadwal-shift-kasir-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin menetapkan jadwal shift mingguan per kasir, dan kasir hanya bisa memakai aplikasi selama jadwalnya berjalan.

**Architecture:** Dua tabel MySQL (`shifts` dan `shift_assignments`, many-to-many) menyimpan template mingguan. Semua logika waktu tinggal di satu modul murni tanpa akses database (`utils/shiftWindow.js`) sehingga bisa diuji tanpa MySQL, dibungkus satu modul tipis yang menyentuh database (`utils/shiftAccess.js`). Penegakan dilakukan di dua titik saja: endpoint login dan middleware `authenticateToken`. UI-nya digabung ke halaman Manajemen Kasir sebagai tab kedua.

**Tech Stack:** Node 24.14, Express 4, mysql2/promise, `node:test` (bawaan Node, tanpa dependency baru), SvelteKit 2 + Svelte 4, Tailwind 3, komponen shadcn-svelte lokal di `frontend/src/lib/components/ui/`.

**Spec:** `docs/superpowers/specs/2026-08-21-jadwal-shift-kasir-design.md`

## Global Constraints

- Zona waktu jadwal adalah `Asia/Jakarta`. Jangan pernah memakai `NOW()`, `CURDATE()`, atau `UTC_TIMESTAMP()` MySQL untuk logika jadwal.
- `SHIFT_GRACE_MINUTES = 15`. Didefinisikan sekali di `backend/utils/shiftWindow.js`, tidak boleh diketik ulang di tempat lain.
- Hari memakai skema ISO: 1 = Senin sampai 7 = Minggu. Bukan `Date.getDay()` yang 0 = Minggu.
- Fail-closed: kasir tanpa assignment sama sekali tidak boleh masuk.
- Superadmin tidak pernah dibatasi jadwal.
- Bahasa pesan error yang dilihat pengguna: Indonesia, mengikuti `frontend/src/lib/errorHandler.ts`.
- Jangan menambah dependency npm baru, backend maupun frontend.
- Jangan menulis trailer `Co-Authored-By` di commit message.
- Urutan task tidak boleh dibalik. Penegakan (Task 9 dan 10) datang paling akhir supaya kasir tidak terkunci sebelum superadmin sempat mengisi jadwal.

## File Structure

**Backend, dibuat baru**

| File | Tanggung jawab |
|---|---|
| `backend/utils/shiftWindow.js` | Semua aritmetika waktu. Fungsi murni, tanpa `require` database. |
| `backend/utils/shiftWindow.test.js` | Test untuk modul di atas. |
| `backend/models/shift.js` | `createShiftTables()`, mengikuti pola `models/settings.js`. |
| `backend/utils/shiftAccess.js` | `isOnShift(userId, role)`. Ambil data dari MySQL, hitung pakai `shiftWindow`. |
| `backend/routes/shifts.js` | CRUD shift, khusus superadmin. |

**Backend, diubah**

| File | Perubahan |
|---|---|
| `backend/index.js` | Daftarkan `createShiftTables()` dan route `/api/shifts`. |
| `backend/package.json` | Tambah script `test`. |
| `backend/routes/auth.js` | Penegakan jadwal saat login. |
| `backend/middleware/authMiddleware.js` | Penegakan jadwal per request. |

**Frontend, dibuat baru**

| File | Tanggung jawab |
|---|---|
| `frontend/src/lib/components/cashiers/CashierList.svelte` | Isi tab "Daftar Kasir". Dipindah apa adanya dari halaman lama. |
| `frontend/src/lib/components/cashiers/ShiftSchedule.svelte` | Isi tab "Jadwal Shift". |

**Frontend, diubah**

| File | Perubahan |
|---|---|
| `frontend/src/routes/superadmin/cashiers/+page.svelte` | Jadi cangkang tipis: auth guard, judul, dan dua tab. |
| `frontend/src/lib/errorHandler.ts` | Teruskan `details` pada error 403. |
| `frontend/src/lib/apiConfig.ts` | Tangani `OUT_OF_SHIFT`. |

---

### Task 1: Modul waktu murni

Semua aritmetika jadwal hidup di sini supaya bisa diuji tanpa database. Tidak boleh ada `require("./db")` di file ini, selamanya.

**Files:**
- Create: `backend/utils/shiftWindow.js`
- Test: `backend/utils/shiftWindow.test.js`
- Modify: `backend/package.json` (baris `"test"`)

**Interfaces:**
- Consumes: tidak ada. Ini task pertama.
- Produces:
  - `SHIFT_GRACE_MINUTES: number` (bernilai 15)
  - `nowInJakarta(date?: Date) -> { dayOfWeek: 1..7, minutesSinceMidnight: 0..1439 }`
  - `timeToMinutes(time: string) -> number` — menerima `'08:00'` maupun `'08:00:00'`
  - `isWithinWindow(nowMinutes: number, startTime: string, endTime: string) -> boolean`
  - `findActiveShift(shifts: Shift[], now) -> Shift | null`
  - `findNextShift(shifts: Shift[], now) -> Shift | null`
  - Bentuk `Shift` yang dipakai modul ini: `{ day_of_week: number, start_time: string, end_time: string }`. Kolom lain diabaikan.

- [ ] **Step 1: Tambah script test di `backend/package.json`**

Ubah baris `"test"` yang sekarang berbunyi `"test": "echo \"Error: no test specified\" && exit 1",` menjadi:

```json
    "test": "node --test",
```

- [ ] **Step 2: Tulis test yang gagal**

Buat `backend/utils/shiftWindow.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");

const {
  SHIFT_GRACE_MINUTES,
  nowInJakarta,
  timeToMinutes,
  isWithinWindow,
  findActiveShift,
  findNextShift
} = require("./shiftWindow");

const sesi1 = { id: 1, day_of_week: 1, start_time: "08:00:00", end_time: "10:00:00" };
const sesi2 = { id: 2, day_of_week: 1, start_time: "10:00:00", end_time: "12:00:00" };
const selasa = { id: 3, day_of_week: 2, start_time: "08:00:00", end_time: "10:00:00" };

test("toleransi bernilai 15 menit", () => {
  assert.strictEqual(SHIFT_GRACE_MINUTES, 15);
});

test("timeToMinutes menerima format dengan dan tanpa detik", () => {
  assert.strictEqual(timeToMinutes("08:00:00"), 480);
  assert.strictEqual(timeToMinutes("08:00"), 480);
  assert.strictEqual(timeToMinutes("00:00:00"), 0);
  assert.strictEqual(timeToMinutes("23:59:00"), 1439);
});

test("nowInJakarta memetakan UTC ke hari dan menit WIB", () => {
  // 2026-08-24 01:00 UTC = Senin 08:00 WIB
  assert.deepStrictEqual(nowInJakarta(new Date("2026-08-24T01:00:00Z")), {
    dayOfWeek: 1,
    minutesSinceMidnight: 480
  });
  // 2026-08-23 17:30 UTC = Senin 00:30 WIB, masih hari Minggu kalau salah pakai UTC
  assert.deepStrictEqual(nowInJakarta(new Date("2026-08-23T17:30:00Z")), {
    dayOfWeek: 1,
    minutesSinceMidnight: 30
  });
  // 2026-08-23 16:00 UTC = Minggu 23:00 WIB, memastikan Minggu jadi 7 bukan 0
  assert.deepStrictEqual(nowInJakarta(new Date("2026-08-23T16:00:00Z")), {
    dayOfWeek: 7,
    minutesSinceMidnight: 1380
  });
});

test("isWithinWindow menerima batas persis", () => {
  assert.strictEqual(isWithinWindow(480, "08:00:00", "10:00:00"), true); // tepat mulai
  assert.strictEqual(isWithinWindow(600, "08:00:00", "10:00:00"), true); // tepat selesai
});

test("isWithinWindow menghormati toleransi di dua sisi", () => {
  assert.strictEqual(isWithinWindow(465, "08:00:00", "10:00:00"), true);  // 07:45, batas awal
  assert.strictEqual(isWithinWindow(464, "08:00:00", "10:00:00"), false); // 07:44
  assert.strictEqual(isWithinWindow(615, "08:00:00", "10:00:00"), true);  // 10:15, batas akhir
  assert.strictEqual(isWithinWindow(616, "08:00:00", "10:00:00"), false); // 10:16
});

test("findActiveShift mengabaikan shift di hari lain", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 540 }; // Senin 09:00
  assert.strictEqual(findActiveShift([selasa], now), null);
  assert.strictEqual(findActiveShift([selasa, sesi1], now).id, 1);
});

test("findActiveShift mengembalikan null kalau kasir tidak punya shift", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 540 };
  assert.strictEqual(findActiveShift([], now), null);
});

test("findActiveShift saat dua sesi tumpang tindih karena toleransi", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 600 }; // Senin 10:00 persis
  const hasil = findActiveShift([sesi1, sesi2], now);
  assert.notStrictEqual(hasil, null);
  assert.ok(hasil.id === 1 || hasil.id === 2);
});

test("findNextShift memilih shift terdekat ke depan", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 420 }; // Senin 07:00
  assert.strictEqual(findNextShift([sesi2, sesi1], now).id, 1);
});

test("findNextShift memutar ke minggu berikutnya", () => {
  const now = { dayOfWeek: 3, minutesSinceMidnight: 600 }; // Rabu 10:00
  assert.strictEqual(findNextShift([sesi1], now).id, 1);
});

test("findNextShift mengembalikan null kalau daftar kosong", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 420 };
  assert.strictEqual(findNextShift([], now), null);
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `cd backend && npm test`
Expected: FAIL, `Cannot find module './shiftWindow'`

- [ ] **Step 4: Tulis implementasinya**

Buat `backend/utils/shiftWindow.js`:

```js
const SHIFT_GRACE_MINUTES = 15;

const WEEKDAY_TO_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function nowInJakarta(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type).value;

  return {
    dayOfWeek: WEEKDAY_TO_ISO[get("weekday")],
    minutesSinceMidnight: Number(get("hour")) * 60 + Number(get("minute"))
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isWithinWindow(nowMinutes, startTime, endTime) {
  const start = timeToMinutes(startTime) - SHIFT_GRACE_MINUTES;
  const end = timeToMinutes(endTime) + SHIFT_GRACE_MINUTES;
  return nowMinutes >= start && nowMinutes <= end;
}

function findActiveShift(shifts, now) {
  const found = shifts.find(
    (shift) =>
      shift.day_of_week === now.dayOfWeek &&
      isWithinWindow(now.minutesSinceMidnight, shift.start_time, shift.end_time)
  );
  return found || null;
}

function minutesUntil(now, shift) {
  const shiftStart = (shift.day_of_week - 1) * 1440 + timeToMinutes(shift.start_time);
  const nowAbsolute = (now.dayOfWeek - 1) * 1440 + now.minutesSinceMidnight;
  const diff = shiftStart - nowAbsolute;
  return diff >= 0 ? diff : diff + 7 * 1440;
}

function findNextShift(shifts, now) {
  if (shifts.length === 0) return null;
  return shifts
    .slice()
    .sort((a, b) => minutesUntil(now, a) - minutesUntil(now, b))[0];
}

module.exports = {
  SHIFT_GRACE_MINUTES,
  nowInJakarta,
  timeToMinutes,
  isWithinWindow,
  findActiveShift,
  findNextShift
};
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `cd backend && npm test`
Expected: PASS, 10 test lulus, 0 gagal

- [ ] **Step 6: Commit**

```bash
git add backend/utils/shiftWindow.js backend/utils/shiftWindow.test.js backend/package.json
git commit -m "feat(shift): tambah modul waktu shift dan test runner node:test"
```

---

### Task 2: Tabel shifts dan shift_assignments

**Files:**
- Create: `backend/models/shift.js`
- Modify: `backend/index.js` (baris 26 dan blok `initializeDatabase` di baris 201-227)

**Interfaces:**
- Consumes: tidak ada.
- Produces: `createShiftTables(): Promise<void>` diekspor dari `backend/models/shift.js`.

> **Penting:** `shift_assignments` punya foreign key ke `users`. Blok `Promise.all` yang sudah ada menjalankan semua `createXTable()` bersamaan, jadi `createShiftTables()` **tidak boleh** ditaruh di dalamnya — tabel `users` bisa belum ada saat FK dibuat. Panggil setelah `Promise.all` selesai.

- [ ] **Step 1: Buat model**

Buat `backend/models/shift.js`, mengikuti pola `backend/models/settings.js`:

```js
const { pool } = require("./db");

const createShiftTables = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        day_of_week TINYINT NOT NULL,
        start_time  TIME NOT NULL,
        end_time    TIME NOT NULL,
        label       VARCHAR(50) NOT NULL,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_shift_slot (day_of_week, start_time, end_time)
      );
    `);
    console.log("Shifts table created or already exists.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        shift_id   INT NOT NULL,
        user_id    INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_shift_user (shift_id, user_id),
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
      );
    `);
    console.log("Shift_assignments table created or already exists.");
  } catch (error) {
    console.error("Error creating shift tables:", error);
  } finally {
    connection.release();
  }
};

module.exports = { createShiftTables };
```

- [ ] **Step 2: Daftarkan di `backend/index.js`**

Tambahkan require setelah baris `const { createActivityLogTable } = require("./models/activity");`:

```js
const { createShiftTables } = require("./models/shift");
```

Lalu di dalam `initializeDatabase`, tepat setelah blok `await Promise.all([...])` dan sebelum `console.log("✅ All database tables initialized");`, tambahkan:

```js
    await createShiftTables();
```

- [ ] **Step 3: Jalankan backend dan verifikasi tabel terbentuk**

Run: `cd backend && node index.js`
Expected: log memuat `Shifts table created or already exists.` dan `Shift_assignments table created or already exists.`, lalu `✅ All database tables initialized`. Hentikan server setelah itu.

- [ ] **Step 4: Verifikasi struktur tabel di MySQL**

Run:

```bash
cd backend && node -e "
require('dotenv').config();
const mysql=require('mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  for (const t of ['shifts','shift_assignments']) {
    const [cols]=await c.query('SHOW COLUMNS FROM '+t);
    console.log(t+':', cols.map(x=>x.Field).join(', '));
  }
  await c.end();
})();
"
```

Expected:
```
shifts: id, day_of_week, start_time, end_time, label, is_active, created_at, updated_at
shift_assignments: id, shift_id, user_id, created_at
```

- [ ] **Step 5: Commit**

```bash
git add backend/models/shift.js backend/index.js
git commit -m "feat(shift): tambah tabel shifts dan shift_assignments"
```

---

### Task 3: Fungsi isOnShift

**Files:**
- Create: `backend/utils/shiftAccess.js`

**Interfaces:**
- Consumes: `findActiveShift`, `findNextShift`, `nowInJakarta` dari `backend/utils/shiftWindow.js` (Task 1). `pool` dari `backend/models/db.js`.
- Produces: `isOnShift(userId: number, role: string, at?: Date) -> Promise<{ allowed: boolean, shift: object|null, nextShift: object|null }>` diekspor dari `backend/utils/shiftAccess.js`.

Modul ini sengaja tipis: satu query, lalu delegasi ke fungsi murni. Tidak ada test unit di sini karena butuh MySQL; logikanya sudah diuji di Task 1. Verifikasinya manual lewat script di Step 2.

- [ ] **Step 1: Tulis modulnya**

Buat `backend/utils/shiftAccess.js`:

```js
const { pool } = require("../models/db");
const { nowInJakarta, findActiveShift, findNextShift } = require("./shiftWindow");

const DAY_NAMES = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

async function isOnShift(userId, role, at = new Date()) {
  if (role === "superadmin") {
    return { allowed: true, shift: null, nextShift: null };
  }

  const connection = await pool.getConnection();
  try {
    const [shifts] = await connection.query(
      `SELECT s.id, s.day_of_week, s.start_time, s.end_time, s.label
       FROM shifts s
       JOIN shift_assignments sa ON sa.shift_id = s.id
       WHERE sa.user_id = ? AND s.is_active = 1`,
      [userId]
    );

    const now = nowInJakarta(at);
    const shift = findActiveShift(shifts, now);

    return {
      allowed: shift !== null,
      shift,
      nextShift: shift ? null : findNextShift(shifts, now)
    };
  } finally {
    connection.release();
  }
}

function describeShift(shift) {
  if (!shift) return null;
  const day = DAY_NAMES[shift.day_of_week] || "";
  return `${day} ${String(shift.start_time).slice(0, 5)}-${String(shift.end_time).slice(0, 5)}`;
}

function outOfShiftMessage(nextShift) {
  const jadwal = describeShift(nextShift);
  return jadwal
    ? `Di luar jadwal shift Anda. Jadwal berikutnya: ${jadwal}.`
    : "Anda belum punya jadwal shift. Hubungi superadmin.";
}

module.exports = { isOnShift, describeShift, outOfShiftMessage };
```

- [ ] **Step 2: Verifikasi manual dengan data uji**

Buat data uji lalu panggil fungsinya. Jalankan dari `backend/`:

```bash
cd backend && node -e "
require('dotenv').config();
const { pool } = require('./models/db');
const { isOnShift, outOfShiftMessage } = require('./utils/shiftAccess');
(async () => {
  const c = await pool.getConnection();
  const [[kasir]] = await c.query(\"SELECT id FROM users WHERE username = 'kasir1'\");
  await c.query('DELETE FROM shifts WHERE label = ?', ['UJI']);
  const [ins] = await c.query('INSERT INTO shifts (day_of_week, start_time, end_time, label) VALUES (1, ?, ?, ?)', ['08:00:00','10:00:00','UJI']);
  await c.query('INSERT INTO shift_assignments (shift_id, user_id) VALUES (?, ?)', [ins.insertId, kasir.id]);
  c.release();

  const didalam = await isOnShift(kasir.id, 'cashier', new Date('2026-08-24T02:00:00Z')); // Senin 09:00 WIB
  const diluar  = await isOnShift(kasir.id, 'cashier', new Date('2026-08-24T08:00:00Z')); // Senin 15:00 WIB
  const admin   = await isOnShift(1, 'superadmin', new Date('2026-08-24T08:00:00Z'));
  console.log('dalam jadwal :', didalam.allowed);
  console.log('luar jadwal  :', diluar.allowed, '|', outOfShiftMessage(diluar.nextShift));
  console.log('superadmin   :', admin.allowed);

  const c2 = await pool.getConnection();
  await c2.query('DELETE FROM shifts WHERE label = ?', ['UJI']);
  c2.release();
  await pool.end();
})();
"
```

Expected:
```
dalam jadwal : true
luar jadwal  : false | Di luar jadwal shift Anda. Jadwal berikutnya: Senin 08:00-10:00.
superadmin   : true
```

- [ ] **Step 3: Commit**

```bash
git add backend/utils/shiftAccess.js
git commit -m "feat(shift): tambah isOnShift dan penyusun pesan penolakan"
```

---

### Task 4: API CRUD shift

**Files:**
- Create: `backend/routes/shifts.js`
- Modify: `backend/index.js` (blok require route dan blok `app.use("/api/...")`)

**Interfaces:**
- Consumes: `authenticateToken`, `authorizeRole` dari `backend/middleware/authMiddleware.js`. `pool` dari `backend/models/db.js`.
- Produces: endpoint `GET/POST/PUT/DELETE /api/shifts`. Bentuk objek yang dikembalikan `GET`:
  ```
  { id, day_of_week, start_time, end_time, label, is_active,
    cashiers: [{ id, username }] }
  ```
  Frontend Task 6 dan 7 bergantung persis pada bentuk ini.

- [ ] **Step 1: Tulis route**

Buat `backend/routes/shifts.js`:

```js
const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const { timeToMinutes } = require("../utils/shiftWindow");

const router = express.Router();

const onlySuperadmin = [authenticateToken, authorizeRole(["superadmin"])];

async function validatePayload(connection, body, excludeShiftId) {
  const { day_of_week, start_time, end_time, label, user_ids } = body;

  if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7) {
    return "Hari tidak valid.";
  }
  if (!start_time || !end_time) {
    return "Jam mulai dan jam selesai wajib diisi.";
  }
  if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
    return "Jam selesai harus lebih besar dari jam mulai.";
  }
  if (!label || label.trim() === "") {
    return "Label sesi tidak boleh kosong.";
  }
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return "Pilih minimal satu kasir.";
  }

  const [rows] = await connection.query(
    "SELECT id FROM users WHERE id IN (?) AND role = 'cashier'",
    [user_ids]
  );
  if (rows.length !== user_ids.length) {
    return "Ada pengguna yang bukan kasir atau tidak ditemukan.";
  }

  const [bentrok] = await connection.query(
    `SELECT id FROM shifts
     WHERE day_of_week = ? AND id <> ? AND start_time < ? AND end_time > ?`,
    [day_of_week, excludeShiftId || 0, end_time, start_time]
  );
  if (bentrok.length > 0) {
    return "Jam sesi bertabrakan dengan sesi lain di hari yang sama.";
  }

  return null;
}

router.get("/", ...onlySuperadmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [shifts] = await connection.query(
      "SELECT id, day_of_week, start_time, end_time, label, is_active FROM shifts ORDER BY day_of_week ASC, start_time ASC"
    );
    const [assignments] = await connection.query(
      `SELECT sa.shift_id, u.id, u.username
       FROM shift_assignments sa
       JOIN users u ON u.id = sa.user_id
       ORDER BY u.username ASC`
    );
    connection.release();

    const byShift = new Map();
    for (const row of assignments) {
      if (!byShift.has(row.shift_id)) byShift.set(row.shift_id, []);
      byShift.get(row.shift_id).push({ id: row.id, username: row.username });
    }

    res.json(shifts.map((shift) => ({ ...shift, cashiers: byShift.get(shift.id) || [] })));
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ message: "Server error fetching shifts" });
  }
});

router.post("/", ...onlySuperadmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const problem = await validatePayload(connection, req.body, null);
    if (problem) {
      connection.release();
      return res.status(400).json({ message: problem });
    }

    const { day_of_week, start_time, end_time, label, user_ids } = req.body;

    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO shifts (day_of_week, start_time, end_time, label) VALUES (?, ?, ?, ?)",
      [day_of_week, start_time, end_time, label.trim()]
    );
    await connection.query(
      "INSERT INTO shift_assignments (shift_id, user_id) VALUES ?",
      [user_ids.map((id) => [result.insertId, id])]
    );
    await connection.commit();
    connection.release();

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error creating shift:", error);
    res.status(500).json({ message: "Server error creating shift" });
  }
});

router.put("/:id", ...onlySuperadmin, async (req, res) => {
  const shiftId = Number(req.params.id);
  const connection = await pool.getConnection();
  try {
    const problem = await validatePayload(connection, req.body, shiftId);
    if (problem) {
      connection.release();
      return res.status(400).json({ message: problem });
    }

    const { day_of_week, start_time, end_time, label, user_ids } = req.body;

    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE shifts SET day_of_week = ?, start_time = ?, end_time = ?, label = ? WHERE id = ?",
      [day_of_week, start_time, end_time, label.trim(), shiftId]
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "Sesi tidak ditemukan." });
    }
    await connection.query("DELETE FROM shift_assignments WHERE shift_id = ?", [shiftId]);
    await connection.query(
      "INSERT INTO shift_assignments (shift_id, user_id) VALUES ?",
      [user_ids.map((id) => [shiftId, id])]
    );
    await connection.commit();
    connection.release();

    res.json({ id: shiftId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error updating shift:", error);
    res.status(500).json({ message: "Server error updating shift" });
  }
});

router.delete("/:id", ...onlySuperadmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query("DELETE FROM shifts WHERE id = ?", [
      Number(req.params.id)
    ]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Sesi tidak ditemukan." });
    }
    res.json({ message: "Sesi dihapus." });
  } catch (error) {
    console.error("Error deleting shift:", error);
    res.status(500).json({ message: "Server error deleting shift" });
  }
});

module.exports = router;
```

- [ ] **Step 2: Daftarkan route di `backend/index.js`**

Tambahkan setelah baris `const activityCleanupRoutes = require("./routes/activity-cleanup");`:

```js
const shiftsRoutes = require("./routes/shifts");
```

Tambahkan setelah baris `app.use("/api/activity-cleanup", activityCleanupRoutes);`:

```js
app.use("/api/shifts", shiftsRoutes);
```

- [ ] **Step 3: Verifikasi manual lewat HTTP**

Nyalakan backend di satu terminal (`cd backend && npm run dev`), lalu di terminal lain:

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"superadmin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

KASIR=$(curl -s http://localhost:3002/api/users/cashiers -H "Authorization: Bearer $TOKEN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).slice(0,2).map(u=>u.id).join(',')")
echo "id kasir: $KASIR"

# buat sesi 1
curl -s -X POST http://localhost:3002/api/shifts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"day_of_week\":1,\"start_time\":\"08:00:00\",\"end_time\":\"10:00:00\",\"label\":\"Sesi 1\",\"user_ids\":[${KASIR}]}"
echo

# tabrakan jam, harus ditolak 400
curl -s -X POST http://localhost:3002/api/shifts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"day_of_week\":1,\"start_time\":\"09:00:00\",\"end_time\":\"11:00:00\",\"label\":\"Bentrok\",\"user_ids\":[${KASIR}]}"
echo

# sesi bersentuhan persis, harus diterima
curl -s -X POST http://localhost:3002/api/shifts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"day_of_week\":1,\"start_time\":\"10:00:00\",\"end_time\":\"12:00:00\",\"label\":\"Sesi 2\",\"user_ids\":[${KASIR}]}"
echo

curl -s http://localhost:3002/api/shifts -H "Authorization: Bearer $TOKEN"
```

Expected: POST pertama `{"id":N}`, POST kedua `{"message":"Jam sesi bertabrakan dengan sesi lain di hari yang sama."}`, POST ketiga `{"id":N}`, GET mengembalikan dua sesi masing-masing dengan array `cashiers` berisi username.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/shifts.js backend/index.js
git commit -m "feat(shift): tambah API CRUD jadwal shift"
```

---

### Task 5: Pecah halaman Manajemen Kasir jadi dua tab

Refactor murni. Tidak ada fitur baru, tidak ada perubahan perilaku. Tab kedua sengaja masih kosong supaya kalau ada yang rusak, penyebabnya jelas pemindahan, bukan fitur jadwal.

**Files:**
- Create: `frontend/src/lib/components/cashiers/CashierList.svelte`
- Modify: `frontend/src/routes/superadmin/cashiers/+page.svelte` (seluruh file, sekarang 778 baris)

**Interfaces:**
- Consumes: tidak ada dari task sebelumnya.
- Produces: `CashierList.svelte` tanpa prop apa pun. Semua state dan fetch-nya sendiri.

- [ ] **Step 1: Pindahkan isi halaman ke komponen**

Buat direktori `frontend/src/lib/components/cashiers/`, lalu salin **seluruh isi** `frontend/src/routes/superadmin/cashiers/+page.svelte` ke `CashierList.svelte`, dengan tiga perubahan:

1. Hapus blok auth guard di `onMount` (pengecekan `pos_token` dan `pos_user_role` lalu `goto("/login")`). Guard pindah ke route.
2. Hapus elemen judul halaman `<h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Kasir</h2>` beserta pembungkus header-nya. Judul pindah ke route.
3. Hapus import yang jadi yatim setelah dua langkah di atas — kemungkinan `goto` dari `$app/navigation`. Cek satu per satu, jangan menghapus yang masih dipakai.

- [ ] **Step 2: Ganti route jadi cangkang**

Ganti seluruh isi `frontend/src/routes/superadmin/cashiers/+page.svelte` dengan:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
  import CashierList from "$lib/components/cashiers/CashierList.svelte";

  let allowed = false;

  onMount(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const role = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;

    if (!token || role !== 'superadmin') {
      goto("/login");
      return;
    }
    allowed = true;
  });
</script>

<svelte:head>
  <title>Manajemen Kasir - Superadmin</title>
</svelte:head>

{#if allowed}
  <div class="p-4 sm:p-6 space-y-6">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Kasir</h2>

    <Tabs value="daftar">
      <TabsList>
        <TabsTrigger value="daftar">Daftar Kasir</TabsTrigger>
        <TabsTrigger value="jadwal">Jadwal Shift</TabsTrigger>
      </TabsList>

      <TabsContent value="daftar">
        <CashierList />
      </TabsContent>

      <TabsContent value="jadwal">
        <p class="text-muted-foreground py-8">Jadwal shift akan tampil di sini.</p>
      </TabsContent>
    </Tabs>
  </div>
{/if}
```

Jika padding luar (`p-4 sm:p-6`) jadi dobel karena `CashierList.svelte` sudah punya pembungkus sendiri, hapus pembungkus di dalam komponen, bukan di route.

- [ ] **Step 3: Verifikasi build dan typecheck**

Run: `cd frontend && npm run build && npm run check`
Expected: build exit 0. `svelte-check` melaporkan **0 error**. Jumlah warning harus tetap 5, semuanya di `cashier/pos/+page.svelte`. Warning baru berarti ada import yatim yang terlewat.

- [ ] **Step 4: Verifikasi di browser**

Nyalakan backend (`cd backend && npm run dev`) dan frontend (`cd frontend && npm run dev`). Login sebagai `superadmin` / `superadmin123`, buka Manajemen Kasir.

Expected: tab "Daftar Kasir" aktif dan menampilkan tabel kasir persis seperti sebelumnya. Tambah, edit, hapus, dan modal aktivitas semuanya masih jalan. Tab "Jadwal Shift" menampilkan teks placeholder.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/cashiers/CashierList.svelte frontend/src/routes/superadmin/cashiers/+page.svelte
git commit -m "refactor(cashiers): pecah halaman manajemen kasir jadi tab dan komponen"
```

---

### Task 6: Tab jadwal, tampilan dan hapus

**Files:**
- Create: `frontend/src/lib/components/cashiers/ShiftSchedule.svelte`
- Modify: `frontend/src/routes/superadmin/cashiers/+page.svelte` (ganti placeholder tab kedua)

**Interfaces:**
- Consumes: `GET /api/shifts` dan `DELETE /api/shifts/:id` dari Task 4. Bentuk objek shift: `{ id, day_of_week, start_time, end_time, label, is_active, cashiers: [{ id, username }] }`.
- Produces: `ShiftSchedule.svelte` tanpa prop. Task 7 menambah dialog ke file yang sama.

- [ ] **Step 1: Tulis komponen**

Buat `frontend/src/lib/components/cashiers/ShiftSchedule.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent } from "$lib/components/ui/card";
  import { useAlert } from "$lib/composables/useAlert";
  import { api } from "$lib/apiConfig";

  const { showAlertMessage } = useAlert();

  const DAYS = [
    { value: 1, label: "Senin" },
    { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" },
    { value: 4, label: "Kamis" },
    { value: 5, label: "Jumat" },
    { value: 6, label: "Sabtu" },
    { value: 7, label: "Minggu" }
  ];

  type Shift = {
    id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    label: string;
    cashiers: { id: number; username: string }[];
  };

  let shifts: Shift[] = [];
  let isLoading = true;

  $: byDay = DAYS.map((day) => ({
    ...day,
    shifts: shifts.filter((shift) => shift.day_of_week === day.value)
  }));

  function jam(value: string) {
    return String(value).slice(0, 5);
  }

  async function loadShifts() {
    isLoading = true;
    const result = await api.get<Shift[]>("/api/shifts");
    isLoading = false;

    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal memuat jadwal");
      return;
    }
    shifts = result.data || [];
  }

  async function hapusShift(shift: Shift) {
    if (!confirm(`Hapus ${shift.label} ${DAYS[shift.day_of_week - 1].label} ${jam(shift.start_time)}-${jam(shift.end_time)}?`)) {
      return;
    }

    const result = await api.delete(`/api/shifts/${shift.id}`);
    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal menghapus sesi");
      return;
    }
    showAlertMessage("success", "Sesi berhasil dihapus.");
    await loadShifts();
  }

  onMount(loadShifts);
</script>

<Card>
  <CardContent class="pt-6">
    {#if isLoading}
      <p class="text-muted-foreground py-8 text-center">Memuat jadwal shift...</p>
    {:else}
      <div class="space-y-6">
        {#each byDay as day}
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-2">{day.label}</h3>

            {#if day.shifts.length === 0}
              <p class="text-sm text-muted-foreground pl-1">Belum ada sesi.</p>
            {:else}
              <div class="space-y-2">
                {#each day.shifts as shift}
                  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                    <span class="font-medium text-sm w-20">{shift.label}</span>
                    <span class="text-sm text-muted-foreground w-28">
                      {jam(shift.start_time)} - {jam(shift.end_time)}
                    </span>
                    <span class="text-sm flex-1 min-w-[8rem]">
                      {shift.cashiers.map((c) => c.username).join(", ")}
                    </span>
                    <Button variant="outline" size="sm" on:click={() => hapusShift(shift)}>
                      Hapus
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
```

- [ ] **Step 2: Pasang di route**

Di `frontend/src/routes/superadmin/cashiers/+page.svelte`, tambahkan import:

```svelte
  import ShiftSchedule from "$lib/components/cashiers/ShiftSchedule.svelte";
```

lalu ganti isi `<TabsContent value="jadwal">` dari paragraf placeholder menjadi:

```svelte
        <ShiftSchedule />
```

- [ ] **Step 3: Verifikasi build**

Run: `cd frontend && npm run build && npm run check`
Expected: build exit 0, `svelte-check` 0 error, warning tetap 5.

- [ ] **Step 4: Verifikasi di browser**

Buka Manajemen Kasir, klik tab "Jadwal Shift".

Expected: tujuh hari terdaftar. Sesi yang dibuat lewat curl di Task 4 muncul di bawah Senin lengkap dengan nama kasirnya. Tombol Hapus menghilangkan sesi dan daftar langsung ter-refresh.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/cashiers/ShiftSchedule.svelte frontend/src/routes/superadmin/cashiers/+page.svelte
git commit -m "feat(shift): tampilkan jadwal mingguan di tab manajemen kasir"
```

---

### Task 7: Dialog tambah dan edit sesi

**Files:**
- Modify: `frontend/src/lib/components/cashiers/ShiftSchedule.svelte`

**Interfaces:**
- Consumes: `POST /api/shifts` dan `PUT /api/shifts/:id` dari Task 4. `GET /api/users/cashiers` (endpoint yang sudah ada, khusus superadmin, mengembalikan `{ id, username, role, ... }` hanya untuk role cashier) untuk daftar kasir. `loadShifts()` dari Task 6.
- Produces: tidak ada. Ini task terakhir untuk UI jadwal.

> Project ini tidak punya komponen Select. Halaman lain seperti `cashier/products/+page.svelte` memakai `<select>` HTML biasa dengan kelas Tailwind. Ikuti pola itu. Untuk memilih kasir, pakai daftar checkbox karena satu sesi bisa punya banyak kasir.

- [ ] **Step 1: Tambah import dan state**

Di blok `<script>` `ShiftSchedule.svelte`, tambahkan import berikut ke import yang sudah ada:

```ts
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
```

Lalu tambahkan state dan fungsi ini setelah deklarasi `isLoading`:

```ts
  type Cashier = { id: number; username: string };

  let cashiers: Cashier[] = [];
  let showDialog = false;
  let isSaving = false;
  let editingShift: Shift | null = null;

  let formDay = 1;
  let formLabel = "";
  let formStart = "08:00";
  let formEnd = "10:00";
  let formUserIds: number[] = [];

  async function loadCashiers() {
    const result = await api.get<Cashier[]>("/api/users/cashiers");
    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal memuat daftar kasir");
      return;
    }
    cashiers = result.data || [];
  }

  function bukaTambah(dayValue: number) {
    editingShift = null;
    formDay = dayValue;
    formLabel = "";
    formStart = "08:00";
    formEnd = "10:00";
    formUserIds = [];
    showDialog = true;
  }

  function bukaEdit(shift: Shift) {
    editingShift = shift;
    formDay = shift.day_of_week;
    formLabel = shift.label;
    formStart = jam(shift.start_time);
    formEnd = jam(shift.end_time);
    formUserIds = shift.cashiers.map((c) => c.id);
    showDialog = true;
  }

  function toggleKasir(id: number) {
    formUserIds = formUserIds.includes(id)
      ? formUserIds.filter((existing) => existing !== id)
      : [...formUserIds, id];
  }

  async function simpanShift() {
    isSaving = true;

    const payload = {
      day_of_week: formDay,
      start_time: `${formStart}:00`,
      end_time: `${formEnd}:00`,
      label: formLabel,
      user_ids: formUserIds
    };

    const result = editingShift
      ? await api.put(`/api/shifts/${editingShift.id}`, payload)
      : await api.post("/api/shifts", payload);

    isSaving = false;

    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal menyimpan sesi");
      return;
    }

    showAlertMessage("success", editingShift ? "Sesi berhasil diperbarui." : "Sesi baru berhasil ditambahkan.");
    showDialog = false;
    await loadShifts();
  }
```

Ubah baris `onMount(loadShifts);` menjadi:

```ts
  onMount(async () => {
    await Promise.all([loadShifts(), loadCashiers()]);
  });
```

- [ ] **Step 2: Tambah tombol Edit dan Tambah Sesi di markup**

Di dalam baris sesi, tambahkan tombol Edit tepat sebelum tombol Hapus:

```svelte
                    <Button variant="outline" size="sm" on:click={() => bukaEdit(shift)}>
                      Edit
                    </Button>
```

Lalu di dalam `{#each byDay as day}`, tepat setelah blok `{#if day.shifts.length === 0} ... {/if}`, tambahkan:

```svelte
            <Button variant="outline" size="sm" class="mt-2" on:click={() => bukaTambah(day.value)}>
              + Tambah Sesi
            </Button>
```

- [ ] **Step 3: Tambah dialog di akhir markup**

Setelah tag penutup `</Card>`, tambahkan:

```svelte
<Dialog open={showDialog} onOpenChange={(open) => { if (!open) showDialog = false; }}>
  <DialogContent class="sm:max-w-[480px]">
    <DialogHeader>
      <DialogTitle>{editingShift ? "Edit Sesi" : "Tambah Sesi"}</DialogTitle>
      <DialogDescription>
        Kasir yang dipilih hanya bisa login selama jam sesi ini, dengan toleransi 15 menit.
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-4 py-2">
      <div class="space-y-2">
        <Label for="shift-day">Hari</Label>
        <select
          id="shift-day"
          bind:value={formDay}
          class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {#each DAYS as day}
            <option value={day.value}>{day.label}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <Label for="shift-label">Label sesi</Label>
        <Input id="shift-label" bind:value={formLabel} placeholder="Sesi 1" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <Label for="shift-start">Jam mulai</Label>
          <Input id="shift-start" type="time" bind:value={formStart} />
        </div>
        <div class="space-y-2">
          <Label for="shift-end">Jam selesai</Label>
          <Input id="shift-end" type="time" bind:value={formEnd} />
        </div>
      </div>

      <div class="space-y-2">
        <Label>Kasir yang jaga</Label>
        {#if cashiers.length === 0}
          <p class="text-sm text-muted-foreground">Belum ada kasir terdaftar.</p>
        {:else}
          <div class="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
            {#each cashiers as cashier}
              <label class="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formUserIds.includes(cashier.id)}
                  on:change={() => toggleKasir(cashier.id)}
                />
                {cashier.username}
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" on:click={() => (showDialog = false)} disabled={isSaving}>
        Batal
      </Button>
      <Button on:click={simpanShift} disabled={isSaving}>
        {isSaving ? "Menyimpan..." : "Simpan"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Verifikasi build**

Run: `cd frontend && npm run build && npm run check`
Expected: build exit 0, `svelte-check` 0 error, warning tetap 5.

- [ ] **Step 5: Verifikasi di browser**

Buat jadwal persis seperti contoh yang diminta: Senin "Sesi 1" 08:00-10:00 dengan dua kasir, lalu Senin "Sesi 2" 10:00-12:00 dengan dua kasir berbeda.

Expected:
- Kedua sesi tersimpan dan muncul di bawah Senin dengan nama kasir yang benar.
- Edit sesi 1 lalu simpan: perubahan tersimpan, daftar ter-refresh.
- Coba buat sesi Senin 09:00-11:00: ditolak dengan pesan "Jam sesi bertabrakan dengan sesi lain di hari yang sama."
- Coba simpan dengan jam selesai lebih kecil dari jam mulai: ditolak dengan pesan "Jam selesai harus lebih besar dari jam mulai."
- Coba simpan tanpa mencentang kasir: ditolak dengan pesan "Pilih minimal satu kasir."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/components/cashiers/ShiftSchedule.svelte
git commit -m "feat(shift): tambah dialog tambah dan edit sesi shift"
```

---

### Task 8: Frontend menangani OUT_OF_SHIFT

Dikerjakan **sebelum** penegakan dinyalakan, supaya begitu backend mulai menolak, kasir langsung melihat pesan yang benar dan bukan layar diam.

**Files:**
- Modify: `frontend/src/lib/errorHandler.ts` (cabang `case 403` di sekitar baris 65)
- Modify: `frontend/src/lib/apiConfig.ts` (blok penanganan error di dalam `apiRequest`)

**Interfaces:**
- Consumes: bentuk body error dari backend `{ code: 'OUT_OF_SHIFT', message, nextShift }` yang akan dikirim Task 9 dan 10.
- Produces: tidak ada.

> `handleApiError` saat ini membuang `details` untuk 403 dan hanya menyimpannya untuk 422. Tanpa perubahan ini, `apiConfig.ts` tidak punya cara membedakan "di luar jadwal" dari "bukan role kamu".

- [ ] **Step 1: Teruskan `details` pada error 403**

Di `frontend/src/lib/errorHandler.ts`, ganti cabang `case 403`:

```ts
      case 403:
        return {
          message: error.message || ERROR_MESSAGES.FORBIDDEN,
          status: 403,
          code: ERROR_TYPES.FORBIDDEN
        };
```

menjadi:

```ts
      case 403:
        return {
          message: error.message || ERROR_MESSAGES.FORBIDDEN,
          status: 403,
          code: ERROR_TYPES.FORBIDDEN,
          details: error.details
        };
```

- [ ] **Step 2: Lempar kasir keluar saat OUT_OF_SHIFT**

Di `frontend/src/lib/apiConfig.ts`, di dalam blok `catch` `apiRequest`, ganti:

```ts
    if (apiError.code === 'AUTH_ERROR' && browser) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user_role');
      localStorage.removeItem('pos_user_id');
      window.location.href = '/login';
    }
```

menjadi:

```ts
    const outOfShift = apiError.status === 403 && apiError.details?.code === 'OUT_OF_SHIFT';

    if ((apiError.code === 'AUTH_ERROR' || outOfShift) && browser) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user_role');
      localStorage.removeItem('pos_user_id');
      if (outOfShift) {
        sessionStorage.setItem('pos_logout_reason', apiError.message);
      }
      window.location.href = '/login';
    }
```

- [ ] **Step 3: Tampilkan alasannya di halaman login**

Di `frontend/src/routes/login/+page.svelte`, di dalam `onMount`, tepat setelah baris `if (!browser) return;`, tambahkan:

```ts
    const reason = sessionStorage.getItem('pos_logout_reason');
    if (reason) {
      errorMessage = reason;
      sessionStorage.removeItem('pos_logout_reason');
    }
```

- [ ] **Step 4: Verifikasi build**

Run: `cd frontend && npm run build && npm run check`
Expected: build exit 0, `svelte-check` 0 error, warning tetap 5.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/errorHandler.ts frontend/src/lib/apiConfig.ts frontend/src/routes/login/+page.svelte
git commit -m "feat(shift): tangani penolakan OUT_OF_SHIFT di frontend"
```

---

### Task 9: Penegakan saat login

**Files:**
- Modify: `backend/routes/auth.js` (handler `POST /login`, sekitar baris 9-65)

**Interfaces:**
- Consumes: `isOnShift`, `outOfShiftMessage` dari `backend/utils/shiftAccess.js` (Task 3).
- Produces: respons 403 `{ code: 'OUT_OF_SHIFT', message, nextShift }` yang sudah ditangani Task 8.

> Pengecekan jadwal dilakukan **setelah** password diverifikasi. Kalau dibalik, penyerang bisa memakai beda respons untuk menebak username mana yang valid.

- [ ] **Step 1: Tambah import**

Di `backend/routes/auth.js`, tambahkan setelah baris `const { authenticateToken } = require("../middleware/authMiddleware");`:

```js
const { isOnShift, outOfShiftMessage } = require("../utils/shiftAccess");
```

- [ ] **Step 2: Sisipkan pengecekan**

Tepat setelah blok pengecekan `isMatch` (blok yang berakhir dengan `return res.status(401).json({ message: "Invalid credentials" });`) dan sebelum `await connection.query("UPDATE users SET last_login = ...`, sisipkan:

```js
    const shiftStatus = await isOnShift(user.id, user.role);
    if (!shiftStatus.allowed) {
      connection.release();
      return res.status(403).json({
        code: "OUT_OF_SHIFT",
        message: outOfShiftMessage(shiftStatus.nextShift),
        nextShift: shiftStatus.nextShift
      });
    }
```

- [ ] **Step 3: Verifikasi kasir di luar jadwal ditolak**

Pastikan backend jalan. Hapus dulu semua jadwal `kasir1` lewat UI, lalu:

```bash
curl -s -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kasir1","password":"kasir123"}'
```

Expected: `{"code":"OUT_OF_SHIFT","message":"Anda belum punya jadwal shift. Hubungi superadmin.","nextShift":null}` dengan status 403.

- [ ] **Step 4: Verifikasi superadmin tidak terpengaruh**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"superadmin123"}'
```

Expected: `200`

- [ ] **Step 5: Verifikasi kasir di dalam jadwal bisa masuk**

Lewat UI superadmin, buat sesi untuk `kasir1` di hari ini dengan jam yang mencakup waktu sekarang. Lalu ulangi curl di Step 3.

Expected: status 200 dan body berisi `token`.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat(shift): tolak login kasir di luar jadwal"
```

---

### Task 10: Penegakan per request

**Files:**
- Modify: `backend/middleware/authMiddleware.js` (fungsi `authenticateToken`)

**Interfaces:**
- Consumes: `isOnShift`, `outOfShiftMessage` dari `backend/utils/shiftAccess.js` (Task 3).
- Produces: respons 403 `{ code: 'OUT_OF_SHIFT', message, nextShift }` pada setiap endpoint yang memakai `authenticateToken`.

> `authenticateToken` sekarang sinkron dan memakai callback `jwt.verify`. Perlu diubah jadi `async` supaya bisa `await isOnShift`. Semua route memakainya sebagai middleware Express biasa, jadi mengubahnya jadi async aman — Express 4 mengabaikan nilai kembalian middleware.

- [ ] **Step 1: Tulis ulang middleware**

Ganti seluruh isi `backend/middleware/authMiddleware.js` dengan:

```js
const jwt = require("jsonwebtoken");
const { isOnShift, outOfShiftMessage } = require("../utils/shiftAccess");
require("dotenv").config();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.sendStatus(403);
  }

  try {
    const shiftStatus = await isOnShift(user.id, user.role);
    if (!shiftStatus.allowed) {
      return res.status(403).json({
        code: "OUT_OF_SHIFT",
        message: outOfShiftMessage(shiftStatus.nextShift),
        nextShift: shiftStatus.nextShift
      });
    }
  } catch (error) {
    console.error("Shift check error:", error);
    return res.status(500).json({ message: "Server error checking shift" });
  }

  req.user = user;
  next();
};

function authorizeRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
```

- [ ] **Step 2: Verifikasi superadmin masih normal**

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"superadmin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/products -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/shifts -H "Authorization: Bearer $TOKEN"
```

Expected: `200` dua kali.

- [ ] **Step 3: Verifikasi token kasir mati setelah jadwalnya dicabut**

Dengan jadwal `kasir1` masih aktif, ambil tokennya:

```bash
KTOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kasir1","password":"kasir123"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

curl -s -o /dev/null -w "sebelum dicabut: %{http_code}\n" http://localhost:3002/api/products -H "Authorization: Bearer $KTOKEN"
```

Expected: `sebelum dicabut: 200`

Lalu hapus jadwal `kasir1` lewat UI superadmin, dan ulangi request yang sama dengan token yang **sama**:

```bash
curl -s -w "\nsetelah dicabut: %{http_code}\n" http://localhost:3002/api/products -H "Authorization: Bearer $KTOKEN"
```

Expected: body `{"code":"OUT_OF_SHIFT",...}` dan `setelah dicabut: 403`. Ini membuktikan token lama tidak lagi berlaku begitu jadwal berakhir.

- [ ] **Step 4: Verifikasi alur lengkap di browser**

Buat jadwal `kasir1` yang mencakup waktu sekarang. Login sebagai `kasir1` di jendela browser terpisah, buka halaman POS. Di jendela superadmin, hapus jadwal itu. Kembali ke jendela kasir dan lakukan aksi apa pun yang memanggil API.

Expected: kasir dilempar ke halaman login, dan halaman login menampilkan "Anda belum punya jadwal shift. Hubungi superadmin."

- [ ] **Step 5: Jalankan seluruh gerbang mutu**

Run:

```bash
cd backend && npm test
cd ../frontend && npm run build && npm run check
```

Expected: backend 10 test lulus 0 gagal. Frontend build exit 0, `svelte-check` 0 error dan 5 warning, semuanya di `cashier/pos/+page.svelte`.

- [ ] **Step 6: Commit**

```bash
git add backend/middleware/authMiddleware.js
git commit -m "feat(shift): tolak request kasir di luar jadwal"
```

---

## Setelah selesai

Isi jadwal asli untuk semua kasir sebelum dipakai di toko. Fail-closed berarti kasir tanpa jadwal tidak bisa masuk sama sekali.

Utang yang sengaja ditinggalkan, tercatat di spec dan tidak dikerjakan di sini:

- `utils/dailyStockScheduler.js` memakai tanggal UTC padahal mengaku berjalan 18:00 WIB.
- Tidak ada override jadwal per tanggal untuk tukar shift dadakan.
- Shift lintas tengah malam tidak didukung.
- Kasir yang keranjangnya belum disimpan saat shift berakhir kehilangan keranjang itu.
