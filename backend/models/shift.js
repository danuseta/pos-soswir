const { pool } = require("./db");

const createShiftTables = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        label      VARCHAR(50) NOT NULL,
        start_time TIME NOT NULL,
        end_time   TIME NOT NULL,
        is_active  TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_shift_slot (start_time, end_time)
      );
    `);
    console.log("Shifts table created or already exists.");

    const [[{ ada }]] = await connection.query(
      `SELECT COUNT(*) AS ada FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'shift_id'`
    );

    if (ada === 0) {
      await connection.query(`
        ALTER TABLE users
          ADD COLUMN shift_id INT NULL,
          ADD CONSTRAINT fk_users_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
      `);
      console.log("Users.shift_id column added.");
    }
  } catch (error) {
    console.error("Error creating shift tables:", error);
  } finally {
    connection.release();
  }
};

module.exports = { createShiftTables };
