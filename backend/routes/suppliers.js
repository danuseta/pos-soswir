const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [suppliers] = await connection.query(`
      SELECT 
        s.*,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT dse.id) as daily_entries_count,
        COALESCE(SUM(dse.total_revenue), 0) as total_revenue,
        COALESCE(SUM(dse.supplier_earning), 0) as total_earnings
      FROM suppliers s
      LEFT JOIN products p ON s.id = p.supplier_id
      LEFT JOIN daily_stock_entries dse ON s.id = dse.supplier_id AND dse.entry_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    
    connection.release();
    res.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ message: "Server error fetching suppliers" });
  }
});

router.post("/", authenticateToken, authorizeRole(["superadmin", "cashier"]), async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: "Nama supplier tidak boleh kosong" });
    }

    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      "INSERT INTO suppliers (name, phone) VALUES (?, ?)",
      [name.trim(), phone || null]
    );
    
    connection.release();
    res.status(201).json({ 
      message: "Supplier berhasil ditambahkan", 
      id: result.insertId 
    });
  } catch (error) {
    console.error("Error creating supplier:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: "Nama supplier sudah ada" });
    } else {
      res.status(500).json({ message: "Server error creating supplier" });
    }
  }
});

router.put("/:id", authenticateToken, authorizeRole(["superadmin", "cashier"]), async (req, res) => {
  try {
    const { name, phone } = req.body;
    const supplierId = req.params.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: "Nama supplier tidak boleh kosong" });
    }

    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      "UPDATE suppliers SET name = ?, phone = ? WHERE id = ?",
      [name.trim(), phone || null, supplierId]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Supplier tidak ditemukan" });
    }
    
    res.json({ message: "Supplier berhasil diperbarui" });
  } catch (error) {
    console.error("Error updating supplier:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: "Nama supplier sudah ada" });
    } else {
      res.status(500).json({ message: "Server error updating supplier" });
    }
  }
});

router.delete("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const supplierId = req.params.id;
    const connection = await pool.getConnection();
    
    const [productCheck] = await connection.query(
      "SELECT COUNT(*) as count FROM products WHERE supplier_id = ?", 
      [supplierId]
    );
    
    const [entryCheck] = await connection.query(
      "SELECT COUNT(*) as count FROM daily_stock_entries WHERE supplier_id = ?", 
      [supplierId]
    );
    
    if (productCheck[0].count > 0 || entryCheck[0].count > 0) {
      await connection.query(
        "UPDATE suppliers SET is_active = 0 WHERE id = ?",
        [supplierId]
      );
      connection.release();
      return res.json({ message: "Supplier dinonaktifkan karena masih memiliki data terkait" });
    }
    
    const [result] = await connection.query("DELETE FROM suppliers WHERE id = ?", [supplierId]);
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Supplier tidak ditemukan" });
    }
    
    res.json({ message: "Supplier berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ message: "Server error deleting supplier" });
  }
});

router.get("/:id/history", authenticateToken, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const connection = await pool.getConnection();
    
    const [supplierRows] = await connection.query(
      "SELECT * FROM suppliers WHERE id = ?",
      [supplierId]
    );
    
    if (supplierRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Supplier tidak ditemukan" });
    }
    
    const [history] = await connection.query(`
      SELECT 
        dse.*,
        p.name as product_name,
        p.image_url as product_image,
        p.price as product_price,
        dse.quantity_in as total_quantity_in,
        dse.quantity_sold as total_quantity_sold,
        dse.quantity_returned,
        dse.total_revenue,
        dse.supplier_earning as total_supplier_earning,
        dse.store_fee,
        dse.tax_percentage,
        dse.status,
        dse.is_paid,
        dse.paid_at,
        dse.entry_date,
        dse.created_at,
        dse.updated_at
      FROM daily_stock_entries dse
      JOIN products p ON dse.product_id = p.id
      WHERE dse.supplier_id = ?
      ORDER BY dse.entry_date DESC, dse.created_at DESC
    `, [supplierId]);
    
    connection.release();
    res.json(history);
  } catch (error) {
    console.error("Error fetching supplier history:", error);
    res.status(500).json({ message: "Server error fetching supplier history" });
  }
});

module.exports = router;
