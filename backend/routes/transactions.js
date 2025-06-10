const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [tables] = await connection.query(`
      SELECT TABLE_NAME FROM information_schema.tables 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction_logs'
    `);
    
    if (tables.length === 0) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS transaction_logs (
          id int NOT NULL AUTO_INCREMENT,
          sale_id int NOT NULL,
          user_id int DEFAULT NULL,
          username varchar(255) DEFAULT NULL,
          product_id int NOT NULL,
          product_name varchar(255) NOT NULL,
          quantity int NOT NULL,
          price decimal(10,2) NOT NULL,
          total decimal(10,2) NOT NULL,
          daily_stock_entry_id int DEFAULT NULL,
          created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY user_id (user_id),
          KEY product_id (product_id),
          KEY sale_id (sale_id),
          KEY daily_stock_entry_id (daily_stock_entry_id),
          CONSTRAINT transaction_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
          CONSTRAINT transaction_logs_ibfk_2 FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
          CONSTRAINT transaction_logs_ibfk_3 FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
        )
      `);
      
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME FROM information_schema.columns 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction_logs' AND COLUMN_NAME = 'daily_stock_entry_id'
      `);
      
      if (columns.length === 0) {
        await connection.query(`
          ALTER TABLE transaction_logs 
          ADD COLUMN daily_stock_entry_id int DEFAULT NULL,
          ADD KEY daily_stock_entry_id (daily_stock_entry_id)
        `);
      }
      
      await connection.query(`
        INSERT INTO transaction_logs (sale_id, user_id, username, product_id, product_name, quantity, price, total, created_at)
        SELECT 
          si.sale_id,
          s.user_id,
          u.username,
          si.product_id,
          p.name,
          si.quantity,
          si.price_at_sale,
          si.quantity * si.price_at_sale,
          s.created_at
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        JOIN users u ON s.user_id = u.id
      `);
    }
    
    const [rows] = await connection.query(`
      SELECT 
        tl.id,
        tl.created_at as waktu,
        tl.product_name as produk,
        COALESCE(c.name, 'Tidak Berkategori') as kategori,
        COALESCE(c.is_reseller, 0) as is_reseller,
        tl.quantity as jumlah,
        tl.price as harga,
        tl.total as total,
        tl.username as kasir,
        s.payment_method,
        CASE 
          WHEN c.is_reseller = 1 AND st.store_profit IS NOT NULL THEN 
            st.store_profit
          ELSE 
            ROUND((tl.total * 0.2), 2)
        END as keuntungan_toko,
        CASE 
          WHEN c.is_reseller = 1 AND st.supplier_amount IS NOT NULL THEN 
            st.supplier_amount
          ELSE 0
        END as keuntungan_supplier
      FROM transaction_logs tl
      LEFT JOIN products p ON tl.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON tl.sale_id = s.id
      LEFT JOIN sale_taxes st ON tl.sale_id = st.sale_id AND COALESCE(tl.product_id, 0) = COALESCE(st.product_id, 0)
      ORDER BY tl.created_at DESC
    `);
    
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching transaction logs:", error);
    res.status(500).json({ message: "Server error fetching transaction logs" });
  }
});

router.get("/bydate", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Start date and end date are required" });
  }
  
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT 
        tl.id,
        tl.created_at as waktu,
        tl.product_name as produk,
        COALESCE(c.name, 'Tidak Berkategori') as kategori,
        tl.quantity as jumlah,
        tl.price as harga,
        tl.total as total,
        tl.username as kasir
      FROM transaction_logs tl
      LEFT JOIN products p ON tl.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE tl.created_at BETWEEN ? AND ?
      ORDER BY tl.created_at DESC
    `, [startDate, endDate]);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching transaction logs by date:", error);
    res.status(500).json({ message: "Server error fetching transaction logs" });
  }
});

router.get("/byuser/:userId", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { userId } = req.params;
  
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT tl.* 
      FROM transaction_logs tl
      WHERE tl.user_id = ?
      ORDER BY tl.created_at DESC
    `, [userId]);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching transaction logs by user:", error);
    res.status(500).json({ message: "Server error fetching transaction logs" });
  }
});

router.get("/cashier", authenticateToken, authorizeRole(["cashier"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const userId = req.user.id;
    
    const [rows] = await connection.query(`
      SELECT 
        tl.id,
        tl.created_at as waktu,
        tl.product_name as produk,
        COALESCE(c.name, 'Tidak Berkategori') as kategori,
        COALESCE(c.is_reseller, 0) as is_reseller,
        tl.quantity as jumlah,
        tl.price as harga,
        tl.total as total,
        tl.username as kasir,
        s.payment_method,
        CASE 
          WHEN c.is_reseller = 1 AND st.store_profit IS NOT NULL THEN 
            st.store_profit
          ELSE 
            ROUND((tl.total * 0.2), 2)
        END as keuntungan_toko,
        CASE 
          WHEN c.is_reseller = 1 AND st.supplier_amount IS NOT NULL THEN 
            st.supplier_amount
          ELSE 0
        END as keuntungan_supplier
      FROM transaction_logs tl
      LEFT JOIN products p ON tl.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON tl.sale_id = s.id
      LEFT JOIN sale_taxes st ON tl.sale_id = st.sale_id AND COALESCE(tl.product_id, 0) = COALESCE(st.product_id, 0)
      WHERE tl.user_id = ?
      ORDER BY tl.created_at DESC
    `, [userId]);

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching cashier transactions:", error);
    res.status(500).json({ message: "Server error fetching transactions" });
  }
});

module.exports = router;
