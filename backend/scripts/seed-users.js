require("dotenv").config();

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const users = [
  { username: "superadmin", password: "superadmin123", role: "superadmin" },
  { username: "kasir1", password: "kasir123", role: "cashier" },
  { username: "kasir2", password: "kasir123", role: "cashier" }
];

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await connection.query(
      `INSERT INTO users (username, password, role, is_active)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role), is_active = 1`,
      [user.username, hashedPassword, user.role]
    );
    console.log(`seeded ${user.role.padEnd(10)} ${user.username} / ${user.password}`);
  }

  await connection.end();
  console.log(`\n${users.length} akun siap dipakai login.`);
}

seed().catch((error) => {
  console.error("Seeding gagal:", error.message);
  process.exit(1);
});
