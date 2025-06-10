const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z'
});

const createUserTable = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('cashier', 'superadmin') NOT NULL DEFAULT 'cashier',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table created or already exists.');

    const [rows] = await connection.query('SELECT * FROM users WHERE role = ?', ['superadmin']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('superadminpassword', 10);
      await connection.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['superadmin', hashedPassword, 'superadmin']);
      console.log('Default superadmin created.');
    }
  } catch (error) {
    console.error('Error creating users table or default superadmin:', error);
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  createUserTable
};
