const { pool } = require('./db');

async function createActivityLogTable() {
  try {
    const connection = await pool.getConnection();
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        username VARCHAR(255),
        activity_type ENUM('login', 'logout', 'route_change') NOT NULL,
        route_path VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    await connection.query(createTableQuery);
    connection.release();
    console.log("User activities table created or already exists.");
  } catch (error) {
    console.error("Error creating user activities table:", error);
  }
}

const logActivity = async () => {
  return true;
};

const getRecentActivities = async (limit = 10) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT 
        tl.id,
        'sale' as type,
        CONCAT('Penjualan: ', tl.product_name, ' (', tl.quantity, ' item)') as description,
        tl.created_at as time,
        tl.username as user
      FROM transaction_logs tl
      ORDER BY tl.created_at DESC
      LIMIT ?
    `, [limit]);
    connection.release();
    return rows;
  } catch (error) {
    console.error("Error fetching recent activities from transaction_logs:", error);
    return [];
  }
};

module.exports = {
  createActivityLogTable,
  logActivity,
  getRecentActivities
};