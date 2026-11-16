// Membuat ulang semua screenshot panduan dari database demo terisolasi.
// Jalankan dari root repo: node docs/panduan-penggunaan/capture/capture.mjs
// Opsi: --keep (DB demo dan proses tidak dibersihkan, untuk debug).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC_DIR = path.join(HERE, "..");
const IMG_DIR = path.join(DOC_DIR, "img");
const REPO = path.join(DOC_DIR, "..", "..");
const BACKEND_DIR = path.join(REPO, "backend");
const FRONTEND_DIR = path.join(REPO, "frontend");
const UPLOAD_DIR = path.join(BACKEND_DIR, "uploads", "products");

const require = createRequire(path.join(BACKEND_DIR, "package.json"));
const { chromium } = require("playwright");
const bcrypt = require("bcryptjs");
const { Pool, Client } = require("pg");
const { adminConfig, recreateDatabase, applySchema } = require("./db/setup");

const DB_NAME = "pos_manual_scenario";
const BACKEND_URL = "http://localhost:3005";
const FRONTEND_URL = "http://localhost:5175";
const KEEP = process.argv.includes("--keep");

const PASSWORD = { superadmin: "superadmin123" };
const passwordOf = (username) => PASSWORD[username] || "kasir123";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- waktu WIB ----------

function wibMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return (get("hour") % 24) * 60 + get("minute");
}

function wibDate(daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function shiftWindows(now) {
  const start = Math.max(0, Math.floor(now / 60) * 60 - 180);
  const end = Math.min(23 * 60 + 59, start + 420);
  const outside = now >= 12 * 60 ? ["05:00", "08:00"] : ["19:00", "22:00"];
  return { inside: [hhmm(start), hhmm(end)], outside };
}

// ---------- HTTP ----------

async function request(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BACKEND_URL + url, { method, headers, body: payload });
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, body: parsed };
}

const sessions = new Map();
async function login(username) {
  if (sessions.has(username)) return sessions.get(username);
  const res = await request("POST", "/api/auth/login", { body: { username, password: passwordOf(username) } });
  if (res.status !== 200) throw new Error(`Login ${username} gagal: ${res.status} ${JSON.stringify(res.body)}`);
  const s = { token: res.body.token, role: res.body.user.role, id: res.body.user.id, username };
  sessions.set(username, s);
  return s;
}

async function api(username, method, url, body) {
  const { token } = await login(username);
  const res = await request(method, url, { token, body });
  if (res.status < 200 || res.status >= 300) throw new Error(`${method} ${url} gagal: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function uploadImage(file) {
  const { token } = await login("superadmin");
  const form = new FormData();
  form.append("image", new Blob([fs.readFileSync(file)], { type: "image/png" }), path.basename(file));
  const res = await request("POST", "/api/products/upload-image", { token, form });
  if (res.status !== 200) throw new Error(`Upload gambar gagal: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

// ---------- proses ----------

async function waitFor(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await sleep(500);
  }
  throw new Error(`${label} tidak siap dalam ${timeoutMs / 1000} detik (${url})`);
}

async function assertPortFree(url) {
  try { await fetch(url); } catch { return; }
  throw new Error(`${url} sudah dipakai proses lain.`);
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
  } else child.kill();
}

