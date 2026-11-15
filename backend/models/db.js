const { Pool, types } = require("pg");
require("dotenv").config();

types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  options: "-c timezone=Asia/Jakarta"
});

pool.on("error", (err) => console.error("PG idle client error:", err));

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function withTransaction(work) {
  const client = await pool.connect();
  let failed;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    failed = error;
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release(failed);
  }
}

module.exports = { pool, query, withTransaction };
