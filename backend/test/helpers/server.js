const { spawn } = require("child_process");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, query } = require("../../models/db");

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

function parse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function call(method, url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: parse(text) };
}

async function startTestServer() {
  const hash = await bcrypt.hash("rahasia123", 4);
  await query("INSERT INTO users (username, password, role) VALUES ('superadmin', $1, 'superadmin')", [hash]);

  const child = spawn(process.execPath, ["index.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, DB_NAME: "pos_test", PORT: String(PORT), NODE_ENV: "test" },
    stdio: ["ignore", "ignore", "inherit"]
  });

  let ready = false;
  for (let i = 0; i < 60 && !ready; i += 1) {
    try {
      ready = (await fetch(BASE + "/")).ok;
    } catch {}
    if (!ready) await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) {
    child.kill();
    throw new Error("Test server tidak siap dalam 15 detik");
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
    async stop() {
      await new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill();
      });
      await pool.end();
    }
  };
}

module.exports = { startTestServer, BASE };
