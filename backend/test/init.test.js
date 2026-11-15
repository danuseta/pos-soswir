const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { execFileSync } = require("child_process");
const bcrypt = require("bcryptjs");
const { resetTestDb, TEST_DB } = require("./helpers/testDb");
const { query, pool } = require("../models/db");

const INIT = path.join(__dirname, "..", "db", "init.js");

function runInit(password) {
  const env = { ...process.env, DB_NAME: TEST_DB, INIT_SUPERADMIN_PASSWORD: password };
  return execFileSync(process.execPath, [INIT], { env, encoding: "utf8" });
}

async function superadminHash() {
  const [row] = await query("SELECT password FROM users WHERE username = 'superadmin'");
  return row.password;
}

test.after(() => pool.end());

test("init memakai INIT_SUPERADMIN_PASSWORD bila diisi", async () => {
  await resetTestDb();
  const output = runInit("rahasia-dari-env");
  assert.ok(await bcrypt.compare("rahasia-dari-env", await superadminHash()));
  assert.doesNotMatch(output, /rahasia-dari-env/);
});

test("init tanpa env membuat password acak 16 karakter dan mencetaknya sekali", async () => {
  await resetTestDb();
  const output = runInit("");
  const match = output.match(/password: (\S{16})\b/);
  assert.ok(match, output);
  const hash = await superadminHash();
  assert.ok(await bcrypt.compare(match[1], hash));
  assert.strictEqual(await bcrypt.compare("superadminpassword", hash), false);
  assert.strictEqual(runInit("").includes(match[1]), false);
});
