const express = require("express");
const router = express.Router();
const { query, withTransaction } = require("../models/db");
const { perSaleProfitJoins: taxTotalsJoin, storeProfitJoin, saleTaxesPerItem } = require("../utils/reportSql");
const { validateItems, createSale } = require("../services/checkout");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

router.get("/", authenticateToken, authorizeRole(["superadmin", "cashier"]), async (req, res) => {
  try {
    const sales = await query(`
      SELECT
        s.*,
        u.username AS cashier_name,
        (SELECT string_agg(DISTINCT c.name, ',')
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE si.sale_id = s.id) AS categories,
        COALESCE(st.tax_amount, 0) AS total_tax_amount,
        COALESCE(kp.store_profit, 0) AS total_store_profit
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN (
        SELECT sale_id, SUM(tax_amount) AS tax_amount
        FROM sale_taxes
        GROUP BY sale_id
      ) st ON st.sale_id = s.id
      ${storeProfitJoin}
      ORDER BY s.created_at DESC
    `);
    res.json(sales);
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ message: "Server error fetching sales" });
  }
});

router.get("/chart", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { view } = req.query;

  try {
    let sql;
    if (view === "weekly") {
      sql = `
        SELECT EXTRACT(WEEK FROM created_at)::int AS week, SUM(total_amount) AS total
        FROM sales
        WHERE date_trunc('month', created_at) = date_trunc('month', now())
        GROUP BY 1
        ORDER BY week
      `;
    } else if (view === "daily") {
      sql = `
        SELECT created_at::date AS date, SUM(total_amount) AS total
        FROM sales
        WHERE date_trunc('week', created_at) = date_trunc('week', now())
        GROUP BY 1
        ORDER BY date
      `;
    } else {
      sql = `
        SELECT EXTRACT(MONTH FROM created_at)::int AS month, SUM(total_amount) AS total
        FROM sales
        WHERE date_trunc('year', created_at) = date_trunc('year', now())
        GROUP BY 1
        ORDER BY month
      `;
    }

    const rows = await query(sql);

    let labels = [];
    let values = [];

    if (view === "monthly") {
      labels = rows.map(row => MONTH_NAMES[row.month - 1]);
      values = rows.map(row => parseFloat(row.total));
    } else if (view === "weekly") {
      labels = rows.map(row => `Minggu ${row.week}`);
      values = rows.map(row => parseFloat(row.total));
    } else if (view === "daily") {
      labels = rows.map(row => {
        const [, m, d] = row.date.split("-");
        return `${Number(d)}/${Number(m)}`;
      });
      values = rows.map(row => parseFloat(row.total));
    }

    res.json({ labels, values });
  } catch (error) {
    console.error("Error fetching sales chart data:", error);
    res.status(500).json({ message: "Server error fetching sales chart data" });
  }
});

router.get("/tax-report", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let sql = `
      SELECT
        st.*,
        s.created_at AS sale_date,
        s.customer_name,
        u.username AS cashier_name
      FROM sale_taxes st
      JOIN sales s ON st.sale_id = s.id
      JOIN users u ON s.user_id = u.id
    `;

    const params = [];

    if (start_date && end_date) {
      sql += " WHERE s.created_at::date BETWEEN $1 AND $2";
      params.push(start_date, end_date);
    }

    sql += " ORDER BY s.created_at DESC";

    const taxReport = await query(sql, params);

    const summary = {
      total_gross_amount: 0,
      total_tax_amount: 0,
      total_store_profit: 0,
      total_supplier_amount: 0,
      total_transactions: taxReport.length
    };

    taxReport.forEach(record => {
      summary.total_gross_amount += parseFloat(record.gross_amount);
      summary.total_tax_amount += parseFloat(record.tax_amount);
      summary.total_store_profit += parseFloat(record.store_profit);
      summary.total_supplier_amount += parseFloat(record.supplier_amount);
    });

    res.json({
      summary,
      details: taxReport
    });
  } catch (error) {
    console.error("Error fetching tax report:", error);
    res.status(500).json({ message: "Server error fetching tax report" });
  }
});

