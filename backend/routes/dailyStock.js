const express = require("express");
const { pool, query, withTransaction } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const dailyStockScheduler = require("../utils/dailyStockScheduler");
const { refreshPubjStock, completeEntries } = require("../services/dailyStock");
const { HttpError } = require("../utils/httpError");

const router = express.Router();

function handleError(res, error, logMessage, clientMessage) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  console.error(logMessage, error);
  res.status(500).json({ message: clientMessage });
}

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { date, supplier_id, status } = req.query;
    const params = [];
    let sql = `
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

    if (date) {
      params.push(date);
      sql += ` AND dse.entry_date = $${params.length}`;
    }
    if (supplier_id) {
      params.push(supplier_id);
      sql += ` AND dse.supplier_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND dse.status = $${params.length}`;
    }
    sql += " ORDER BY dse.entry_date DESC, dse.created_at DESC";

    res.json(await query(sql, params));
  } catch (error) {
    handleError(res, error, "Error fetching daily stock entries:", "Server error fetching daily stock entries");
  }
});

router.post("/", authenticateToken, authorizeRole(["cashier", "superadmin"]), async (req, res) => {
  try {
    const { product_id, supplier_id, entry_date, notes } = req.body;
    const quantityIn = Number(req.body.quantity_in);

    if (!product_id || !supplier_id || !req.body.quantity_in) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }
    if (!Number.isInteger(quantityIn) || quantityIn <= 0) {
      return res.status(400).json({ message: "Jumlah stok harus bilangan bulat lebih dari 0" });
    }

    const result = await withTransaction(async (client) => {
      const { rows: [product] } = await client.query(
        `SELECT p.id, p.price, p.tax_percentage, p.supplier_id, c.is_reseller
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1`,
        [product_id]
      );
      if (!product) throw new HttpError(404, "Produk tidak ditemukan");
      if (!product.is_reseller) throw new HttpError(400, "Produk ini bukan kategori PUBJ");

      const { rows: suppliers } = await client.query(
        "SELECT id FROM suppliers WHERE id = $1 AND is_active = true",
        [supplier_id]
      );
      if (suppliers.length === 0) throw new HttpError(404, "Supplier tidak ditemukan atau tidak aktif");
      if (product.supplier_id !== parseInt(supplier_id)) {
        throw new HttpError(400, "Produk ini tidak milik supplier yang dipilih");
      }

      const { rows: [entry] } = await client.query(
        `INSERT INTO daily_stock_entries
         (product_id, supplier_id, entry_date, quantity_in, price_per_unit, tax_percentage, notes)
         VALUES ($1, $2, COALESCE($3::date, current_date), $4, $5, $6, $7)
         RETURNING id`,
        [product.id, supplier_id, entry_date || null, quantityIn, product.price, product.tax_percentage || 0, notes || null]
      );
      await refreshPubjStock(client, product.id);
      const { rows: [{ stock }] } = await client.query("SELECT stock FROM products WHERE id = $1", [product.id]);
      return { id: entry.id, stock };
    });

    res.status(201).json({
      message: "Stok harian berhasil ditambahkan",
      id: result.id,
      updated_product_stock: result.stock
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ message: "Sudah ada entry untuk produk dan supplier ini pada tanggal tersebut" });
    }
    handleError(res, error, "Error creating daily stock entry:", "Server error creating daily stock entry");
  }
});

router.put("/:id", authenticateToken, authorizeRole(["cashier", "superadmin"]), async (req, res) => {
  try {
    const quantityIn = Number(req.body.quantity_in);
    if (!Number.isInteger(quantityIn) || quantityIn <= 0) {
      return res.status(400).json({ message: "Jumlah stok harus bilangan bulat lebih dari 0" });
    }

    const stock = await withTransaction(async (client) => {
      const { rows: [entry] } = await client.query(
        "SELECT id, product_id, quantity_sold FROM daily_stock_entries WHERE id = $1 AND status = 'active' FOR UPDATE",
        [req.params.id]
      );
      if (!entry) throw new HttpError(404, "Entry tidak ditemukan atau sudah selesai");
      if (quantityIn < entry.quantity_sold) {
        throw new HttpError(400, `Stok masuk tidak boleh kurang dari yang sudah terjual (${entry.quantity_sold})`);
      }
      await client.query(
        "UPDATE daily_stock_entries SET quantity_in = $1, quantity_returned = $1 - quantity_sold, notes = $2 WHERE id = $3",
        [quantityIn, req.body.notes || null, entry.id]
      );
      await refreshPubjStock(client, entry.product_id);
      const { rows: [p] } = await client.query("SELECT stock FROM products WHERE id = $1", [entry.product_id]);
      return p.stock;
    });

    res.json({ message: "Entry berhasil diperbarui", updated_product_stock: stock });
  } catch (error) {
    handleError(res, error, "Error updating daily stock entry:", "Server error updating daily stock entry");
  }
});

router.patch("/:id/paid", authenticateToken, authorizeRole(["cashier", "superadmin"]), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "UPDATE daily_stock_entries SET is_paid = true, paid_at = now() WHERE id = $1",
      [req.params.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: "Entry tidak ditemukan" });
    }
    res.json({ message: "Entry ditandai sudah dibayar" });
  } catch (error) {
    handleError(res, error, "Error marking entry as paid:", "Server error updating payment status");
  }
});

router.post("/end-of-day", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const result = await withTransaction((client) => completeEntries(client, null));
    const [{ today }] = await query("SELECT to_char(current_date, 'YYYY-MM-DD') AS today");
    res.json({
      message: `Auto-completion berhasil: ${result.completed} entry diselesaikan untuk tanggal ${today}`,
      completed_count: result.completed,
      date: today,
      updated_products: result.products
    });
  } catch (error) {
    handleError(res, error, "Error completing end of day:", "Server error completing end of day");
  }
});

router.get("/summary/:date", authenticateToken, async (req, res) => {
  try {
    const [summary] = await query(
      `SELECT
        COUNT(*)::int as total_entries,
        SUM(quantity_in) as total_quantity_in,
        SUM(quantity_sold) as total_quantity_sold,
        SUM(quantity_returned) as total_quantity_returned,
        SUM(total_revenue) as total_revenue,
        SUM(store_fee) as total_store_fee,
        SUM(supplier_earning) as total_supplier_earning,
        COUNT(CASE WHEN is_paid = true THEN 1 END)::int as paid_entries,
        COUNT(CASE WHEN is_paid = false AND status = 'completed' THEN 1 END)::int as unpaid_entries
      FROM daily_stock_entries
      WHERE entry_date = $1`,
      [req.params.date]
    );
    res.json(summary);
  } catch (error) {
    handleError(res, error, "Error fetching daily summary:", "Server error fetching daily summary");
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
    const result = await withTransaction(async (client) => {
      const { rows: [entry] } = await client.query(
        `UPDATE daily_stock_entries
         SET status = 'completed', quantity_returned = quantity_in - quantity_sold
         WHERE id = $1 AND status = 'active'
         RETURNING product_id, quantity_returned, total_revenue, supplier_earning, store_fee`,
        [req.params.id]
      );
      if (!entry) throw new HttpError(404, "Entry tidak ditemukan atau sudah selesai");
      await refreshPubjStock(client, entry.product_id);
      const { rows: [product] } = await client.query("SELECT name, stock FROM products WHERE id = $1", [entry.product_id]);
      return { entry, product };
    });

    res.json({
      message: `Stok harian "${result.product.name}" berhasil diselesaikan`,
      quantity_returned: result.entry.quantity_returned,
      total_revenue: result.entry.total_revenue,
      supplier_earning: result.entry.supplier_earning,
      store_fee: result.entry.store_fee,
      updated_product_stock: result.product.stock
    });
  } catch (error) {
    handleError(res, error, "Error completing daily stock entry:", "Server error completing daily stock entry");
  }
});

router.post("/auto-complete", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const date = req.body.date || null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Format tanggal harus YYYY-MM-DD" });
    }
    const result = await withTransaction((client) => completeEntries(client, date));
    if (result.completed === 0) {
      return res.json({ message: "Tidak ada entry aktif untuk diselesaikan", completed_count: 0 });
    }
    const [{ target }] = await query("SELECT to_char(COALESCE($1::date, current_date), 'YYYY-MM-DD') AS target", [date]);
    res.json({
      message: `Auto-completion berhasil: ${result.completed} entry diselesaikan sampai tanggal ${target}`,
      completed_count: result.completed,
      date: target,
      updated_products: result.products
    });
  } catch (error) {
    handleError(res, error, "Error auto-completing daily stock entries:", "Server error auto-completing daily stock entries");
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
