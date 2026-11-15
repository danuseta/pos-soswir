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
