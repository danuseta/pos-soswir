const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const dailyStockScheduler = require("../utils/dailyStockScheduler");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { date, supplier_id, status } = req.query;
    const connection = await pool.getConnection();
    
    let query = `
      SELECT 
        dse.*,
        p.name as product_name,
        p.image_url as product_image,
        p.price as product_price,
        s.name as supplier_name,
        s.phone as supplier_phone,
        c.name as category_name,
        c.is_reseller
      FROM daily_stock_entries dse
      JOIN products p ON dse.product_id = p.id
      JOIN suppliers s ON dse.supplier_id = s.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (date) {
      query += " AND dse.entry_date = ?";
      params.push(date);
    }
    
    if (supplier_id) {
      query += " AND dse.supplier_id = ?";
      params.push(supplier_id);
    }
    
    if (status) {
      query += " AND dse.status = ?";
      params.push(status);
    }
    
    query += " ORDER BY dse.entry_date DESC, dse.created_at DESC";
    
    const [entries] = await connection.query(query, params);
    
    connection.release();
    res.json(entries);
  } catch (error) {
    console.error("Error fetching daily stock entries:", error);
    res.status(500).json({ message: "Server error fetching daily stock entries" });
  }
});

router.post("/", authenticateToken, authorizeRole(["cashier", "superadmin"]), async (req, res) => {
  try {
    const { product_id, supplier_id, entry_date, quantity_in, notes } = req.body;

    if (!product_id || !supplier_id || !entry_date || !quantity_in) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    if (quantity_in <= 0) {
      return res.status(400).json({ message: "Jumlah stok harus lebih dari 0" });
    }

    const connection = await pool.getConnection();
    
    const [productRows] = await connection.query(`
      SELECT p.*, c.is_reseller 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `, [product_id]);
    
    if (productRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }
    
    if (!productRows[0].is_reseller) {
      connection.release();
      return res.status(400).json({ message: "Produk ini bukan kategori PUBJ" });
    }
    
    const [supplierRows] = await connection.query(
      "SELECT id FROM suppliers WHERE id = ? AND is_active = 1",
      [supplier_id]
    );
    
    if (supplierRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Supplier tidak ditemukan atau tidak aktif" });
    }
    
    if (productRows[0].supplier_id !== parseInt(supplier_id)) {
      connection.release();
      return res.status(400).json({ message: "Produk ini tidak milik supplier yang dipilih" });
    }
    
    const price_per_unit = parseFloat(productRows[0].price);
    
    const tax_percentage = parseFloat(productRows[0].tax_percentage || 0);
    
    const [result] = await connection.query(
      `INSERT INTO daily_stock_entries 
       (product_id, supplier_id, entry_date, quantity_in, tax_percentage, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product_id, supplier_id, entry_date, quantity_in, tax_percentage, notes || null]
    );
    
    const [stockSum] = await connection.query(`
      SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) as available_stock
      FROM daily_stock_entries 
      WHERE product_id = ? AND status = 'active'
    `, [product_id]);
    
    const newProductStock = parseInt(stockSum[0].available_stock);
    
    await connection.query(
      "UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?",
      [newProductStock, product_id]
    );
    
    connection.release();
    res.status(201).json({ 
      message: "Stok harian berhasil ditambahkan", 
      id: result.insertId,
      updated_product_stock: newProductStock
    });
  } catch (error) {
    console.error("Error creating daily stock entry:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: "Sudah ada entry untuk produk dan supplier ini pada tanggal tersebut" });
    } else {
      res.status(500).json({ message: "Server error creating daily stock entry" });
    }
  }
});

