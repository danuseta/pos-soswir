const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const bcrypt = require("bcryptjs");
const { Pool, Client } = require("pg");
const { adminConfig, recreateDatabase, applySchema } = require("../../db/setup");
const scenarios = require("./scenarios");

const DB_NAME = "pos_scenario";
const BACKEND_DIR = path.join(__dirname, "..", "..");
const FRONTEND_DIR = path.join(BACKEND_DIR, "..", "frontend");
const FIXTURE_DIR = path.join(BACKEND_DIR, "scripts", "fixtures", "images");
const UPLOAD_DIR = path.join(BACKEND_DIR, "uploads", "products");
const BACKEND_URL = "http://localhost:3003";
const FRONTEND_URL = "http://localhost:5174";
const IMAGE_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const args = process.argv.slice(2);
const noScreens = args.includes("--no-screens");
const keepDb = args.includes("--keep-db");
const forceFail = new Set(
  (process.env.SCENARIO_FORCE_FAIL || "").split(",").map((id) => id.trim()).filter(Boolean)
);

const passwordOf = (username) => (username === "superadmin" ? "superadmin123" : "kasir123");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wibNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}:${get("second")}`,
    stamp: `${get("year")}-${get("month")}-${get("day")}_${hour}${get("minute")}`,
    minutes: Number(hour) * 60 + Number(get("minute"))
  };
}

const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function shiftWindows(nowMinutes) {
  let start = Math.max(0, nowMinutes - 60);
  let end = Math.min(23 * 60 + 59, nowMinutes + 60);
  if (end <= start) {
    start = Math.max(0, Math.min(nowMinutes - 30, 23 * 60 - 1));
    end = start + 60;
  }
  const outside = nowMinutes >= 12 * 60 ? ["02:00", "03:00"] : ["20:00", "21:00"];
  return { inside: [hhmm(start), hhmm(end)], outside };
}

function parse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function request(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const started = performance.now();
  const res = await fetch(BACKEND_URL + url, { method, headers, body: payload });
  const text = await res.text();
  return { status: res.status, body: parse(text), ms: Math.round(performance.now() - started), headers: res.headers };
}

function trimForEvidence(value, depth = 0) {
  if (Array.isArray(value)) {
    const head = value.slice(0, 5).map((item) => trimForEvidence(item, depth + 1));
    return value.length > 5 ? [...head, `... ${value.length - 5} baris lagi`] : head;
  }
  if (value && typeof value === "object") {
    if (depth > 4) return "[objek]";
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = key === "token" && typeof item === "string" ? `${item.slice(0, 12)}...` : trimForEvidence(item, depth + 1);
    }
    return out;
  }
  return value;
}

const sessions = new Map();

async function login(username) {
  if (sessions.has(username)) return sessions.get(username);
  const res = await request("POST", "/api/auth/login", { body: { username, password: passwordOf(username) } });
  if (res.status !== 200) throw new Error(`Login ${username} gagal: ${res.status} ${JSON.stringify(res.body)}`);
  const session = { token: res.body.token, user: res.body.user };
  sessions.set(username, session);
  return session;
}

async function must(method, url, username, body) {
  const { token } = await login(username);
  const res = await request(method, url, { token, body });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Seed gagal ${method} ${url}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function uploadImage(username, filePath) {
  const { token } = await login(username);
  const form = new FormData();
  const type = IMAGE_TYPES[path.extname(filePath).toLowerCase()];
  form.append("image", new Blob([fs.readFileSync(filePath)], { type }), path.basename(filePath));
  return request("POST", "/api/products/upload-image", { token, form });
}

const SHOP_PRODUCTS = [
  ["Nasi Goreng", "Makanan", 15000, 10],
  ["Mie Ayam", "Makanan", 12000, 20],
  ["Es Teh", "Minuman", 5000, 30],
  ["Kopi Susu", "Minuman", 8000, 15],
  ["Roti Bakar", "Makanan", 10000, 3],
  ["Bakwan", "Makanan", 2000, 10],
  ["Soto Ayam", "Makanan", 18000, 10],
  ["Pisang Goreng", "Makanan", 3000, 10],
  ["Martabak", "Makanan", 25000, 1],
  ["Air Mineral", "Minuman", 4000, 5],
  ["Gorengan Lama", "Makanan", 1000, 10],
  ["Kerupuk", "Makanan", 1000, 10],
  ["Bubur Ayam", "Makanan", 10000, 10]
];

const PUBJ_PRODUCTS = [
  ["Kue Lapis", 5000],
  ["Risoles", 4000],
  ["Lemper", 6000],
  ["Onde-onde", 3000],
  ["Pastel", 4000]
];

async function seed(pool) {
  const hash = await bcrypt.hash(passwordOf("superadmin"), 10);
  await pool.query("INSERT INTO users (username, password, role) VALUES ('superadmin', $1, 'superadmin')", [hash]);

  const windows = shiftWindows(wibNow().minutes);
  const shiftA = await must("POST", "/api/shifts", "superadmin", { label: "Shift A", start_time: windows.inside[0], end_time: windows.inside[1] });
  const shiftB = await must("POST", "/api/shifts", "superadmin", { label: "Shift B", start_time: windows.outside[0], end_time: windows.outside[1] });

  const users = {};
  for (const [username, shiftId] of [["kasir1", shiftA.id], ["kasir2", shiftA.id], ["kasir_luar", shiftB.id]]) {
    const created = await must("POST", "/api/users/cashiers", "superadmin", { username, password: passwordOf(username) });
    await must("PUT", `/api/shifts/assign/${created.id}`, "superadmin", { shift_id: shiftId });
    users[username] = created.id;
  }

  const categories = {};
  for (const [name, isReseller] of [["Makanan", false], ["Minuman", false], ["PUBJ", true]]) {
    categories[name] = (await must("POST", "/api/categories", "superadmin", { name, is_reseller: isReseller })).id;
  }
  const supplierId = (await must("POST", "/api/suppliers", "superadmin", { name: "Bu Ani", phone: "081234567890" })).id;

  const imageFiles = fs.readdirSync(FIXTURE_DIR)
    .filter((file) => IMAGE_TYPES[path.extname(file).toLowerCase()])
    .sort()
    .map((file) => path.join(FIXTURE_DIR, file));
  const products = [
    ...SHOP_PRODUCTS.map(([name, category, price, stock]) => ({ name, price, stock, category_id: categories[category] })),
    ...PUBJ_PRODUCTS.map(([name, price]) => ({
      name, price, stock: 0, category_id: categories.PUBJ, supplier_id: supplierId, tax_percentage: 10
    }))
  ];
  const images = [];
  for (const [index, product] of products.entries()) {
    const file = imageFiles[index % imageFiles.length];
    const res = await uploadImage("superadmin", file);
    if (res.status !== 200) throw new Error(`Seed gagal upload ${path.basename(file)}: ${res.status} ${JSON.stringify(res.body)}`);
    const image = res.body;
    images.push(image);
    await must("POST", "/api/products", "superadmin", { ...product, image_url: image.imageUrl, image_filename: image.imageFilename });
  }

  return {
    shifts: { A: { id: shiftA.id, window: windows.inside }, B: { id: shiftB.id, window: windows.outside } },
    users,
    categories,
    supplierId,
    imageFiles,
    images
  };
}

function makeCtx(record, pool, fixture) {
  const calls = [];
  const checks = [];
  let explicitEvidence = null;

  const track = (requestInfo, res) => {
    calls.push({ request: requestInfo, response: { status: res.status, ms: res.ms, body: trimForEvidence(res.body) } });
    return res;
  };

  const as = (username) => {
    const call = async (method, url, body) => {
      const { token } = await login(username);
      const res = await request(method, url, { token, body });
      return track({ as: username, method, url, body }, res);
    };
    return {
      get: (url) => call("GET", url),
      post: (url, body) => call("POST", url, body),
      put: (url, body) => call("PUT", url, body),
      patch: (url, body) => call("PATCH", url, body),
      del: (url, body) => call("DELETE", url, body),
      upload: async (url, filePath) => {
        const res = await uploadImage(username, filePath);
        return track({ as: username, method: "POST", url, file: path.basename(filePath) }, res);
      }
    };
  };

  const ctx = {
    fixture,
    backendUrl: BACKEND_URL,
    as,
    async login(username, password = passwordOf(username)) {
      const res = await request("POST", "/api/auth/login", { body: { username, password } });
      return track({ method: "POST", url: "/api/auth/login", body: { username, password: "***" } }, res);
    },
    async fetchRaw(url) {
      const started = performance.now();
      const res = await fetch(BACKEND_URL + url);
      const bytes = (await res.arrayBuffer()).byteLength;
      const out = { status: res.status, contentType: res.headers.get("content-type"), bytes, ms: Math.round(performance.now() - started) };
      calls.push({ request: { method: "GET", url }, response: out });
      return out;
    },
    async product(name) {
      const { token } = await login("superadmin");
      const res = await request("GET", "/api/products", { token });
      const found = Array.isArray(res.body) ? res.body.find((p) => p.name === name) : null;
      if (!found) throw new Error(`Produk "${name}" tidak ditemukan`);
      return found;
    },
    async sql(text, params) {
      return (await pool.query(text, params)).rows;
    },
    wibNow,
    actual(text) {
      record.actual = text;
    },
    expect(condition, note) {
      checks.push({ ok: Boolean(condition), note });
    },
    evidence(obj) {
      explicitEvidence = obj;
    }
  };

  const finish = () => ({
    checks,
    evidence: explicitEvidence ? trimForEvidence(explicitEvidence) : (calls[calls.length - 1] || {})
  });

  return { ctx, finish };
}

async function runScenario(scenario, pool, fixture) {
  const record = {
    id: scenario.id,
    group: scenario.group,
    title: scenario.title,
    steps: scenario.steps,
    expected: scenario.expected,
    actual: "",
    status: "error",
    screen: scenario.screen || null,
    screenshot: null,
    evidence: {}
  };
  const { ctx, finish } = makeCtx(record, pool, fixture);

  try {
    await scenario.run(ctx);
    const { checks } = finish();
    let ok = checks.length > 0 && checks.every((check) => check.ok);
    const failedNotes = checks.filter((check) => !check.ok && check.note).map((check) => check.note);
    if (checks.length === 0) failedNotes.push("skenario tidak memanggil expect");
    if (!ok && failedNotes.length > 0) record.actual += ` | Gagal: ${failedNotes.join("; ")}`;
    if (forceFail.has(scenario.id)) {
      ok = !ok;
      record.actual += " | Hasil expect dibalik paksa lewat SCENARIO_FORCE_FAIL";
    }
    record.status = ok ? "pass" : "fail";
  } catch (error) {
    record.status = "error";
    record.actual = `${record.actual ? `${record.actual} | ` : ""}Error: ${error.message}`;
  }
  record.evidence = finish().evidence;
  return record;
}

async function waitFor(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).status === 200) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`${label} tidak siap dalam ${timeoutMs / 1000} detik (${url})`);
}

async function assertPortFree(url) {
  try {
    await fetch(url);
  } catch {
    return;
  }
  throw new Error(`${url} sudah dipakai proses lain. Matikan dulu sebelum menjalankan skenario.`);
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
  } else {
    child.kill();
  }
}

async function dropDatabase() {
  const client = new Client(adminConfig("postgres"));
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

function printSummary(results) {
  console.log("\nHasil skenario:");
  for (const s of results.scenarios) {
    console.log(`${s.status.toUpperCase().padEnd(5)} ${s.id} ${s.title}`);
    if (s.status !== "pass") console.log(`      aktual: ${s.actual}`);
  }
  const count = (status) => results.scenarios.filter((s) => s.status === status).length;
  console.log(`\nTotal ${results.scenarios.length}: ${count("pass")} PASS, ${count("fail")} FAIL, ${count("error")} ERROR`);
}

async function main() {
  const started = wibNow();
  const outDir = path.join(BACKEND_DIR, "reports", started.stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const uploadsBefore = new Set(fs.readdirSync(UPLOAD_DIR));

  let backend = null;
  let frontend = null;
  let pool = null;

  try {
    await assertPortFree(BACKEND_URL);
    await recreateDatabase(DB_NAME);
    await applySchema(DB_NAME);
    pool = new Pool({ ...adminConfig(DB_NAME), max: 2, options: "-c timezone=Asia/Jakarta" });

    const backendLog = fs.openSync(path.join(outDir, "backend.log"), "w");
    backend = spawn(process.execPath, ["index.js"], {
      cwd: BACKEND_DIR,
      env: { ...process.env, DB_NAME, PORT: "3003", NODE_ENV: "development" },
      stdio: ["ignore", backendLog, backendLog]
    });
    await waitFor(`${BACKEND_URL}/health`, 30000, "Backend");

    if (!noScreens) {
      await assertPortFree(FRONTEND_URL);
      const frontendLog = fs.openSync(path.join(outDir, "frontend.log"), "w");
      frontend = spawn("npm", ["run", "dev", "--", "--port", "5174", "--strictPort"], {
        cwd: FRONTEND_DIR,
        env: { ...process.env, VITE_BACKEND_URL: BACKEND_URL },
        stdio: ["ignore", frontendLog, frontendLog],
        shell: process.platform === "win32"
      });
      await waitFor(`${FRONTEND_URL}/`, 60000, "Frontend");
    }

    const fixture = await seed(pool);
    const [{ server_version: postgres }] = (await pool.query("SELECT current_setting('server_version') AS server_version")).rows;

    const results = {
      startedAt: `${started.date}T${started.time}+07:00`,
      env: { node: process.version, postgres, backend: BACKEND_URL, frontend: noScreens ? null : FRONTEND_URL },
      directWrites: [
        "Seed: INSERT INTO users (superadmin) karena belum ada endpoint pembuatan superadmin.",
        "S20: UPDATE sales dan transaction_logs created_at ke 00:30 WIB hari ini untuk menguji batas tanggal."
      ],
      fixture: { shifts: fixture.shifts, forceFail: [...forceFail] },
      scenarios: []
    };

    for (const scenario of scenarios) {
      const record = await runScenario(scenario, pool, fixture);
      results.scenarios.push(record);
      console.log(`${record.status.toUpperCase().padEnd(5)} ${record.id} ${record.title}`);
    }

    const resultsPath = path.join(outDir, "results.json");
    let reportPaths = null;
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    if (!noScreens) {
      const { captureScreens } = require("./screens");
      await captureScreens({
        results,
        outDir,
        frontendUrl: FRONTEND_URL,
        passwordOf,
        loginAs: async (username) => {
          const session = await login(username);
          return { token: session.token, role: session.user.role, id: session.user.id, username };
        }
      });
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      const { buildReport } = require("./report");
      reportPaths = await buildReport({ resultsPath, outDir });
    }

    printSummary(results);
    console.log(`\nresults.json: ${resultsPath}`);
    if (reportPaths) console.log(`Laporan HTML: ${reportPaths.report}\nSalinan terbaru: ${reportPaths.latest}`);
    if (results.scenarios.some((s) => s.status !== "pass")) process.exitCode = 1;
  } finally {
    const cleanup = async (name, fn) => {
      try {
        await fn();
      } catch (error) {
        console.error(`Cleanup "${name}" gagal:`, error);
      }
    };
    await cleanup("frontend", () => killTree(frontend));
    await cleanup("backend", () => killTree(backend));
    if (pool) await cleanup("pool.end", () => pool.end());
    if (!keepDb) {
      await cleanup("drop database", () => dropDatabase());
      await cleanup("uploads", () => {
        for (const file of fs.readdirSync(UPLOAD_DIR)) {
          if (!uploadsBefore.has(file)) fs.rmSync(path.join(UPLOAD_DIR, file), { force: true });
        }
      });
    }
  }
}

main().catch((error) => {
  console.error("Runner skenario gagal:", error);
  process.exitCode = 1;
});
