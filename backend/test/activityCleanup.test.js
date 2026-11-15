const test = require("node:test");
const assert = require("node:assert");
const { resetTestDb } = require("./helpers/testDb");
const { startTestServer } = require("./helpers/server");
const { query } = require("../models/db");

let server;
let token;
test.before(async () => {
  await resetTestDb();
  server = await startTestServer();
  token = await server.login("superadmin", "rahasia123");
});
test.after(() => server.stop());

test("cleanup manual menghapus aktivitas lebih tua dari retensi", async () => {
  await query("DELETE FROM user_activities");
  const [u] = await query("SELECT id FROM users LIMIT 1");
  await query(
    `INSERT INTO user_activities (user_id, activity_type, created_at)
     VALUES ($1, 'login', now() - interval '10 days'), ($1, 'login', now())`,
    [u.id]
  );
  const res = await server.post("/api/activity-cleanup/manual", {}, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.deletedActivities, 1);
  const rows = await query("SELECT COUNT(*) AS n FROM user_activities");
  assert.strictEqual(rows[0].n, 1);
});

test("status tidak error tanpa information_schema.EVENTS", async () => {
  const res = await server.get("/api/activity-cleanup/status", token);
  assert.strictEqual(res.status, 200);
  const d = res.body.data;
  assert.strictEqual(typeof d.totalActivities, "number");
  assert.strictEqual(typeof d.oldActivities, "number");
  assert.strictEqual(typeof d.nextCleanup, "string");
  assert.strictEqual(d.cleanupInterval, "1 DAY");
  assert.strictEqual(typeof d.eventSchedulerStatus, "string");
  assert.strictEqual(typeof d.isAutoCleanupActive, "boolean");
  assert.strictEqual(typeof d.retentionDays, "number");
});

test("logs dan test dan retention-options berbentuk sama", async () => {
  const logs = await server.get("/api/activity-cleanup/logs", token);
  assert.strictEqual(logs.status, 200);
  assert.ok(Array.isArray(logs.body.data.dailyActivities));
  assert.strictEqual(typeof logs.body.data.statistics.total_activities, "number");

  const t = await server.post("/api/activity-cleanup/test", {}, token);
  assert.strictEqual(t.status, 200);
  assert.strictEqual(typeof t.body.data.wouldDelete, "number");
  assert.strictEqual(typeof t.body.data.retentionDays, "number");
  assert.ok(Array.isArray(t.body.data.examples));

  const o = await server.get("/api/activity-cleanup/retention-options", token);
  assert.strictEqual(o.status, 200);
  assert.ok(Array.isArray(o.body.data.retentionDays));
  assert.ok(Array.isArray(o.body.data.intervals));
});

test("update-retention menolak nilai tidak valid", async () => {
  for (const retentionDays of [0, 400, "abc"]) {
    const res = await server.post(
      "/api/activity-cleanup/update-retention",
      { retentionDays, cleanupInterval: 1, intervalUnit: "DAY" },
      token
    );
    assert.strictEqual(res.status, 400, `retentionDays=${retentionDays}`);
  }
});

test("update-retention nilai valid tersimpan di store_settings", async () => {
  const res = await server.post(
    "/api/activity-cleanup/update-retention",
    { retentionDays: 7, cleanupInterval: 1, intervalUnit: "DAY" },
    token
  );
  assert.strictEqual(res.status, 200);
  const rows = await query("SELECT setting_value FROM store_settings WHERE setting_key = 'activity_retention_days'");
  assert.strictEqual(rows[0].setting_value, "7");
});

test("batch size dan retensi env tidak valid jatuh ke default", () => {
  const { ActivityCleanup } = require("../utils/activityCleanup");
  const old = { b: process.env.CLEANUP_BATCH_SIZE, r: process.env.ACTIVITY_RETENTION_DAYS };
  try {
    for (const bad of ["0", "-5", "abc"]) {
      process.env.CLEANUP_BATCH_SIZE = bad;
      process.env.ACTIVITY_RETENTION_DAYS = bad;
      const c = new ActivityCleanup();
      assert.strictEqual(c.batchSize, 1000, `batch=${bad}`);
      assert.strictEqual(c.retentionDays, 3, `retention=${bad}`);
    }
  } finally {
    for (const [k, v] of [["CLEANUP_BATCH_SIZE", old.b], ["ACTIVITY_RETENTION_DAYS", old.r]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