router.get("/revenue", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const monthlyDateFilter = req.query.all_months === "true"
      ? ""
      : "WHERE s.created_at >= now() - interval '12 months'";

    const dailyRevenue = await query(`
      SELECT
        to_char(s.created_at, 'YYYY-MM-DD') AS date,
        SUM(s.total_amount) AS total_revenue,
        COALESCE(SUM(kp.store_profit), 0) AS store_profit,
        COALESCE(SUM(st.supplier_amount), 0) AS supplier_profit,
        COUNT(s.id) AS transaction_count
      FROM sales s
      ${taxTotalsJoin}
      WHERE s.created_at >= now() - interval '30 days'
      GROUP BY to_char(s.created_at, 'YYYY-MM-DD')
      ORDER BY date DESC
    `);

    const weeklyRevenue = await query(`
      SELECT
        EXTRACT(YEAR FROM s.created_at)::int AS year,
        EXTRACT(WEEK FROM s.created_at)::int AS week,
        SUM(s.total_amount) AS total_revenue,
        COALESCE(SUM(kp.store_profit), 0) AS store_profit,
        COALESCE(SUM(st.supplier_amount), 0) AS supplier_profit,
        COUNT(s.id) AS transaction_count
      FROM sales s
      ${taxTotalsJoin}
      WHERE s.created_at >= now() - interval '12 weeks'
      GROUP BY 1, 2
      ORDER BY year DESC, week DESC
    `);

    const monthlyRevenue = await query(`
      SELECT
        EXTRACT(YEAR FROM s.created_at)::int AS year,
        EXTRACT(MONTH FROM s.created_at)::int AS month,
        SUM(s.total_amount) AS total_revenue,
        COALESCE(SUM(kp.store_profit), 0) AS store_profit,
        COALESCE(SUM(st.supplier_amount), 0) AS supplier_profit,
        COUNT(s.id) AS transaction_count
      FROM sales s
      ${taxTotalsJoin}
      ${monthlyDateFilter}
      GROUP BY 1, 2
      ORDER BY year DESC, month DESC
    `);

    const yearlyRevenue = await query(`
      SELECT
        EXTRACT(YEAR FROM s.created_at)::int AS year,
        SUM(s.total_amount) AS total_revenue,
        COALESCE(SUM(kp.store_profit), 0) AS store_profit,
        COALESCE(SUM(st.supplier_amount), 0) AS supplier_profit,
        COUNT(s.id) AS transaction_count
      FROM sales s
      ${taxTotalsJoin}
      GROUP BY 1
      ORDER BY year DESC
    `);

    res.json({
      daily: dailyRevenue,
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      yearly: yearlyRevenue
    });
  } catch (error) {
    console.error("Error fetching revenue data:", error);
    res.status(500).json({ message: "Server error fetching revenue data" });
  }
});

router.get("/revenue/detail", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { type, date } = req.query;

  if (!type || !date) {
    return res.status(400).json({ message: "Type and date parameters are required" });
  }

  let whereClause;
  let params;
  switch (type) {
    case "daily":
      whereClause = "to_char(s.created_at, 'YYYY-MM-DD') = $1";
      params = [date];
      break;
    case "weekly": {
      const [year, week] = date.split("-W");
      whereClause = "EXTRACT(YEAR FROM s.created_at)::int = $1 AND EXTRACT(WEEK FROM s.created_at)::int = $2";
      params = [parseInt(year), parseInt(week)];
      break;
    }
    case "monthly": {
      const [year, month] = date.split("-");
      whereClause = "EXTRACT(YEAR FROM s.created_at)::int = $1 AND EXTRACT(MONTH FROM s.created_at)::int = $2";
      params = [parseInt(year), parseInt(month)];
      break;
    }
    case "yearly":
      whereClause = "EXTRACT(YEAR FROM s.created_at)::int = $1";
      params = [parseInt(date)];
      break;
    default:
      return res.status(400).json({ message: "Invalid type parameter" });
  }

  if (params.some(Number.isNaN)) {
    return res.status(400).json({ message: "Invalid date parameter" });
  }

  try {
    const details = await query(`
      SELECT
        s.created_at AS waktu,
        s.payment_method,
        COALESCE(p.name, 'Produk Dihapus') AS produk,
        COALESCE(c.name, 'Tidak Berkategori') AS kategori,
        COALESCE(c.is_reseller, false) AS is_reseller,
        si.quantity AS jumlah,
        si.price_at_sale AS harga,
        (si.quantity * si.price_at_sale) AS total,
        u.username AS kasir,
        COALESCE(st.store_profit, si.quantity * si.price_at_sale) AS keuntungan_toko,
        COALESCE(st.supplier_amount, 0) AS keuntungan_supplier
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      ${saleTaxesPerItem}
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
    `, params);

    res.json(details);
  } catch (error) {
    console.error("Error fetching detailed revenue data:", error);
    res.status(500).json({ message: "Server error fetching detailed revenue data" });
  }
});

router.get("/:id", authenticateToken, authorizeRole(["superadmin", "cashier"]), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(404).json({ message: "Sale not found" });

  try {
    const saleRows = await query("SELECT * FROM sales WHERE id = $1", [id]);
    if (saleRows.length === 0) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const itemRows = await query(`
      SELECT si.*, p.name AS product_name, p.price AS product_price
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
    `, [id]);

    res.json({
      ...saleRows[0],
      items: itemRows
    });
  } catch (error) {
    console.error("Error fetching sale details:", error);
    res.status(500).json({ message: "Server error fetching sale details" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  const { items, customer_name = "Umum", payment_method = "Cash" } = req.body;
  const problem = validateItems(items);
  if (problem) return res.status(400).json({ message: problem });

  try {
    const sale = await withTransaction((client) =>
      createSale(client, {
        items,
        customerName: String(customer_name).trim() || "Umum",
        paymentMethod: String(payment_method),
        user: { id: req.user.id, username: req.user.username }
      })
    );
    res.status(201).json({ message: "Sale completed successfully", sale_id: sale.id, total_amount: sale.total });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Error creating sale:", error);
    res.status(500).json({ message: "Server error creating sale" });
  }
});

module.exports = router;