async function dropDatabase() {
  const client = new Client(adminConfig("postgres"));
  await client.connect();
  try { await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`); } finally { await client.end(); }
}

// ---------- data demo ----------

const CATEGORIES = [
  ["Makanan", false, "Makanan berat dan ringan buatan kantin"],
  ["Minuman", false, "Minuman dingin dan panas"],
  ["Alat Tulis", false, "Perlengkapan kuliah"],
  ["PUBJ", true, "Barang titipan dari supplier"]
];

const SUPPLIERS = [["Bu Sari", "081234500011"], ["Pak Joko", "081234500022"]];

// [nama, kategori, harga, stok awal, warna, deskripsi]
const SHOP = [
  ["Nasi Goreng", "Makanan", 15000, 30, "#E07A5F", "Nasi goreng telur"],
  ["Mie Ayam", "Makanan", 12000, 25, "#D4A373", ""],
  ["Roti Bakar", "Makanan", 10000, 18, "#C9844C", "Selai cokelat atau stroberi"],
  ["Es Teh", "Minuman", 5000, 60, "#B5838D", ""],
  ["Kopi Susu", "Minuman", 8000, 40, "#8D6E63", ""],
  ["Air Mineral", "Minuman", 4000, 2, "#4A7FDB", "Botol 600 ml"],
  ["Jus Jeruk", "Minuman", 9000, 0, "#F4A261", ""],
  ["Buku Tulis", "Alat Tulis", 5000, 50, "#2A9D8F", "Isi 38 lembar"],
  ["Pulpen", "Alat Tulis", 3000, 60, "#264653", ""],
  ["Pensil 2B", "Alat Tulis", 2500, 8, "#6D597A", ""]
];

// [nama, supplier, harga, fee %]
const PUBJ = [
  ["Risoles", "Bu Sari", 4000, 10],
  ["Lemper", "Bu Sari", 5000, 10],
  ["Kue Lapis", "Pak Joko", 5000, 15],
  ["Pastel", "Pak Joko", 4000, 10],
  ["Onde-onde", "Pak Joko", 3000, 10]
];

async function makeProductImages(browser, dir) {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const files = {};
  const all = [...SHOP.map((p) => [p[0], p[4]]), ...PUBJ.map((p, i) => [p[0], ["#A98467", "#6C584C", "#BC6C25", "#DDA15E", "#606C38"][i]])];
  all.push(["Teh Botol", "#9C6644"]);
  for (const [name, color] of all) {
    await page.setContent(`<body style="margin:0"><div style="width:640px;height:480px;background:${color};display:flex;align-items:center;justify-content:center;font:700 64px Arial,sans-serif;color:#fff;text-align:center">${name}</div></body>`);
    const file = path.join(dir, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
    await page.screenshot({ path: file });
    files[name] = file;
  }
  await page.close();
  return files;
}

async function seed(pool, images) {
  const hash = await bcrypt.hash(passwordOf("superadmin"), 10);
  await pool.query("INSERT INTO users (username, password, role) VALUES ('superadmin', $1, 'superadmin')", [hash]);

  await api("superadmin", "PUT", "/api/settings", {
    store_name: "Soswir",
    store_email: "kantin@soswir.id",
    store_address: "Gedung Student Center Lt. 1, Kampus",
    store_phone: "0812 3450 0000",
    operating_hours_monday: "07:00-17:00",
    operating_hours_tuesday: "07:00-17:00",
    operating_hours_wednesday: "07:00-17:00",
    operating_hours_thursday: "07:00-17:00",
    operating_hours_friday: "07:00-15:00"
  });

  const windows = shiftWindows(wibMinutesNow());
  const sesi1 = await api("superadmin", "POST", "/api/shifts", { label: "Sesi 1", start_time: windows.inside[0], end_time: windows.inside[1] });
  const sesi2 = await api("superadmin", "POST", "/api/shifts", { label: "Sesi 2", start_time: windows.outside[0], end_time: windows.outside[1] });
  for (const [username, shift] of [["rina", sesi1], ["budi", sesi1], ["dewi", sesi2]]) {
    const created = await api("superadmin", "POST", "/api/users/cashiers", { username, password: passwordOf(username) });
    await api("superadmin", "PUT", `/api/shifts/assign/${created.id}`, { shift_id: shift.id });
  }

  const cat = {};
  for (const [name, isReseller, description] of CATEGORIES) {
    cat[name] = (await api("superadmin", "POST", "/api/categories", { name, is_reseller: isReseller, description })).id;
  }
  const sup = {};
  for (const [name, phone] of SUPPLIERS) sup[name] = (await api("superadmin", "POST", "/api/suppliers", { name, phone })).id;

  const prod = {};
  const create = async (body, name) => {
    const image = await uploadImage(images[name]);
    prod[name] = (await api("superadmin", "POST", "/api/products", { ...body, name, image_url: image.imageUrl, image_filename: image.imageFilename })).id;
  };
  for (const [name, category, price, stock, , description] of SHOP) {
    await create({ category_id: cat[category], price, stock, description }, name);
  }
  for (const [name, supplier, price, fee] of PUBJ) {
    await create({ category_id: cat.PUBJ, supplier_id: sup[supplier], price, stock: 0, tax_percentage: fee, tax_description: `Fee toko ${fee}%` }, name);
  }
  if (!prod["Nasi Goreng"]) throw new Error("ID produk tidak terbaca dari respons POST /api/products");

  const entry = (product, supplier, qty) =>
    api("superadmin", "POST", "/api/daily-stock", { product_id: prod[product], supplier_id: sup[supplier], entry_date: wibDate(0), quantity_in: qty, notes: "" });

  const sell = async (cashier, items, { daysAgo = 0, at = "10:00", customer = "Umum", method = "Cash" } = {}) => {
    const res = await api(cashier, "POST", "/api/sales", {
      customer_name: customer,
      payment_method: method,
      items: items.map(([name, quantity]) => ({ product_id: prod[name], quantity }))
    });
    if (daysAgo > 0) {
      const ts = `(current_date - ${Number(daysAgo)}) + time '${at}'`;
      await pool.query(`UPDATE sales SET created_at = ${ts} WHERE id = $1`, [res.sale_id]);
      await pool.query(`UPDATE transaction_logs SET created_at = ${ts} WHERE sale_id = $1`, [res.sale_id]);
      await pool.query(`UPDATE sale_taxes SET created_at = ${ts} WHERE sale_id = $1`, [res.sale_id]);
    }
    return res;
  };

  // Hari kemarin: titipan Bu Sari dan Pak Joko, lalu digeser ke kemarin dan diselesaikan.
  await entry("Risoles", "Bu Sari", 30);
  await entry("Lemper", "Bu Sari", 20);
  await entry("Kue Lapis", "Pak Joko", 25);
  await sell("rina", [["Risoles", 6], ["Es Teh", 3]], { daysAgo: 1, at: "08:15", customer: "Andi" });
  await sell("rina", [["Lemper", 4], ["Kopi Susu", 2]], { daysAgo: 1, at: "09:40", method: "QRIS" });
  await sell("budi", [["Kue Lapis", 10], ["Nasi Goreng", 2]], { daysAgo: 1, at: "11:20", customer: "Panitia BEM", method: "Transfer" });
  await sell("budi", [["Risoles", 12], ["Mie Ayam", 3]], { daysAgo: 1, at: "12:05" });
  await pool.query("UPDATE daily_stock_entries SET entry_date = current_date - 1, created_at = (current_date - 1) + time '07:00'");
  await api("superadmin", "POST", "/api/daily-stock/end-of-day", {});
  const { rows: [risolesKemarin] } = await pool.query("SELECT id FROM daily_stock_entries WHERE product_id = $1", [prod.Risoles]);
  await api("superadmin", "PATCH", `/api/daily-stock/${risolesKemarin.id}/paid`, {});

  // Penjualan beberapa hari dan bulan sebelumnya (produk toko saja).
  const older = [
    ["rina", [["Nasi Goreng", 2], ["Es Teh", 2]], 2, "09:10", "Umum", "Cash"],
    ["budi", [["Buku Tulis", 3], ["Pulpen", 2]], 3, "10:30", "Sinta", "QRIS"],
    ["rina", [["Mie Ayam", 2], ["Kopi Susu", 1]], 5, "12:15", "Umum", "Cash"],
    ["budi", [["Roti Bakar", 2], ["Es Teh", 2]], 8, "08:45", "Umum", "E-Wallet"],
    ["rina", [["Nasi Goreng", 3]], 12, "11:50", "Umum", "Cash"],
    ["budi", [["Pulpen", 4], ["Buku Tulis", 2]], 20, "13:05", "Himpunan Mahasiswa", "Transfer"],
    ["rina", [["Mie Ayam", 2], ["Es Teh", 3]], 26, "12:40", "Umum", "Cash"],
    ["budi", [["Kopi Susu", 3], ["Roti Bakar", 1]], 33, "09:30", "Umum", "QRIS"],
    ["rina", [["Nasi Goreng", 2], ["Kopi Susu", 2]], 40, "12:20", "Umum", "Cash"]
  ];
  for (const [cashier, items, daysAgo, at, customer, method] of older) await sell(cashier, items, { daysAgo, at, customer, method });

  // Hari ini: stok titipan baru lalu penjualan berjalan.
  await entry("Risoles", "Bu Sari", 30);
  await entry("Lemper", "Bu Sari", 20);
  await entry("Kue Lapis", "Pak Joko", 25);
  await entry("Pastel", "Pak Joko", 15);
  await sell("rina", [["Risoles", 4], ["Es Teh", 2]], { customer: "Umum" });
  await sell("budi", [["Nasi Goreng", 2], ["Kue Lapis", 3]], { customer: "Fajar", method: "QRIS" });
  await sell("rina", [["Pastel", 5], ["Kopi Susu", 1]], { customer: "Umum" });
  await sell("budi", [["Mie Ayam", 1], ["Lemper", 2]], { customer: "Umum", method: "E-Wallet" });

  await api("superadmin", "PATCH", `/api/products/${prod["Pensil 2B"]}/toggle-active`, {});

  return { prod, windows };
}

// ---------- screenshot ----------

const shots = [];

async function newPage(browser, username) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "id-ID", timezoneId: "Asia/Jakarta" });
  const session = username ? await login(username) : null;
  await context.addInitScript((s) => {
    localStorage.setItem("theme", "light");
    if (s) {
      localStorage.setItem("pos_token", s.token);
      localStorage.setItem("pos_user_role", s.role);
      localStorage.setItem("pos_user_id", String(s.id));
      localStorage.setItem("pos_username", s.username);
    }
  }, session);
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`  pageerror: ${error.message}`));
  return page;
}

async function open(page, route, readyText) {
  await page.goto(FRONTEND_URL + route, { waitUntil: "load", timeout: 60000 });
  if (readyText) await page.getByText(readyText, { exact: false }).first().waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.body.innerText.match(/Memuat [a-z ]+\.\.\./i), null, { timeout: 30000 });
  await page.waitForTimeout(800);
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  const file = path.join(IMG_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(name);
  console.log(`SHOT ${name}`);
}

const dialog = (page) => page.locator('[role="dialog"]').last();

async function openDialog(page, buttonName) {
  await page.getByRole("button", { name: buttonName, exact: true }).first().click();
  await dialog(page).waitFor();
  await page.waitForTimeout(500);
}

async function rowAction(page, rowText, item) {
  // Menu aksi menutup sendiri saat ada scroll, jadi baris digulir dulu baru tombol diklik.
  const button = page.locator("tr", { hasText: rowText }).first().getByRole("button", { name: "Aksi" });
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await button.click();
  const menu = page.locator('[role="menu"]');
  await menu.waitFor();
  await page.waitForTimeout(300);
  if (!item) return;
  await menu.getByRole("menuitem", { name: item, exact: true }).click();
}

async function closeDialog(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

async function selectByLabel(locator, label) {
  await locator.selectOption({ label });
}

async function capture(browser, images, windows) {
  // 2. Masuk akun
  let page = await newPage(browser, null);
  await open(page, "/login", "Welcome Back");
  await shot(page, "01-login");
  await page.fill("#username", "dewi");
  await page.fill("#password", passwordOf("dewi"));
  await page.getByRole("button", { name: "Sign In to Dashboard" }).click();
  await page.getByText("Di luar jam shift Anda").waitFor({ timeout: 15000 });
  await shot(page, "02-login-di-luar-shift");
  await page.fill("#username", "rina");
  await page.fill("#password", passwordOf("rina"));
  await page.getByRole("button", { name: "Sign In to Dashboard" }).click();
  await page.waitForURL("**/cashier/dashboard", { timeout: 20000 });
  await page.context().close();

  // 3. Kasir
  page = await newPage(browser, "rina");
  await open(page, "/cashier/dashboard", "Dashboard Kasir");
  await shot(page, "03-kasir-dashboard");
  await page.locator("button", { hasText: "rina" }).first().click();
  await page.getByRole("button", { name: "Logout" }).waitFor();
  await shot(page, "04-menu-akun");
  await page.keyboard.press("Escape");

  await open(page, "/cashier/pos", "Point of Sale");
  await page.waitForFunction(() => [...document.images].filter((i) => i.alt && i.src.includes("uploads")).every((i) => i.complete && i.naturalWidth > 0));
  await shot(page, "05-pos-katalog");

  const addToCart = async (name) => {
    await page.locator(`xpath=//h3[normalize-space()="${name}"]/ancestor::div[contains(@class,"overflow-hidden")][1]//button`).click();
    await page.waitForTimeout(300);
  };
  const plus = async (name) => {
    await page.locator(`xpath=//h4[normalize-space()="${name}"]/ancestor::div[contains(@class,"rounded-lg")][1]//button`).nth(1).click();
    await page.waitForTimeout(300);
  };
  await addToCart("Nasi Goreng");
  await addToCart("Es Teh");
  await plus("Es Teh");
  await addToCart("Risoles");
  await plus("Risoles");
  await plus("Risoles");
  await page.waitForTimeout(3200);
  await shot(page, "06-pos-keranjang");

  await page.getByRole("button", { name: "Checkout" }).click();
  await dialog(page).waitFor();
  await page.fill("#customer_name", "Nadia");
  await page.selectOption("#payment_method", "QRIS");
  await page.waitForTimeout(400);
  await shot(page, "07-pos-checkout");
  await page.getByRole("button", { name: "Konfirmasi Pembayaran" }).click();
  await page.getByText("Penjualan berhasil!").waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, "08-pos-berhasil");
  await page.waitForTimeout(3200);

  await addToCart("Air Mineral");
  await plus("Air Mineral");
  await page.waitForTimeout(3200);
  await plus("Air Mineral");
  await page.getByText("Stok tidak mencukupi").waitFor();
  await shot(page, "09-pos-stok-tidak-cukup");

  await open(page, "/cashier/products", "Daftar Produk");
  await shot(page, "10-kasir-produk");
  await open(page, "/cashier/transactions", "Log Transaksi");
  await shot(page, "11-kasir-transaksi");
  await open(page, "/cashier/profile", "Profil Saya");
  await shot(page, "12-profil");
  await page.context().close();

  // 4-11. Superadmin
  page = await newPage(browser, "superadmin");
  await open(page, "/superadmin/dashboard", "Total Keuntungan Toko");
  await page.getByText("Tren Penjualan").waitFor();
  await page.waitForTimeout(1500);
  await shot(page, "13-admin-dashboard");
  await page.getByText("Performa Kategori & Pajak PUBJ").scrollIntoViewIfNeeded();
  await page.getByText("Performa Kategori & Pajak PUBJ").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(600);
  await shot(page, "14-admin-dashboard-ringkasan");

  // Produk
  await open(page, "/superadmin/products", "Manajemen Produk");
  await page.waitForFunction(() => [...document.images].filter((i) => i.src.includes("uploads")).every((i) => i.complete && i.naturalWidth > 0));
  await shot(page, "15-produk-daftar");
  await openDialog(page, "Tambah Produk");
  await page.fill("#name", "Teh Botol");
  await selectByLabel(page.locator("#category"), "Minuman");
  await page.fill("#price", "6000");
  await page.fill("#stock", "24");
  await page.fill("#description", "Teh botol dingin 350 ml");
  await page.setInputFiles("#image", images["Teh Botol"]);
  await page.waitForTimeout(600);
  await shot(page, "16-produk-tambah");
  await selectByLabel(page.locator("#category"), "PUBJ");
  await page.fill("#name", "Tahu Isi");
  await page.fill("#price", "3000");
  await selectByLabel(page.locator("#supplier"), "Bu Sari (081234500011)");
  await page.fill("#tax_percentage", "10");
  await page.fill("#tax_description", "Fee toko 10%");
  await page.getByText("Simulasi Bagi Hasil:").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  await shot(page, "17-produk-tambah-pubj");
  await closeDialog(page);

  await rowAction(page, "Nasi Goreng");
  await shot(page, "18-produk-menu-aksi");
  await page.locator('[role="menu"]').getByRole("menuitem", { name: "Tambah Stok", exact: true }).click();
  await dialog(page).waitFor();
  await page.fill("#stock-quantity", "20");
  await page.waitForTimeout(400);
  await shot(page, "19-produk-tambah-stok");
  await closeDialog(page);
  await rowAction(page, "Kopi Susu", "Nonaktifkan");
  await dialog(page).waitFor();
  await shot(page, "20-produk-nonaktifkan");
  await closeDialog(page);
  await rowAction(page, "Jus Jeruk", "Hapus permanen");
  await dialog(page).waitFor();
  await shot(page, "21-produk-hapus-permanen");
  await closeDialog(page);

  // Kategori
  await open(page, "/superadmin/categories", "Manajemen Kategori");
  await shot(page, "22-kategori-daftar");
  await openDialog(page, "Tambah Kategori");
  await page.fill("#name", "Snack Titipan");
  await page.fill("#description", "Kue dan snack titipan warga kampus");
  await page.locator("#is_reseller").click();
  await page.waitForTimeout(400);
  await shot(page, "23-kategori-tambah");
  await closeDialog(page);

  // Supplier
  await open(page, "/superadmin/suppliers", "Nama Supplier");
  await shot(page, "24-supplier-daftar");
  await openDialog(page, "Tambah Supplier");
  await page.fill("#name", "Bu Wati");
  await page.fill("#phone", "081234500033");
  await shot(page, "25-supplier-tambah");
  await closeDialog(page);
  await rowAction(page, "Bu Sari", "Lihat Riwayat");
  await dialog(page).getByText("Rangkuman Historis").waitFor();
  await page.waitForTimeout(500);
  await shot(page, "26-supplier-riwayat");
  await closeDialog(page);

  // Stok harian
  await open(page, "/superadmin/daily-stock", "Stok Harian PUBJ");
  await shot(page, "27-stok-harian-daftar");
  await openDialog(page, "Tambah Entry");
  await selectByLabel(page.locator("#supplier"), "Pak Joko");
  await page.waitForTimeout(300);
  await selectByLabel(page.locator("#product"), "Onde-onde");
  await page.fill("#quantity", "20");
  await page.fill("#notes", "Datang jam 07.00");
  await shot(page, "28-stok-harian-tambah");
  await closeDialog(page);
  await rowAction(page, "Pastel", "Edit");
  await dialog(page).waitFor();
  await shot(page, "29-stok-harian-edit");
  await closeDialog(page);
  await rowAction(page, "Kue Lapis", "Selesaikan");
  await dialog(page).waitFor();
  await shot(page, "30-stok-harian-selesaikan");
  await closeDialog(page);
  await openDialog(page, "Selesaikan Hari");
  await shot(page, "31-stok-harian-selesaikan-hari");
  await closeDialog(page);
  await page.fill("#date-filter", wibDate(1));
  await page.waitForTimeout(1200);
  await rowAction(page, "Lemper", "Tandai Dibayar");
  await dialog(page).waitFor();
  await shot(page, "32-stok-harian-tandai-dibayar");
  await closeDialog(page);

  // Kasir
  await open(page, "/superadmin/cashiers", "Manajemen Kasir");
  await shot(page, "33-kasir-daftar");
  await openDialog(page, "Tambah Kasir");
  await page.fill("#username", "sinta");
  await page.fill("#password", "kasir123");
  await page.fill("#confirmPassword", "kasir123");
  await shot(page, "34-kasir-tambah");
  await closeDialog(page);
  await openDialog(page, "Tambah Sesi");
  await page.fill("#sesi-label", "Sesi Sore");
  await page.fill("#sesi-mulai", "15:00");
  await page.fill("#sesi-selesai", "18:00");
  await shot(page, "35-sesi-tambah");
  await closeDialog(page);
  await rowAction(page, "rina", "Edit");
  await dialog(page).waitFor();
  await shot(page, "36-kasir-edit");
  await closeDialog(page);
  await rowAction(page, "rina", "Lihat Aktivitas");
  await dialog(page).getByText("Total aktivitas").waitFor();
  await shot(page, "37-kasir-aktivitas");
  await closeDialog(page);
  page.once("dialog", (d) => d.accept());
  await rowAction(page, "budi", "Hapus");
  await page.getByText("riwayat transaksi").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await shot(page, "38-kasir-hapus-ditolak");

  // Pendapatan
  await open(page, "/superadmin/revenue", "Total Pendapatan");
  await shot(page, "39-pendapatan");
  await page.locator("tr", { hasText: "Harian" }).first().getByRole("button", { name: "Aksi" }).click();
  await page.locator('[role="menu"]').getByRole("menuitem", { name: "Lihat Detail" }).click();
  await dialog(page).getByText("Metode Pembayaran").waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes("Memuat detail data"));
  await page.waitForTimeout(500);
  await shot(page, "40-pendapatan-detail");
  await closeDialog(page);
  await openDialog(page, "Export Excel");
  await shot(page, "41-pendapatan-ekspor");
  await closeDialog(page);

  // Log transaksi
  await open(page, "/superadmin/transactions", "Log Transaksi");
  await shot(page, "42-log-transaksi");
  await openDialog(page, "Export Excel");
  await shot(page, "43-log-transaksi-ekspor");
  await closeDialog(page);

  // Aktivitas dan pengaturan
  await open(page, "/superadmin/activities", "Manajemen Aktivitas");
  await shot(page, "44-aktivitas");
  await open(page, "/superadmin/settings", "Pengaturan Toko");
  await shot(page, "45-pengaturan");
  await page.context().close();
}

