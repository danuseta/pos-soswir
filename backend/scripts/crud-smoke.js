const { pool } = require("../models/db");

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002/api";
const username = process.env.SMOKE_USERNAME || "superadmin";
const password = process.env.SMOKE_PASSWORD;

if (!password) {
  console.error("SMOKE_PASSWORD wajib diisi.");
  process.exit(2);
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const created = {
  categories: [],
  suppliers: [],
  products: [],
  cashiers: [],
  shifts: [],
  dailyStock: [],
  settings: []
};
const passed = [];
let token;

function record(name) {
  passed.push(name);
  console.log(`PASS ${name}`);
}

async function request(method, path, body, expected = [200]) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!expected.includes(response.status)) {
    const message = data?.message || data?.error || String(data || "empty response");
    throw new Error(`${method} ${path}: expected ${expected.join("/")}, got ${response.status}: ${message}`);
  }

  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function findFreeShift(existing) {
  const occupied = existing.map((shift) => ({
    start: timeToMinutes(shift.start_time),
    end: timeToMinutes(shift.end_time)
  }));

  for (let start = 0; start < 24 * 60 - 1; start += 1) {
    const end = start + 1;
    if (!occupied.some((range) => range.start < end && range.end > start)) {
      return { start_time: minutesToTime(start), end_time: minutesToTime(end) };
    }
  }

  throw new Error("Tidak ada celah jadwal untuk smoke test shift tanpa mengubah data yang ada");
}

async function hardDeleteProduct(id) {
  await request("DELETE", `/products/${id}/hard-delete`, {
    password,
    confirmation: "DELETE"
  });
  created.products = created.products.filter((productId) => productId !== id);
}

