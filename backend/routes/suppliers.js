const express = require("express");
const { pool, query } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const suppliers = await query(`
      SELECT s.*,
             COALESCE(p.product_count, 0) AS product_count,
             COALESCE(d.entries, 0) AS daily_entries_count,
             COALESCE(d.revenue, 0) AS total_revenue,
             COALESCE(d.earnings, 0) AS total_earnings
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS product_count FROM products GROUP BY supplier_id
      ) p ON p.supplier_id = s.id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS entries, SUM(total_revenue) AS revenue, SUM(supplier_earning) AS earnings
        FROM daily_stock_entries
        WHERE entry_date >= current_date - 30
        GROUP BY supplier_id
      ) d ON d.supplier_id = s.id
      WHERE s.is_active = true
      ORDER BY s.created_at DESC
    `);
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

    const rows = await query(
      "INSERT INTO suppliers (name, phone) VALUES ($1, $2) RETURNING id",
      [name.trim(), phone || null]
    );

    res.status(201).json({
      message: "Supplier berhasil ditambahkan",
      id: rows[0].id
    });
  } catch (error) {
    console.error("Error creating supplier:", error);
    if (error.code === '23505') {
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

    const { rowCount } = await pool.query(
      "UPDATE suppliers SET name = $1, phone = $2 WHERE id = $3",
      [name.trim(), phone || null, supplierId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Supplier tidak ditemukan" });
    }

    res.json({ message: "Supplier berhasil diperbarui" });
  } catch (error) {
    console.error("Error updating supplier:", error);
    if (error.code === '23505') {
      res.status(400).json({ message: "Nama supplier sudah ada" });
    } else {
      res.status(500).json({ message: "Server error updating supplier" });
    }
  }
});

router.delete("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const supplierId = req.params.id;

    const productCheck = await query(
      "SELECT COUNT(*) as count FROM products WHERE supplier_id = $1",
      [supplierId]
    );
    const entryCheck = await query(
      "SELECT COUNT(*) as count FROM daily_stock_entries WHERE supplier_id = $1",
      [supplierId]
    );

    if (productCheck[0].count > 0 || entryCheck[0].count > 0) {
      await query("UPDATE suppliers SET is_active = false WHERE id = $1", [supplierId]);
      return res.json({ message: "Supplier dinonaktifkan karena masih memiliki data terkait" });
    }

    const { rowCount } = await pool.query("DELETE FROM suppliers WHERE id = $1", [supplierId]);

    if (rowCount === 0) {
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

    const supplierRows = await query("SELECT * FROM suppliers WHERE id = $1", [supplierId]);
    if (supplierRows.length === 0) {
      return res.status(404).json({ message: "Supplier tidak ditemukan" });
    }

    const history = await query(`
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
      WHERE dse.supplier_id = $1
      ORDER BY dse.entry_date DESC, dse.created_at DESC
    `, [supplierId]);

    res.json(history);
  } catch (error) {
    console.error("Error fetching supplier history:", error);
    res.status(500).json({ message: "Server error fetching supplier history" });
  }
});

module.exports = router;
