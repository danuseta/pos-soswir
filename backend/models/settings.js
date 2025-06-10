const { pool } = require("./db");

const createStoreSettingsTable = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) NOT NULL UNIQUE,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("Store_settings table created or already exists.");

    const [rows] = await connection.query("SELECT * FROM store_settings WHERE setting_key = ?", ["store_name"]);
    if (rows.length === 0) {
      await connection.query("INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?)", ["store_name", "My Awesome Store"]);
      console.log("Default store_name initialized in store_settings.");
    }

  } catch (error) {
    console.error("Error creating store_settings table or initializing default settings:", error);
  } finally {
    connection.release();
  }
};

module.exports = { createStoreSettingsTable };
