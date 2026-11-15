const express = require("express");
const router = express.Router();
const { pool, withTransaction } = require("../models/db");
const { validateItems, createSale } = require("../services/checkout");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRole(["superadmin", "cashier"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [sales] = await connection.query(`
      SELECT 
        s.*,
        u.username as cashier_name,
        GROUP_CONCAT(DISTINCT c.name) as categories,
        COALESCE(SUM(st.tax_amount), 0) as total_tax_amount,
        COALESCE(SUM(st.store_profit), 0) as total_store_profit
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sale_taxes st ON s.id = st.sale_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    
    connection.release();
    res.json(sales);
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ message: "Server error fetching sales" });
  }
});

router.get("/chart", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { view } = req.query;
  
  try {
    const connection = await pool.getConnection();
    let query = "";
    
    if (view === "monthly") {
      query = `
        SELECT 
          MONTH(created_at) as month,
          SUM(total_amount) as total
        FROM sales
        WHERE YEAR(created_at) = YEAR(CURRENT_DATE())
        GROUP BY MONTH(created_at)
        ORDER BY month
      `;
    } else if (view === "weekly") {
      query = `
        SELECT 
          WEEK(created_at) as week,
          SUM(total_amount) as total
        FROM sales
        WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        GROUP BY WEEK(created_at)
        ORDER BY week
      `;
    } else if (view === "daily") {
      query = `
        SELECT 
          DATE(created_at) as date,
          SUM(total_amount) as total
        FROM sales
        WHERE WEEK(created_at) = WEEK(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
    } else {
      query = `
        SELECT 
          MONTH(created_at) as month,
          SUM(total_amount) as total
        FROM sales
        WHERE YEAR(created_at) = YEAR(CURRENT_DATE())
        GROUP BY MONTH(created_at)
        ORDER BY month
      `;
    }
    
    const [rows] = await connection.query(query);
    connection.release();
    
    let labels = [];
    let values = [];
    
    if (view === "monthly") {
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      labels = rows.map(row => monthNames[row.month - 1]);
      values = rows.map(row => parseFloat(row.total));
    } else if (view === "weekly") {
      labels = rows.map(row => `Minggu ${row.week}`);
      values = rows.map(row => parseFloat(row.total));
    } else if (view === "daily") {
      labels = rows.map(row => {
        const date = new Date(row.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
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
    
    const connection = await pool.getConnection();
    
    let query = `
      SELECT 
        st.*,
        s.created_at as sale_date,
        s.customer_name,
        u.username as cashier_name
      FROM sale_taxes st
      JOIN sales s ON st.sale_id = s.id
      JOIN users u ON s.user_id = u.id
    `;
    
    const params = [];
    
    if (start_date && end_date) {
      query += ` WHERE DATE(s.created_at) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }
    
    query += ` ORDER BY s.created_at DESC`;
    
    const [taxReport] = await connection.query(query, params);
    
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
    
    connection.release();
    
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
    const connection = await pool.getConnection();
    const monthlyDateFilter = req.query.all_months === "true"
      ? ""
      : "WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)";
    const taxTotalsJoin = `
      LEFT JOIN (
        SELECT
          sale_id,
          SUM(store_profit) AS store_profit,
          SUM(supplier_amount) AS supplier_amount
        FROM sale_taxes
        GROUP BY sale_id
      ) st ON s.id = st.sale_id
    `;
    
    const [dailyRevenue] = await connection.query(`
      SELECT 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as date,
        SUM(s.total_amount) as total_revenue,
        COALESCE(SUM(st.store_profit), 0) as store_profit,
        COALESCE(SUM(st.supplier_amount), 0) as supplier_profit,
        COUNT(s.id) as transaction_count
      FROM sales s
      ${taxTotalsJoin}
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m-%d')
      ORDER BY date DESC
    `);

    const [weeklyRevenue] = await connection.query(`
      SELECT 
        YEAR(s.created_at) as year,
        WEEK(s.created_at, 1) as week,
        SUM(s.total_amount) as total_revenue,
        COALESCE(SUM(st.store_profit), 0) as store_profit,
        COALESCE(SUM(st.supplier_amount), 0) as supplier_profit,
        COUNT(s.id) as transaction_count
      FROM sales s
      ${taxTotalsJoin}
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY YEAR(s.created_at), WEEK(s.created_at, 1)
      ORDER BY year DESC, week DESC
    `);

    const [monthlyRevenue] = await connection.query(`
      SELECT 
        YEAR(s.created_at) as year,
        MONTH(s.created_at) as month,
        SUM(s.total_amount) as total_revenue,
        COALESCE(SUM(st.store_profit), 0) as store_profit,
        COALESCE(SUM(st.supplier_amount), 0) as supplier_profit,
        COUNT(s.id) as transaction_count
      FROM sales s
      ${taxTotalsJoin}
      ${monthlyDateFilter}
      GROUP BY YEAR(s.created_at), MONTH(s.created_at)
      ORDER BY year DESC, month DESC
    `);

    const [yearlyRevenue] = await connection.query(`
      SELECT 
        YEAR(s.created_at) as year,
        SUM(s.total_amount) as total_revenue,
        COALESCE(SUM(st.store_profit), 0) as store_profit,
        COALESCE(SUM(st.supplier_amount), 0) as supplier_profit,
        COUNT(s.id) as transaction_count
      FROM sales s
      ${taxTotalsJoin}
      GROUP BY YEAR(s.created_at)
      ORDER BY year DESC
    `);

    connection.release();
    
    console.log('Revenue API returning daily data sample:', dailyRevenue[0]);
    console.log('Revenue API returning monthly data sample:', monthlyRevenue[0]);
    
    res.json({
      daily: dailyRevenue || [],
      weekly: weeklyRevenue || [],
      monthly: monthlyRevenue || [],
      yearly: yearlyRevenue || []
    });
  } catch (error) {
    console.error("Error fetching revenue data:", error);
    res.status(500).json({ message: "Server error fetching revenue data" });
  }
});

router.get("/revenue/detail", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { type, date } = req.query;
  
  console.log('Revenue detail API called with:', { type, date });
  
  if (!type || !date) {
    return res.status(400).json({ message: "Type and date parameters are required" });
  }

  try {
    const connection = await pool.getConnection();
    let whereClause = "";

    switch (type) {
      case "daily":
        whereClause = "DATE_FORMAT(s.created_at, '%Y-%m-%d') = ?";
        break;
      case "weekly":
        const [year, week] = date.split('-W');
        whereClause = "YEAR(s.created_at) = ? AND WEEK(s.created_at, 1) = ?";
        break;
      case "monthly":
        const [yearMonth, month] = date.split('-');
        whereClause = "YEAR(s.created_at) = ? AND MONTH(s.created_at) = ?";
        break;
      case "yearly":
        whereClause = "YEAR(s.created_at) = ?";
        break;
      default:
        return res.status(400).json({ message: "Invalid type parameter" });
    }

    let queryParams = [];
    if (type === "weekly") {
      const [year, week] = date.split('-W');
      queryParams = [parseInt(year), parseInt(week)];
    } else if (type === "monthly") {
      const [year, month] = date.split('-');
      queryParams = [parseInt(year), parseInt(month)];
    } else if (type === "daily") {
      queryParams = [date];
    } else {
      queryParams = [date];
    }

    console.log('Query params:', queryParams);
    console.log('Where clause:', whereClause);

    const [debugSales] = await connection.query(`
      SELECT 
        id,
        created_at,
        DATE_FORMAT(created_at, '%Y-%m-%d') as created_date,
        total_amount
      FROM sales 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('Recent sales for debugging (without timezone conversion):', debugSales);

    const [details] = await connection.query(`
      SELECT 
        s.created_at as waktu,
        s.payment_method,
        COALESCE(p.name, 'Produk Dihapus') as produk,
        COALESCE(c.name, 'Tidak Berkategori') as kategori,
        COALESCE(c.is_reseller, 0) as is_reseller,
        si.quantity as jumlah,
        si.price_at_sale as harga,
        (si.quantity * si.price_at_sale) as total,
        u.username as kasir,
        CASE 
          WHEN c.is_reseller = 1 AND st.store_profit IS NOT NULL THEN 
            st.store_profit
          ELSE 
            ROUND((si.quantity * si.price_at_sale * 0.2), 2)
        END as keuntungan_toko,
        CASE 
          WHEN c.is_reseller = 1 AND st.supplier_amount IS NOT NULL THEN 
            st.supplier_amount
          ELSE 0
        END as keuntungan_supplier
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_taxes st ON s.id = st.sale_id AND COALESCE(si.product_id, 0) = COALESCE(st.product_id, 0)
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
    `, queryParams);

    console.log('Query result count:', details.length);
    console.log('First few results:', details.slice(0, 2));

    connection.release();
    res.json(details);
  } catch (error) {
    console.error("Error fetching detailed revenue data:", error);
    res.status(500).json({ message: "Server error fetching detailed revenue data" });
  }
});

router.get("/:id", authenticateToken, authorizeRole(["superadmin", "cashier"]), async (req, res) => {
  const { id } = req.params;
  
  try {
    const connection = await pool.getConnection();
    const [saleRows] = await connection.query(`
      SELECT * 
      FROM sales
      WHERE id = ?
    `, [id]);
    
    if (saleRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Sale not found" });
    }
    
    const [itemRows] = await connection.query(`
      SELECT si.*, p.name as product_name, p.price as product_price
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [id]);
    
    connection.release();
    
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
