const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const { adminConfig, createDatabaseIfMissing, applySchema } = require("./setup");

async function hasSchema(name) {
  const client = new Client(adminConfig(name));
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.users') AS t");
    return rows[0].t !== null;
  } finally {
    await client.end();
  }
}

async function main() {
  const name = process.env.DB_NAME;
  await createDatabaseIfMissing(name);
  if (!(await hasSchema(name))) await applySchema(name);

  const seed = new Client(adminConfig(name));
  await seed.connect();
  try {
    const { rowCount } = await seed.query("SELECT 1 FROM users WHERE role = 'superadmin'");
    if (rowCount === 0) {
      const fromEnv = process.env.INIT_SUPERADMIN_PASSWORD;
      const password = fromEnv || crypto.randomBytes(12).toString("base64url");
      const hash = await bcrypt.hash(password, 10);
      await seed.query("INSERT INTO users (username, password, role) VALUES ($1, $2, 'superadmin')", ["superadmin", hash]);
      console.log(fromEnv
        ? "Superadmin dibuat dengan password dari INIT_SUPERADMIN_PASSWORD."
        : `Superadmin dibuat. Username: superadmin, password: ${password} (dicetak sekali, segera simpan/ganti).`);
    }
  } finally {
    await seed.end();
  }
  console.log(`Database ${name} siap.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
