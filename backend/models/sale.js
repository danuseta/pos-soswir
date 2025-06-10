const { pool } = require("./db");

const createSalesTables = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL, -- cashier who made the sale
        total_amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    console.log("Sales table created or already exists.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price_at_sale DECIMAL(10, 2) NOT NULL, -- price of the product at the time of sale
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) -- Consider ON DELETE RESTRICT or SET NULL based on business logic
      );
    `);
    console.log("Sale_items table created or already exists.");
  } catch (error) {
    console.error("Error creating sales or sale_items table:", error);
  } finally {
    connection.release();
  }
};

module.exports = { createSalesTables };
