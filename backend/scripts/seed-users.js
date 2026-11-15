require("dotenv").config();

const bcrypt = require("bcryptjs");
const { pool, query } = require("../models/db");

const users = [
  { username: "superadmin", password: "superadmin123", role: "superadmin" },
  { username: "kasir1", password: "kasir123", role: "cashier" },
  { username: "kasir2", password: "kasir123", role: "cashier" }
];

async function seed() {
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await query(
      `INSERT INTO users (username, password, role, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (username) DO UPDATE
       SET password = EXCLUDED.password, role = EXCLUDED.role, is_active = true`,
      [user.username, hashedPassword, user.role]
    );
    console.log(`seeded ${user.role.padEnd(10)} ${user.username} / ${user.password}`);
  }

  console.log(`\n${users.length} akun siap dipakai login.`);
}

seed()
  .catch((error) => {
    console.error("Seeding gagal:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
