const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const DROPPABLE = /^[a-z0-9_]+_(test|scenario)$/;

function adminConfig(database) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database
  };
}

async function withClient(database, work) {
  const client = new Client(adminConfig(database));
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing(name) {
  await withClient("postgres", async (client) => {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  });
}

async function recreateDatabase(name) {
  if (!DROPPABLE.test(name)) {
    throw new Error(`Menolak drop database "${name}": hanya *_test atau *_scenario yang boleh.`);
  }
  await withClient("postgres", async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });
}

async function applySchema(name) {
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  await withClient(name, (client) => client.query(sql));
}

module.exports = { adminConfig, createDatabaseIfMissing, recreateDatabase, applySchema };