async function cleanup() {
  let connection;
  try {
    connection = await pool.getConnection();
    for (const id of created.dailyStock) {
      await connection.query("DELETE FROM daily_stock_entries WHERE id = ?", [id]);
    }
    for (const id of created.products) {
      await connection.query("UPDATE daily_stock_entries SET product_id = NULL WHERE product_id = ?", [id]);
      await connection.query("DELETE FROM products WHERE id = ?", [id]);
    }
    for (const id of created.cashiers) {
      await connection.query("DELETE FROM users WHERE id = ? AND role = 'cashier'", [id]);
    }
    for (const id of created.shifts) {
      await connection.query("DELETE FROM shifts WHERE id = ?", [id]);
    }
    for (const id of created.categories) {
      await connection.query("DELETE FROM categories WHERE id = ?", [id]);
    }
    for (const id of created.suppliers) {
      await connection.query("DELETE FROM suppliers WHERE id = ?", [id]);
    }
    for (const key of created.settings) {
      await connection.query("DELETE FROM store_settings WHERE setting_key = ?", [key]);
    }

    const marker = `%${suffix}%`;
    const [[remaining]] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM categories WHERE name LIKE ?) +
        (SELECT COUNT(*) FROM suppliers WHERE name LIKE ?) +
        (SELECT COUNT(*) FROM products WHERE name LIKE ?) +
        (SELECT COUNT(*) FROM users WHERE username LIKE ?) +
        (SELECT COUNT(*) FROM shifts WHERE label LIKE ?) +
        (SELECT COUNT(*) FROM daily_stock_entries WHERE notes LIKE ?) +
        (SELECT COUNT(*) FROM store_settings WHERE setting_key LIKE ?) AS count`,
      [marker, marker, marker, marker, marker, marker, marker]
    );
    if (Number(remaining.count) > 0) {
      console.error(`FAIL cleanup menyisakan ${remaining.count} record smoke`);
      process.exitCode = 1;
    } else {
      console.log("PASS cleanup tidak menyisakan data smoke");
    }
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

async function run() {
  const login = await request("POST", "/auth/login", { username, password });
  assert(login?.token && login?.user?.role === "superadmin", "Login tidak menghasilkan token superadmin");
  token = login.token;
  await request("GET", "/auth/verify");
  record("auth login + verify");

  const regularCategory = await request("POST", "/categories", {
    name: `SMOKE Regular ${suffix}`,
    description: "temporary CRUD smoke category",
    is_reseller: false
  }, [201]);
  created.categories.push(regularCategory.id);
  await request("PUT", `/categories/${regularCategory.id}`, {
    name: `SMOKE Regular Updated ${suffix}`,
    description: "updated",
    is_reseller: false
  });
  const categories = await request("GET", "/categories");
  assert(categories.some((item) => Number(item.id) === Number(regularCategory.id)), "Kategori hasil create tidak terbaca");
  record("category create/read/update");

  const supplier = await request("POST", "/suppliers", {
    name: `SMOKE Supplier ${suffix}`,
    phone: "080000000000"
  }, [201]);
  created.suppliers.push(supplier.id);
  await request("PUT", `/suppliers/${supplier.id}`, {
    name: `SMOKE Supplier Updated ${suffix}`,
    phone: "081111111111"
  });
  const suppliers = await request("GET", "/suppliers");
  assert(suppliers.some((item) => Number(item.id) === Number(supplier.id)), "Supplier hasil create tidak terbaca");
  await request("GET", `/suppliers/${supplier.id}/history`);
  record("supplier create/read/update/history");

  const regularProduct = await request("POST", "/products", {
    name: `SMOKE Product ${suffix}`,
    description: "temporary regular product",
    price: 2000,
    stock: 5,
    category_id: regularCategory.id,
    supplier_id: null,
    tax_percentage: 0,
    tax_description: null,
    image_url: null,
    public_id: null
  }, [201]);
  created.products.push(regularProduct.id);
  await request("PUT", `/products/${regularProduct.id}`, {
    name: `SMOKE Product Updated ${suffix}`,
    description: "updated",
    price: 2500,
    category_id: regularCategory.id,
    supplier_id: null,
    tax_percentage: 0,
    tax_description: null,
    image_url: null,
    public_id: null
  });
  const stockResult = await request("PATCH", `/products/${regularProduct.id}/add-stock`, { quantity: 3 });
  assert(Number(stockResult.stock) === 8, `Stok hasil tambah seharusnya 8, aktual ${stockResult.stock}`);
  await request("PATCH", `/products/${regularProduct.id}/toggle-active`);
  await request("PATCH", `/products/${regularProduct.id}/toggle-active`);
  const products = await request("GET", "/products");
  assert(products.some((item) => Number(item.id) === Number(regularProduct.id)), "Produk hasil create tidak terbaca");
  record("product create/read/update/add-stock/toggle");

  const cashier = await request("POST", "/users/cashiers", {
    username: `smoke_cashier_${suffix}`,
    password: "temporary-smoke-password"
  }, [201]);
  created.cashiers.push(cashier.id);
  await request("GET", `/users/cashiers/${cashier.id}`);
  await request("GET", `/users/cashiers/${cashier.id}/activities`);
  await request("PUT", `/users/cashiers/${cashier.id}`, {
    username: `smoke_cashier_updated_${suffix}`
  });
  record("cashier create/read/update/activity");

  const shifts = await request("GET", "/shifts");
  const slot = findFreeShift(shifts);
  const shift = await request("POST", "/shifts", {
    ...slot,
    label: `SMOKE Shift ${suffix}`
  }, [201]);
  created.shifts.push(shift.id);
  await request("PUT", `/shifts/${shift.id}`, {
    ...slot,
    label: `SMOKE Shift Updated ${suffix}`
  });
  await request("PUT", `/shifts/assign/${cashier.id}`, { shift_id: shift.id });
  await request("PUT", `/shifts/assign/${cashier.id}`, { shift_id: null });
  record("shift create/read/update/assign/unassign");

  const resellerCategory = await request("POST", "/categories", {
    name: `SMOKE PUBJ ${suffix}`,
    description: "temporary reseller category",
    is_reseller: true
  }, [201]);
  created.categories.push(resellerCategory.id);
  const resellerProduct = await request("POST", "/products", {
    name: `SMOKE PUBJ Product ${suffix}`,
    description: "temporary reseller product",
    price: 2000,
    stock: 0,
    category_id: resellerCategory.id,
    supplier_id: supplier.id,
    tax_percentage: 10,
    tax_description: "smoke fee",
    image_url: null,
    public_id: null
  }, [201]);
  created.products.push(resellerProduct.id);
  const today = new Date().toISOString().slice(0, 10);
  const dailyStock = await request("POST", "/daily-stock", {
    product_id: resellerProduct.id,
    supplier_id: supplier.id,
    entry_date: today,
    quantity_in: 3,
    notes: `temporary CRUD smoke stock ${suffix}`
  }, [201]);
  created.dailyStock.push(dailyStock.id);
  await request("PUT", `/daily-stock/${dailyStock.id}`, { quantity_in: 4, notes: `updated ${suffix}` });
  const dailyEntries = await request("GET", `/daily-stock?date=${today}&supplier_id=${supplier.id}`);
  assert(dailyEntries.some((item) => Number(item.id) === Number(dailyStock.id)), "Stok harian hasil create tidak terbaca");
  await request("PATCH", `/daily-stock/${dailyStock.id}/paid`);
  await request("PATCH", `/daily-stock/${dailyStock.id}/complete`);
  await request("GET", `/daily-stock/summary/${today}`);
  await request("GET", "/daily-stock/scheduler/status");
  record("daily stock create/read/update/paid/complete + scheduler status");

  const settingKey = `smoke_probe_${suffix}`;
  created.settings.push(settingKey);
  await request("PUT", "/settings", { [settingKey]: "ok" });
  const setting = await request("GET", `/settings/${settingKey}`);
  assert(setting?.setting_value === "ok", "Setting sementara tidak tersimpan");
  await request("GET", "/settings");
  record("settings create/read");

  await request("GET", "/sales");
  await request("GET", "/sales/chart?view=daily");
  await request("GET", "/sales/tax-report");
  await request("GET", "/sales/revenue");
  const allMonthlyRevenue = await request("GET", "/sales/revenue?all_months=true");
  assert(Array.isArray(allMonthlyRevenue.monthly), "Revenue semua bulan tidak mengembalikan array bulanan");
  const [expectedMonthlyRevenue] = await pool.query(`
    SELECT
      YEAR(s.created_at) AS year,
      MONTH(s.created_at) AS month,
      SUM(s.total_amount) AS total_revenue,
      COUNT(s.id) AS transaction_count
    FROM sales s
    GROUP BY YEAR(s.created_at), MONTH(s.created_at)
  `);
  for (const expected of expectedMonthlyRevenue) {
    const actual = allMonthlyRevenue.monthly.find((item) =>
      Number(item.year) === Number(expected.year) && Number(item.month) === Number(expected.month)
    );
    assert(actual, `Revenue bulan ${expected.year}-${expected.month} tidak ditemukan`);
    assert(Number(actual.total_revenue) === Number(expected.total_revenue), `Total revenue bulan ${expected.year}-${expected.month} tidak akurat`);
    assert(Number(actual.transaction_count) === Number(expected.transaction_count), `Jumlah transaksi bulan ${expected.year}-${expected.month} tidak akurat`);
  }
  await request("POST", "/sales", {}, [400]);
  const transactionLogs = await request("GET", "/transactions");
  assert(Array.isArray(transactionLogs), "Log transaksi tidak mengembalikan array");
  if (transactionLogs.length > 0) {
    assert(transactionLogs.every((item) => item.sale_id != null), "Log transaksi tidak menyertakan sale_id untuk rekap order unik");
    assert(transactionLogs.every((item) => /^\d{4}-\d{2}$/.test(item.periode)), "Log transaksi tidak menyertakan periode bulanan yang valid");
  }
  await request("GET", "/dashboard");
  await request("GET", "/dashboard/revenue");
  await request("GET", "/activity-cleanup/status");
  await request("GET", "/activity-cleanup/logs");
  await request("GET", "/activity-cleanup/retention-options");
  record("sales validation + reporting/dashboard/cleanup reads");

  await request("DELETE", `/users/cashiers/${cashier.id}`, undefined, [204]);
  created.cashiers = created.cashiers.filter((id) => id !== cashier.id);
  await request("DELETE", `/shifts/${shift.id}`);
  created.shifts = created.shifts.filter((id) => id !== shift.id);

  await pool.query("DELETE FROM daily_stock_entries WHERE id = ?", [dailyStock.id]);
  created.dailyStock = created.dailyStock.filter((id) => id !== dailyStock.id);
  await hardDeleteProduct(resellerProduct.id);
  await hardDeleteProduct(regularProduct.id);
  await request("DELETE", `/categories/${resellerCategory.id}`);
  created.categories = created.categories.filter((id) => id !== resellerCategory.id);
  await request("DELETE", `/categories/${regularCategory.id}`);
  created.categories = created.categories.filter((id) => id !== regularCategory.id);
  await request("DELETE", `/suppliers/${supplier.id}`);
  created.suppliers = created.suppliers.filter((id) => id !== supplier.id);
  await pool.query("DELETE FROM store_settings WHERE setting_key = ?", [settingKey]);
  created.settings = created.settings.filter((key) => key !== settingKey);
  record("delete endpoints + temporary data cleanup");

  console.log(`CRUD smoke selesai: ${passed.length} kelompok lolos.`);
}

run()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