router.put("/:id", authenticateToken, authorizeRole(["cashier", "superadmin"]), async (req, res) => {
  try {
    const { quantity_in, notes } = req.body;
    const entryId = req.params.id;

    const connection = await pool.getConnection();
    
    const [existing] = await connection.query(
      `SELECT dse.*, p.price as product_price, p.tax_percentage 
       FROM daily_stock_entries dse 
       JOIN products p ON dse.product_id = p.id 
       WHERE dse.id = ? AND dse.status = 'active'`,
      [entryId]
    );
    
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Entry tidak ditemukan atau sudah selesai" });
    }
    
    const currentEntry = existing[0];
    const price_per_unit = parseFloat(currentEntry.product_price);
    
    const newTotalRevenue = currentEntry.quantity_sold * price_per_unit;
    const newStoreFee = newTotalRevenue * (currentEntry.tax_percentage / 100);
    const newSupplierEarning = newTotalRevenue - newStoreFee;
    
    const [result] = await connection.query(
      `UPDATE daily_stock_entries 
       SET quantity_in = ?, notes = ?,
           total_revenue = ?, store_fee = ?, supplier_earning = ?,
           quantity_returned = ? - quantity_sold
       WHERE id = ?`,
      [quantity_in, notes || null, newTotalRevenue, newStoreFee, newSupplierEarning, quantity_in, entryId]
    );
    
    const [stockSum] = await connection.query(`
      SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) as available_stock
      FROM daily_stock_entries 
      WHERE product_id = ? AND status = 'active'
    `, [currentEntry.product_id]);
    
    const newProductStock = parseInt(stockSum[0].available_stock);
    
    await connection.query(
      "UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?",
      [newProductStock, currentEntry.product_id]
    );
    
    connection.release();
    res.json({ 
      message: "Entry berhasil diperbarui",
      updated_product_stock: newProductStock
    });
  } catch (error) {
    console.error("Error updating daily stock entry:", error);
    res.status(500).json({ message: "Server error updating daily stock entry" });
  }
});

router.patch("/:id/paid", authenticateToken, authorizeRole(["cashier", "superadmin"]), async (req, res) => {
  try {
    const entryId = req.params.id;
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      "UPDATE daily_stock_entries SET is_paid = 1, paid_at = NOW() WHERE id = ?",
      [entryId]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Entry tidak ditemukan" });
    }
    
    res.json({ message: "Entry ditandai sudah dibayar" });
  } catch (error) {
    console.error("Error marking entry as paid:", error);
    res.status(500).json({ message: "Server error updating payment status" });
  }
});

router.post("/end-of-day", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [activeEntries] = await connection.query(`
      SELECT * FROM daily_stock_entries 
      WHERE entry_date = CURDATE() AND status = 'active'
    `);
    
    let completedCount = 0;
    const updatedProducts = new Set();
    
    for (const entry of activeEntries) {
      const price_per_unit = parseFloat(entry.product_price);
      const quantity_returned = entry.quantity_in - entry.quantity_sold;
      const total_revenue = entry.quantity_sold * price_per_unit;
      const store_fee = total_revenue * (entry.tax_percentage / 100);
      const supplier_earning = total_revenue - store_fee;
      
      await connection.query(
        `UPDATE daily_stock_entries 
         SET status = 'completed',
             quantity_returned = ?,
             total_revenue = ?,
             store_fee = ?,
             supplier_earning = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [quantity_returned, total_revenue, store_fee, supplier_earning, entry.id]
      );
      
      updatedProducts.add(entry.product_id);
      completedCount++;
    }
    
    for (const productId of updatedProducts) {
      const [stockSum] = await connection.query(`
        SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) as available_stock
        FROM daily_stock_entries 
        WHERE product_id = ? AND status = 'active'
      `, [productId]);
      
      const newProductStock = parseInt(stockSum[0].available_stock);
      
      await connection.query(
        "UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?",
        [newProductStock, productId]
      );
    }
    
    connection.release();
    
    res.json({ 
      message: `Auto-completion berhasil: ${completedCount} entry diselesaikan untuk tanggal ${new Date().toISOString().split('T')[0]}`,
      completed_count: completedCount,
      date: new Date().toISOString().split('T')[0],
      updated_products: updatedProducts.size
    });
  } catch (error) {
    console.error("Error completing end of day:", error);
    res.status(500).json({ message: "Server error completing end of day" });
  }
});

router.get("/summary/:date", authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const connection = await pool.getConnection();
    
    const [summary] = await connection.query(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(quantity_in) as total_quantity_in,
        SUM(quantity_sold) as total_quantity_sold,
        SUM(quantity_returned) as total_quantity_returned,
        SUM(total_revenue) as total_revenue,
        SUM(store_fee) as total_store_fee,
        SUM(supplier_earning) as total_supplier_earning,
        COUNT(CASE WHEN is_paid = 1 THEN 1 END) as paid_entries,
        COUNT(CASE WHEN is_paid = 0 AND status = 'completed' THEN 1 END) as unpaid_entries
      FROM daily_stock_entries 
      WHERE entry_date = ?
    `, [date]);
    
    connection.release();
    res.json(summary[0]);
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    res.status(500).json({ message: "Server error fetching daily summary" });
  }
});

