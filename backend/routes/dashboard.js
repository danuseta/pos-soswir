const express = require("express");
const { query } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const { perSaleProfitJoins, saleTaxesPerItem } = require("../utils/reportSql");

const router = express.Router();

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const saleTaxesPerSale = perSaleProfitJoins;

const storeProfitSql = (dateFilter) => `
  SELECT COALESCE(SUM(
    COALESCE(st.store_profit, si.quantity * si.price_at_sale)
  ), 0) AS store_profit
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  ${saleTaxesPerItem}
  ${dateFilter}
`;

router.get("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const [todayStats] = await query(`
      SELECT
        COUNT(*) AS transactions,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM sales
      WHERE created_at::date = current_date
    `);

    const [totalStats] = await query(`
      SELECT
        COUNT(*) AS transactions,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM sales
    `);

    const [todayStoreProfit] = await query(storeProfitSql("WHERE s.created_at::date = current_date"));
    const [totalStoreProfit] = await query(storeProfitSql(""));

    const [todaySupplierProfit] = await query(`
      SELECT COALESCE(SUM(st.supplier_amount), 0) AS supplier_profit
      FROM sale_taxes st
      JOIN sales s ON st.sale_id = s.id
      WHERE s.created_at::date = current_date
    `);

    const [totalSupplierProfit] = await query(`
      SELECT COALESCE(SUM(st.supplier_amount), 0) AS supplier_profit
      FROM sale_taxes st
    `);

    const [productCount] = await query("SELECT COUNT(*) AS count FROM products");
    const [categoryCount] = await query("SELECT COUNT(*) AS count FROM categories");
    const [totalCashiers] = await query("SELECT COUNT(*) AS count FROM users WHERE role = 'cashier'");
    const [activeCashiers] = await query("SELECT COUNT(*) AS count FROM users WHERE role = 'cashier' AND is_active = true");

    const salesTrend = await query(`
      SELECT
        created_at::date AS date,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS transactions
      FROM sales
      WHERE created_at >= now() - interval '7 days'
      GROUP BY created_at::date
      ORDER BY date ASC
    `);

    const categoryStats = await query(`
      SELECT
        c.id,
        c.name,
        c.is_reseller,
        COUNT(DISTINCT p.id) AS product_count,
        COALESCE(SUM(x.revenue), 0) AS total_revenue,
        COALESCE(SUM(x.tax_amount), 0) AS total_tax_amount,
        COALESCE(SUM(x.supplier_amount), 0) AS total_supplier_amount
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN (
        SELECT si.product_id,
               si.quantity * si.price_at_sale AS revenue,
               COALESCE(st.tax_amount, 0) AS tax_amount,
               COALESCE(st.supplier_amount, 0) AS supplier_amount
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id AND s.created_at >= now() - interval '30 days'
        ${saleTaxesPerItem}
      ) x ON x.product_id = p.id
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `);

    const recentTransactions = await query(`
      SELECT
        s.*,
        u.username AS cashier_name,
        (SELECT string_agg(DISTINCT c.name, ',')
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE si.sale_id = s.id) AS categories
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 10
    `);

    const recentActivities = await query(`
      SELECT
        ua.*,
        u.username
      FROM user_activities ua
      LEFT JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC
      LIMIT 50
    `);

    const topProducts = await query(`
      SELECT
        p.id,
        p.name,
        p.tax_percentage,
        c.is_reseller,
        SUM(si.quantity) AS total_sold,
        SUM(si.quantity * si.price_at_sale) AS total_revenue,
        COALESCE(SUM(st.store_profit), 0) AS store_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      ${saleTaxesPerItem}
      WHERE s.created_at >= now() - interval '30 days'
      GROUP BY p.id, c.is_reseller
      ORDER BY total_sold DESC
      LIMIT 10
    `);

    res.json({
      todayStats: {
        transactions: parseInt(todayStats?.transactions || 0),
        revenue: parseFloat(todayStats?.revenue || 0),
        storeProfit: parseFloat(todayStoreProfit?.store_profit || 0),
        supplierProfit: parseFloat(todaySupplierProfit?.supplier_profit || 0)
      },
      totalStats: {
        transactions: parseInt(totalStats?.transactions || 0),
        revenue: parseFloat(totalStats?.revenue || 0),
        storeProfit: parseFloat(totalStoreProfit?.store_profit || 0),
        supplierProfit: parseFloat(totalSupplierProfit?.supplier_profit || 0)
      },
      totals: {
        products: parseInt(productCount?.count || 0),
        categories: parseInt(categoryCount?.count || 0),
        totalCashiers: parseInt(totalCashiers?.count || 0),
        activeCashiers: parseInt(activeCashiers?.count || 0)
      },
      salesTrend: salesTrend.map(item => ({
        date: item.date,
        revenue: parseFloat(item.revenue || 0),
        transactions: parseInt(item.transactions || 0)
      })),
      categoryStats,
      recentTransactions,
      recentActivities,
      topProducts
    });

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Server error fetching dashboard data" });
  }
});

router.get("/cashier", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [todaySales] = await query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
      FROM sales
      WHERE user_id = $1 AND created_at::date = current_date
    `, [userId]);

    const [monthSales] = await query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
      FROM sales
      WHERE user_id = $1 AND date_trunc('month', created_at) = date_trunc('month', now())
    `, [userId]);

    const [totalSales] = await query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
      FROM sales
      WHERE user_id = $1
    `, [userId]);

    const recentSales = await query(`
      SELECT s.*, u.username AS cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 10
    `, [userId]);

    const lowStockProducts = await query(`
      SELECT id, name, stock, price
      FROM products
      WHERE stock <= 10
      ORDER BY stock ASC
      LIMIT 10
    `);

    const topProducts = await query(`
      SELECT
        p.id,
        p.name,
        SUM(si.quantity) AS total_sold,
        SUM(si.quantity * si.price_at_sale) AS total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.user_id = $1 AND s.created_at >= now() - interval '30 days'
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 5
    `, [userId]);

    const pubjStock = await query(`
      SELECT
        dse.id,
        dse.entry_date AS tanggal,
        p.name AS produk,
        sup.name AS nama_supplier,
        dse.quantity_in AS stok_masuk,
        dse.quantity_sold AS terjual,
        dse.quantity_returned AS sisa,
        dse.supplier_earning AS pendapatan_supplier,
        dse.status
      FROM daily_stock_entries dse
      JOIN products p ON dse.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN suppliers sup ON dse.supplier_id = sup.id
      WHERE c.is_reseller = true AND dse.entry_date >= current_date - 30
      ORDER BY dse.entry_date DESC, p.name ASC
      LIMIT 20
    `);

    const [productCount] = await query("SELECT COUNT(*) AS count FROM products");

    res.json({
      todayStats: {
        transactions: parseInt(todaySales?.count || 0),
        revenue: parseFloat(todaySales?.total || 0)
      },
      monthStats: {
        transactions: parseInt(monthSales?.count || 0),
        revenue: parseFloat(monthSales?.total || 0)
      },
      totalStats: {
        transactions: parseInt(totalSales?.count || 0),
        revenue: parseFloat(totalSales?.total || 0)
      },
      totals: {
        products: parseInt(productCount?.count || 0),
        lowStockProducts: lowStockProducts.length
      },
      recentSales,
      lowStockProducts,
      topProducts,
      pubjStock
    });

  } catch (error) {
    console.error("Error fetching cashier dashboard data:", error);
    res.status(500).json({ message: "Server error fetching dashboard data" });
  }
});

