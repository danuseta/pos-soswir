const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { adminConfig } = require("./setup");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function main() {
  const name = process.env.DB_NAME;
  if (!name) throw new Error("DB_NAME kosong; set DB_NAME ke database yang mau dimigrasi.");
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();
  const client = new Client(adminConfig(name));
  await client.connect();
  try {
    for (const file of files) {
      await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      console.log(`Migrasi ${file} diterapkan ke ${name}.`);
    }
    const unlinked = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM sale_taxes WHERE sale_item_id IS NULL)::int AS sale_taxes,
        (SELECT COUNT(*) FROM transaction_logs tl
          WHERE tl.sale_item_id IS NULL AND EXISTS (SELECT 1 FROM sales s WHERE s.id = tl.sale_id))::int AS transaction_logs
    `);
    const { sale_taxes, transaction_logs } = unlinked.rows[0];
    console.log(`Baris belum terhubung ke sale_items: sale_taxes=${sale_taxes}, transaction_logs=${transaction_logs}.`);
    if (sale_taxes || transaction_logs) {
      console.warn("PERINGATAN: baris tersebut tidak akan cocok di laporan; perbaiki datanya secara manual.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
