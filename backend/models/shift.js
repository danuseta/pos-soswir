const { pool } = require("./db");

const createShiftTables = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        day_of_week TINYINT NOT NULL,
        start_time  TIME NOT NULL,
        end_time    TIME NOT NULL,
        label       VARCHAR(50) NOT NULL,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_shift_slot (day_of_week, start_time, end_time)
      );
    `);
    console.log("Shifts table created or already exists.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        shift_id   INT NOT NULL,
        user_id    INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_shift_user (shift_id, user_id),
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
      );
    `);
    console.log("Shift_assignments table created or already exists.");
  } catch (error) {
    console.error("Error creating shift tables:", error);
  } finally {
    connection.release();
  }
};

module.exports = { createShiftTables };
