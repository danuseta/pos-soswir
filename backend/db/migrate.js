const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { adminConfig } = require("./setup");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function main() {
  const name = process.env.DB_NAME;
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();
  const client = new Client(adminConfig(name));
  await client.connect();
  try {
    for (const file of files) {
      await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      console.log(`Migrasi ${file} diterapkan ke ${name}.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
