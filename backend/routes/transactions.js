const express = require("express");
const { query } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

const profitColumns = `
  tl.id,
  tl.created_at AS waktu,
  tl.product_name AS produk,
  COALESCE(c.name, 'Tidak Berkategori') AS kategori,
  COALESCE(c.is_reseller, false) AS is_reseller,
  tl.quantity AS jumlah,
  tl.price AS harga,
  tl.total AS total,
  tl.username AS kasir,
  s.payment_method,
  CASE
    WHEN st.sale_id IS NOT NULL THEN st.store_profit
    ELSE tl.total
  END AS keuntungan_toko,
  COALESCE(st.supplier_amount, 0) AS keuntungan_supplier
`;

const profitJoins = `
  FROM transaction_logs tl
  LEFT JOIN products p ON tl.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN sales s ON tl.sale_id = s.id
  LEFT JOIN (
    SELECT sale_id, product_id,
           SUM(store_profit) AS store_profit,
           SUM(supplier_amount) AS supplier_amount
    FROM sale_taxes
    GROUP BY sale_id, product_id
  ) st ON st.sale_id = tl.sale_id AND st.product_id IS NOT DISTINCT FROM tl.product_id
`;

router.get("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        tl.sale_id,
        tl.product_id,
        to_char(tl.created_at, 'YYYY-MM') AS periode,
        ${profitColumns}
      ${profitJoins}
      ORDER BY tl.created_at DESC
    `);

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
    const rows = await query(`
      SELECT
        tl.id,
        tl.created_at AS waktu,
        tl.product_name AS produk,
        COALESCE(c.name, 'Tidak Berkategori') AS kategori,
        tl.quantity AS jumlah,
        tl.price AS harga,
        tl.total AS total,
        tl.username AS kasir
      FROM transaction_logs tl
      LEFT JOIN products p ON tl.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE tl.created_at::date BETWEEN $1 AND $2
      ORDER BY tl.created_at DESC
    `, [startDate, endDate]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching transaction logs by date:", error);
    res.status(500).json({ message: "Server error fetching transaction logs" });
  }
});

router.get("/byuser/:userId", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { userId } = req.params;

  try {
    const rows = await query(`
      SELECT tl.*
      FROM transaction_logs tl
      WHERE tl.user_id = $1
      ORDER BY tl.created_at DESC
    `, [userId]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching transaction logs by user:", error);
    res.status(500).json({ message: "Server error fetching transaction logs" });
  }
});

router.get("/cashier", authenticateToken, authorizeRole(["cashier"]), async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        ${profitColumns}
      ${profitJoins}
      WHERE tl.user_id = $1
      ORDER BY tl.created_at DESC
    `, [req.user.id]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching cashier transactions:", error);
    res.status(500).json({ message: "Server error fetching transactions" });
  }
});

module.exports = router;