router.options("/:id/complete", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.patch("/:id/complete", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const entryId = req.params.id;
    const connection = await pool.getConnection();
    
    const [entries] = await connection.query(
      `
      SELECT dse.*, p.name as product_name, p.price as product_price, p.tax_percentage 
      FROM daily_stock_entries dse 
      JOIN products p ON dse.product_id = p.id 
      WHERE dse.id = ? AND dse.status = 'active'
    `, [entryId]);
    
    if (entries.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Entry tidak ditemukan atau sudah selesai" });
    }
    
    const entry = entries[0];
    
    const quantity_returned = entry.quantity_in - entry.quantity_sold;
    const total_revenue = entry.quantity_sold * entry.product_price;
    const store_fee = total_revenue * (entry.tax_percentage / 100);
    const supplier_earning = total_revenue - store_fee;
    
    const [result] = await connection.query(
      `UPDATE daily_stock_entries 
       SET status = 'completed',
           quantity_returned = ?,
           total_revenue = ?,
           store_fee = ?,
           supplier_earning = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [quantity_returned, total_revenue, store_fee, supplier_earning, entryId]
    );
    
    const [stockSum] = await connection.query(`
      SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) as available_stock
      FROM daily_stock_entries 
      WHERE product_id = ? AND status = 'active'
    `, [entry.product_id]);
    
    const newProductStock = parseInt(stockSum[0].available_stock);
    
    await connection.query(
      "UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?",
      [newProductStock, entry.product_id]
    );
    
    connection.release();
    
    res.json({ 
      message: `Stok harian "${entry.product_name}" berhasil diselesaikan`,
      quantity_returned: quantity_returned,
      total_revenue: total_revenue,
      supplier_earning: supplier_earning,
      store_fee: store_fee,
      updated_product_stock: newProductStock
    });
  } catch (error) {
    console.error("Error completing daily stock entry:", error);
    res.status(500).json({ message: "Server error completing daily stock entry" });
  }
});

router.post("/auto-complete", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const connection = await pool.getConnection();
    
    const [activeEntries] = await connection.query(
      `SELECT dse.*, p.price as product_price, p.name as product_name
       FROM daily_stock_entries dse 
       JOIN products p ON dse.product_id = p.id 
       WHERE dse.entry_date = ? AND dse.status = 'active'`,
      [targetDate]
    );
    
    if (activeEntries.length === 0) {
      connection.release();
      return res.json({ 
        message: "Tidak ada entry aktif untuk diselesaikan",
        completed_count: 0 
      });
    }
    
    let completedCount = 0;
    const updatedProducts = new Set();
    
    for (const entry of activeEntries) {
      const price_per_unit = parseFloat(entry.product_price);
      const quantity_returned = entry.quantity_in - entry.quantity_sold;
      const total_revenue = entry.quantity_sold * price_per_unit;
      const store_fee = total_revenue * (entry.tax_percentage / 100);
      const supplier_earning = total_revenue - store_fee;
      
      await connection.query(
        `UPDATE daily_stock_entries 
         SET status = 'completed',
             quantity_returned = ?,
             total_revenue = ?,
             store_fee = ?,
             supplier_earning = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [quantity_returned, total_revenue, store_fee, supplier_earning, entry.id]
      );
      
      updatedProducts.add(entry.product_id);
      completedCount++;
    }
    
    for (const productId of updatedProducts) {
      const [stockSum] = await connection.query(`
        SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) as available_stock
        FROM daily_stock_entries 
        WHERE product_id = ? AND status = 'active'
      `, [productId]);
      
      const newProductStock = parseInt(stockSum[0].available_stock);
      
      await connection.query(
        "UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?",
        [newProductStock, productId]
      );
    }
    
    connection.release();
    
    res.json({ 
      message: `Auto-completion berhasil: ${completedCount} entry diselesaikan untuk tanggal ${targetDate}`,
      completed_count: completedCount,
      date: targetDate,
      updated_products: updatedProducts.size
    });
  } catch (error) {
    console.error("Error auto-completing daily stock entries:", error);
    res.status(500).json({ message: "Server error auto-completing daily stock entries" });
  }
});


router.get("/scheduler/status", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const status = dailyStockScheduler.getStatus();
    res.json({
      ...status,
      message: "Daily Stock Scheduler status retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting scheduler status:", error);
    res.status(500).json({ message: "Server error getting scheduler status" });
  }
});

router.post("/scheduler/trigger", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const result = await dailyStockScheduler.triggerManual();
    res.json({
      ...result,
      message: "Manual scheduler trigger completed",
      triggered_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error triggering scheduler manually:", error);
    res.status(500).json({ message: "Server error triggering scheduler manually" });
  }
});

module.exports = router;
