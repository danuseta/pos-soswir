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

async function compareValues(source, target, table, row) {
  const checks = [];
  if (table.cols.includes("created_at")) {
    checks.push(["MIN(created_at)", "UNIX_TIMESTAMP(MIN(created_at))", "EXTRACT(EPOCH FROM MIN(created_at))::bigint"]);
    checks.push(["MAX(created_at)", "UNIX_TIMESTAMP(MAX(created_at))", "EXTRACT(EPOCH FROM MAX(created_at))::bigint"]);
  }
  if (table.name === "sales") checks.push(["SUM(total_amount)", "SUM(total_amount)", "SUM(total_amount)"]);
  if (table.name === "products") checks.push(["SUM(stock)", "SUM(stock)", "SUM(stock)"]);
  row.valueOk = true;
  for (const [label, mysqlExpr, pgExpr] of checks) {
    const [[m]] = await source.query(`SELECT ${mysqlExpr} AS v FROM \`${table.name}\``);
    const { rows: [p] } = await target.query(`SELECT ${pgExpr} AS v FROM ${table.name}`);
    const a = m.v === null ? null : Number(m.v);
    const b = p.v === null ? null : Number(p.v);
    row[label] = `${a}|${b}`;
    if (a !== b) row.valueOk = false;
  }
}

async function main() {
  const source = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    timezone: "Z",
    dateStrings: ["DATE"]
  });
  await source.query("SET time_zone = '+00:00'");
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
      const row = { table: table.name, source: rows.length, target: n };
      await compareValues(source, target, table, row);
      report.push(row);
    }

    const mismatch = report.filter((r) => r.source !== r.target || r.valueOk === false);
    if (mismatch.length > 0) throw new Error(`Data tidak cocok: ${JSON.stringify(mismatch)}`);
    await target.query("COMMIT");
  } catch (error) {
    await target.query("ROLLBACK").catch(() => {});
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