// ---------- main ----------

async function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pos-manual-"));
  const uploadsBefore = new Set(fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []);
  let backend = null;
  let frontend = null;
  let pool = null;
  let browser = null;

  try {
    await assertPortFree(BACKEND_URL);
    await assertPortFree(FRONTEND_URL);
    await recreateDatabase(DB_NAME);
    await applySchema(DB_NAME);
    pool = new Pool({ ...adminConfig(DB_NAME), max: 2, options: "-c timezone=Asia/Jakarta" });

    const backendLog = fs.openSync(path.join(tmp, "backend.log"), "w");
    backend = spawn(process.execPath, ["index.js"], {
      cwd: BACKEND_DIR,
      env: { ...process.env, DB_NAME, PORT: "3005", NODE_ENV: "development", CLEANUP_ENABLED: "false" },
      stdio: ["ignore", backendLog, backendLog]
    });
    await waitFor(`${BACKEND_URL}/health`, 30000, "Backend");

    const frontendLog = fs.openSync(path.join(tmp, "frontend.log"), "w");
    frontend = spawn("npm", ["run", "dev", "--", "--port", "5175", "--strictPort"], {
      cwd: FRONTEND_DIR,
      env: { ...process.env, VITE_BACKEND_URL: BACKEND_URL },
      stdio: ["ignore", frontendLog, frontendLog],
      shell: process.platform === "win32"
    });
    await waitFor(`${FRONTEND_URL}/`, 90000, "Frontend");

    browser = await chromium.launch();
    const images = await makeProductImages(browser, tmp);
    const { windows } = await seed(pool, images);
    console.log(`Seed selesai. Sesi 1 ${windows.inside.join("-")}, Sesi 2 ${windows.outside.join("-")}`);

    // Pemanasan: kompilasi rute Vite sekali supaya foto pertama tidak kena layar loading.
    for (const [user, route] of [[null, "/login"], ["rina", "/cashier/dashboard"], ["rina", "/cashier/pos"], ["rina", "/cashier/products"], ["rina", "/cashier/transactions"], ["rina", "/cashier/profile"],
      ...["dashboard", "products", "categories", "suppliers", "daily-stock", "cashiers", "revenue", "transactions", "activities", "settings"].map((r) => ["superadmin", `/superadmin/${r}`])]) {
      const p = await newPage(browser, user);
      try { await p.goto(FRONTEND_URL + route, { waitUntil: "load", timeout: 90000 }); await p.waitForTimeout(1500); } finally { await p.context().close(); }
    }

    await capture(browser, images, windows);
    console.log(`\n${shots.length} screenshot ditulis ke ${IMG_DIR}`);
  } finally {
    const cleanup = async (name, fn) => { try { await fn(); } catch (error) { console.error(`Cleanup ${name} gagal: ${error.message}`); } };
    if (browser) await cleanup("browser", () => browser.close());
    if (!KEEP) {
      await cleanup("frontend", () => killTree(frontend));
      await cleanup("backend", () => killTree(backend));
      if (pool) await cleanup("pool", () => pool.end());
      await cleanup("drop database", dropDatabase);
      await cleanup("uploads", () => {
        for (const file of fs.readdirSync(UPLOAD_DIR)) if (!uploadsBefore.has(file)) fs.rmSync(path.join(UPLOAD_DIR, file), { force: true });
      });
      console.log(`Log proses: ${tmp}`);
    } else {
      if (pool) await cleanup("pool", () => pool.end());
      console.log(`--keep: backend pid ${backend?.pid}, frontend pid ${frontend?.pid}, log ${tmp}`);
    }
  }
}

main().catch((error) => {
  console.error("Capture gagal:", error);
  process.exitCode = 1;
});
