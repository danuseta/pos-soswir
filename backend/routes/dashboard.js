const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [todayStats] = await connection.query(`
      SELECT 
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as revenue 
      FROM sales 
      WHERE DATE(created_at) = CURDATE()
    `);

    const [totalStats] = await connection.query(`
      SELECT 
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as revenue 
      FROM sales
    `);

    const [todayStoreProfit] = await connection.query(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN c.is_reseller = 0 THEN si.quantity * si.price_at_sale
            ELSE 0
          END
        ), 0) as non_pubj_profit,
        COALESCE(SUM(
          CASE 
            WHEN c.is_reseller = 1 THEN st.store_profit
            ELSE 0
          END
        ), 0) as pubj_tax_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN sale_taxes st ON si.sale_id = st.sale_id AND si.product_id = st.product_id
      WHERE DATE(s.created_at) = CURDATE()
    `);

    const [totalStoreProfit] = await connection.query(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN c.is_reseller = 0 THEN si.quantity * si.price_at_sale
            ELSE 0
          END
        ), 0) as non_pubj_profit,
        COALESCE(SUM(
          CASE 
            WHEN c.is_reseller = 1 THEN st.store_profit
            ELSE 0
          END
        ), 0) as pubj_tax_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN sale_taxes st ON si.sale_id = st.sale_id AND si.product_id = st.product_id
    `);

    const [todaySupplierProfit] = await connection.query(`
      SELECT 
        COALESCE(SUM(st.supplier_amount), 0) as supplier_profit
      FROM sale_taxes st
      JOIN sales s ON st.sale_id = s.id
      WHERE DATE(s.created_at) = CURDATE()
    `);

    const [totalSupplierProfit] = await connection.query(`
      SELECT 
        COALESCE(SUM(st.supplier_amount), 0) as supplier_profit
      FROM sale_taxes st
    `);

    const [productCount] = await connection.query(`SELECT COUNT(*) as count FROM products`);
    const [categoryCount] = await connection.query(`SELECT COUNT(*) as count FROM categories`);
    const [totalCashiers] = await connection.query(`SELECT COUNT(*) as count FROM users WHERE role = 'cashier'`);
    const [activeCashiers] = await connection.query(`SELECT COUNT(*) as count FROM users WHERE role = 'cashier' AND is_active = 1`);

    const [salesTrend] = await connection.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as transactions
      FROM sales 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const [categoryStats] = await connection.query(`
      SELECT 
        c.id,
        c.name,
        c.is_reseller,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(si.quantity * si.price_at_sale), 0) as total_revenue,
        COALESCE(SUM(st.tax_amount), 0) as total_tax_amount,
        COALESCE(SUM(st.supplier_amount), 0) as total_supplier_amount
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      LEFT JOIN sale_taxes st ON si.sale_id = st.sale_id AND si.product_id = st.product_id
      GROUP BY c.id, c.name, c.is_reseller
      ORDER BY total_revenue DESC
    `);

    const [recentTransactions] = await connection.query(`
      SELECT 
        s.*,
        u.username as cashier_name,
        GROUP_CONCAT(DISTINCT c.name) as categories
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      GROUP BY s.id
      ORDER BY s.created_at DESC 
      LIMIT 10
    `);

    const [recentActivities] = await connection.query(`
      SELECT 
        ua.*,
        u.username
      FROM user_activities ua
      LEFT JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC
    `);

    const [topProducts] = await connection.query(`
      SELECT 
        p.id,
        p.name,
        p.tax_percentage,
        c.is_reseller,
        SUM(si.quantity) as total_sold,
        SUM(si.quantity * si.price_at_sale) as total_revenue,
        COALESCE(SUM(st.store_profit), 0) as store_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON si.sale_id = s.id
      LEFT JOIN sale_taxes st ON si.sale_id = st.sale_id AND si.product_id = st.product_id
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY p.id, p.name, p.tax_percentage, c.is_reseller
      ORDER BY total_sold DESC
      LIMIT 10
    `);

    connection.release();

    const todayStoreProfitTotal = parseFloat(todayStoreProfit[0]?.non_pubj_profit || 0) + parseFloat(todayStoreProfit[0]?.pubj_tax_profit || 0);
    const totalStoreProfitTotal = parseFloat(totalStoreProfit[0]?.non_pubj_profit || 0) + parseFloat(totalStoreProfit[0]?.pubj_tax_profit || 0);

    res.json({
      todayStats: {
        transactions: parseInt(todayStats[0]?.transactions || 0),
        revenue: parseFloat(todayStats[0]?.revenue || 0),
        storeProfit: todayStoreProfitTotal,
        supplierProfit: parseFloat(todaySupplierProfit[0]?.supplier_profit || 0)
      },
      totalStats: {
        transactions: parseInt(totalStats[0]?.transactions || 0),
        revenue: parseFloat(totalStats[0]?.revenue || 0),
        storeProfit: totalStoreProfitTotal,
        supplierProfit: parseFloat(totalSupplierProfit[0]?.supplier_profit || 0)
      },
      totals: {
        products: parseInt(productCount[0]?.count || 0),
        categories: parseInt(categoryCount[0]?.count || 0),
        totalCashiers: parseInt(totalCashiers[0]?.count || 0),
        activeCashiers: parseInt(activeCashiers[0]?.count || 0)
      },
      salesTrend: salesTrend.map(item => ({
        date: item.date,
        revenue: parseFloat(item.revenue || 0),
        transactions: parseInt(item.transactions || 0)
      })),
      categoryStats: categoryStats || [],
      recentTransactions: recentTransactions || [],
      recentActivities: recentActivities || [],
      topProducts: topProducts || []
    });

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Server error fetching dashboard data" });
  }
});