router.get("/revenue", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const dailyRevenue = await query(`
      SELECT
        s.created_at::date AS periode,
        SUM(s.total_amount) AS total_pendapatan,
        COALESCE(SUM(kp.store_profit), 0) AS keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) AS keuntungan_supplier,
        COUNT(s.id) AS jumlah_transaksi
      FROM sales s
      ${saleTaxesPerSale}
      WHERE s.created_at::date >= current_date - 30
      GROUP BY s.created_at::date
      ORDER BY s.created_at::date DESC
    `);

    const weeklyRows = await query(`
      SELECT
        EXTRACT(DAY FROM MIN(s.created_at))::int AS first_day,
        EXTRACT(MONTH FROM MIN(s.created_at))::int AS first_month,
        EXTRACT(WEEK FROM s.created_at)::int AS week_number,
        EXTRACT(YEAR FROM s.created_at)::int AS year,
        SUM(s.total_amount) AS total_pendapatan,
        COALESCE(SUM(kp.store_profit), 0) AS keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) AS keuntungan_supplier,
        COUNT(s.id) AS jumlah_transaksi
      FROM sales s
      ${saleTaxesPerSale}
      WHERE s.created_at >= current_date - interval '12 weeks'
      GROUP BY EXTRACT(WEEK FROM s.created_at), EXTRACT(YEAR FROM s.created_at)
      ORDER BY year DESC, week_number DESC
    `);
    const weeklyRevenue = weeklyRows.map(({ first_day, first_month, ...row }) => ({
      periode: `Minggu ${Math.floor((first_day - 1) / 7) + 1} - ${MONTH_NAMES[first_month - 1]} ${row.year}`,
      ...row
    }));

    const monthlyRows = await query(`
      SELECT
        EXTRACT(MONTH FROM s.created_at)::int AS month,
        EXTRACT(YEAR FROM s.created_at)::int AS year,
        SUM(s.total_amount) AS total_pendapatan,
        COALESCE(SUM(kp.store_profit), 0) AS keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) AS keuntungan_supplier,
        COUNT(s.id) AS jumlah_transaksi
      FROM sales s
      ${saleTaxesPerSale}
      WHERE s.created_at >= current_date - interval '12 months'
      GROUP BY 1, 2
      ORDER BY year DESC, month DESC
    `);
    const monthlyRevenue = monthlyRows.map(row => ({
      periode: `${MONTH_NAMES[row.month - 1]} ${row.year}`,
      ...row
    }));

    const yearlyRevenue = await query(`
      SELECT
        EXTRACT(YEAR FROM s.created_at)::int AS periode,
        SUM(s.total_amount) AS total_pendapatan,
        COALESCE(SUM(kp.store_profit), 0) AS keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) AS keuntungan_supplier,
        COUNT(s.id) AS jumlah_transaksi
      FROM sales s
      ${saleTaxesPerSale}
      GROUP BY 1
      ORDER BY periode DESC
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
  const { period_type, period_value, year } = req.query;

  if (!period_type || !period_value) {
    return res.status(400).json({ message: "period_type and period_value are required" });
  }

  const currentYear = year || new Date().getFullYear();
  let whereClause;
  let params;
  switch (period_type) {
    case "daily":
      whereClause = "WHERE s.created_at::date = $1";
      params = [period_value];
      break;
    case "weekly":
      whereClause = "WHERE EXTRACT(WEEK FROM s.created_at)::int = $1 AND EXTRACT(YEAR FROM s.created_at)::int = $2";
      params = [parseInt(period_value), parseInt(currentYear)];
      break;
    case "monthly":
      whereClause = "WHERE EXTRACT(MONTH FROM s.created_at)::int = $1 AND EXTRACT(YEAR FROM s.created_at)::int = $2";
      params = [parseInt(period_value), parseInt(currentYear)];
      break;
    case "yearly":
      whereClause = "WHERE EXTRACT(YEAR FROM s.created_at)::int = $1";
      params = [parseInt(period_value)];
      break;
    default:
      return res.status(400).json({ message: "Invalid period_type" });
  }

  if (period_type !== "daily" && params.some(Number.isNaN)) {
    return res.status(400).json({ message: "Invalid period_value" });
  }

  try {
    const details = await query(`
      SELECT
        s.created_at AS waktu,
        si.product_id,
        p.name AS produk,
        COALESCE(c.name, 'Tidak Berkategori') AS kategori,
        c.is_reseller AS is_pubj,
        si.quantity AS jumlah,
        si.price_at_sale AS harga,
        (si.quantity * si.price_at_sale) AS total,
        COALESCE(st.store_profit, si.quantity * si.price_at_sale) AS keuntungan_toko,
        COALESCE(st.supplier_amount, 0) AS keuntungan_supplier,
        u.username AS kasir
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${saleTaxesPerItem}
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
    `, params);

    res.json(details);
  } catch (error) {
    console.error("Error fetching detailed revenue:", error);
    res.status(500).json({ message: "Server error fetching detailed revenue" });
  }
});

module.exports = router;