router.get("/cashier", authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const userId = req.user.id;

    const [todaySales] = await connection.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM sales 
      WHERE user_id = ? AND DATE(created_at) = CURDATE()
    `, [userId]);

    const [monthSales] = await connection.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM sales 
      WHERE user_id = ? AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
    `, [userId]);

    const [totalSales] = await connection.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM sales 
      WHERE user_id = ?
    `, [userId]);

    const [recentSales] = await connection.query(`
      SELECT s.*, u.username as cashier_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC 
      LIMIT 10
    `, [userId]);

    const [lowStockProducts] = await connection.query(`
      SELECT id, name, stock, price 
      FROM products 
      WHERE stock <= 10 
      ORDER BY stock ASC 
      LIMIT 10
    `);

    const [topProducts] = await connection.query(`
      SELECT 
        p.id, 
        p.name, 
        SUM(si.quantity) as total_sold,
        SUM(si.quantity * si.price_at_sale) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.user_id = ? AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 5
    `, [userId]);

    const [pubjStock] = await connection.query(`
      SELECT 
        dse.id,
        dse.entry_date as tanggal,
        p.name as produk,
        sup.name as nama_supplier,
        dse.quantity_in as stok_masuk,
        dse.quantity_sold as terjual,
        dse.quantity_returned as sisa,
        dse.supplier_earning as pendapatan_supplier,
        dse.status
      FROM daily_stock_entries dse
      JOIN products p ON dse.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN suppliers sup ON dse.supplier_id = sup.id
      WHERE c.is_reseller = 1 AND dse.entry_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY dse.entry_date DESC, p.name ASC
      LIMIT 20
    `);

    const [productCount] = await connection.query(`SELECT COUNT(*) as count FROM products`);

    connection.release();

    res.json({
      todayStats: {
        transactions: parseInt(todaySales[0]?.count || 0),
        revenue: parseFloat(todaySales[0]?.total || 0)
      },
      monthStats: {
        transactions: parseInt(monthSales[0]?.count || 0),
        revenue: parseFloat(monthSales[0]?.total || 0)
      },
      totalStats: {
        transactions: parseInt(totalSales[0]?.count || 0),
        revenue: parseFloat(totalSales[0]?.total || 0)
      },
      totals: {
        products: parseInt(productCount[0]?.count || 0),
        lowStockProducts: lowStockProducts?.length || 0
      },
      recentSales: recentSales || [],
      lowStockProducts: lowStockProducts || [],
      topProducts: topProducts || [],
      pubjStock: pubjStock || []
    });

  } catch (error) {
    console.error("Error fetching cashier dashboard data:", error);
    res.status(500).json({ message: "Server error fetching dashboard data" });
  }
});

router.get("/revenue", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const [dailyRevenue] = await connection.query(`
      SELECT 
        DATE(s.created_at) as periode,
        SUM(s.total_amount) as total_pendapatan,
        COALESCE(SUM(st.store_profit), 0) as keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) as keuntungan_supplier,
        COUNT(s.id) as jumlah_transaksi
      FROM sales s
      LEFT JOIN sale_taxes st ON s.id = st.sale_id
      WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(s.created_at)
      ORDER BY DATE(s.created_at) DESC
    `);
    
    const [weeklyRevenue] = await connection.query(`
      SELECT 
        CONCAT('Minggu ', WEEK(s.created_at, 1) - WEEK(DATE_SUB(s.created_at, INTERVAL DAYOFMONTH(s.created_at) - 1 DAY), 1) + 1, ' - ', MONTHNAME(s.created_at), ' ', YEAR(s.created_at)) as periode,
        WEEK(s.created_at, 1) as week_number,
        YEAR(s.created_at) as year,
        SUM(s.total_amount) as total_pendapatan,
        COALESCE(SUM(st.store_profit), 0) as keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) as keuntungan_supplier,
        COUNT(s.id) as jumlah_transaksi
      FROM sales s
      LEFT JOIN sale_taxes st ON s.id = st.sale_id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
      GROUP BY WEEK(s.created_at, 1), YEAR(s.created_at)
      ORDER BY YEAR(s.created_at) DESC, WEEK(s.created_at, 1) DESC
    `);
    
    const [monthlyRevenue] = await connection.query(`
      SELECT 
        CONCAT(MONTHNAME(s.created_at), ' ', YEAR(s.created_at)) as periode,
        MONTH(s.created_at) as month,
        YEAR(s.created_at) as year,
        SUM(s.total_amount) as total_pendapatan,
        COALESCE(SUM(st.store_profit), 0) as keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) as keuntungan_supplier,
        COUNT(s.id) as jumlah_transaksi
      FROM sales s
      LEFT JOIN sale_taxes st ON s.id = st.sale_id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY MONTH(s.created_at), YEAR(s.created_at)
      ORDER BY YEAR(s.created_at) DESC, MONTH(s.created_at) DESC
    `);
    
    const [yearlyRevenue] = await connection.query(`
      SELECT 
        YEAR(s.created_at) as periode,
        SUM(s.total_amount) as total_pendapatan,
        COALESCE(SUM(st.store_profit), 0) as keuntungan_toko,
        COALESCE(SUM(st.supplier_amount), 0) as keuntungan_supplier,
        COUNT(s.id) as jumlah_transaksi
      FROM sales s
      LEFT JOIN sale_taxes st ON s.id = st.sale_id
      GROUP BY YEAR(s.created_at)
      ORDER BY YEAR(s.created_at) DESC
    `);
    
    connection.release();
    
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
  try {
    const { period_type, period_value, year } = req.query;
    
    if (!period_type || !period_value) {
      return res.status(400).json({ message: "period_type and period_value are required" });
    }
    
    const connection = await pool.getConnection();
    let whereClause = "";
    let params = [];
    
    switch (period_type) {
      case 'daily':
        whereClause = "WHERE DATE(s.created_at) = ?";
        params = [period_value];
        break;
      case 'weekly':
        whereClause = "WHERE WEEK(s.created_at, 1) = ? AND YEAR(s.created_at) = ?";
        params = [period_value, year || new Date().getFullYear()];
        break;
      case 'monthly':
        whereClause = "WHERE MONTH(s.created_at) = ? AND YEAR(s.created_at) = ?";
        params = [period_value, year || new Date().getFullYear()];
        break;
      case 'yearly':
        whereClause = "WHERE YEAR(s.created_at) = ?";
        params = [period_value];
        break;
      default:
        return res.status(400).json({ message: "Invalid period_type" });
    }
    
    const [details] = await connection.query(`
      SELECT 
        s.created_at as waktu,
        si.product_id,
        p.name as produk,
        COALESCE(c.name, 'Tidak Berkategori') as kategori,
        c.is_reseller as is_pubj,
        si.quantity as jumlah,
        si.price_at_sale as harga,
        (si.quantity * si.price_at_sale) as total,
        CASE 
          WHEN c.is_reseller = 1 THEN st.store_profit
          ELSE (si.quantity * si.price_at_sale)
        END as keuntungan_toko,
        CASE 
          WHEN c.is_reseller = 1 THEN st.supplier_amount
          ELSE 0
        END as keuntungan_supplier,
        u.username as kasir
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sale_taxes st ON s.id = st.sale_id AND si.product_id = st.product_id
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
    `, params);
    
    connection.release();
    res.json(details);
  } catch (error) {
    console.error("Error fetching detailed revenue:", error);
    res.status(500).json({ message: "Server error fetching detailed revenue" });
  }
});

module.exports = router;
