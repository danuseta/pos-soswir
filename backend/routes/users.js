const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/cashiers", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required for cashier creation" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, 'cashier')",
      [username, hashedPassword]
    );
    connection.release();
    res.status(201).json({ id: result.insertId, username, role: "cashier" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Username already exists" });
    }
    console.error("Error creating cashier:", error);
    res.status(500).json({ message: "Server error creating cashier" });
  }
});

router.get("/cashiers", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT 
        u.id, 
        u.username, 
        u.role, 
        CONVERT_TZ(u.created_at, '+07:00', '+00:00') as created_at,
        u.last_login,
        u.is_active,
        COUNT(ua.id) as total_activities,
        MAX(ua.created_at) as last_activity
      FROM users u 
      LEFT JOIN user_activities ua ON u.id = ua.user_id 
      WHERE u.role = 'cashier' 
      GROUP BY u.id, u.username, u.role, u.created_at, u.last_login, u.is_active
      ORDER BY u.username ASC
    `);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching cashiers:", error);
    res.status(500).json({ message: "Server error fetching cashiers" });
  }
});

router.get("/cashiers/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT id, username, role, created_at FROM users WHERE id = ? AND role = 'cashier'", [id]);
    connection.release();
    if (rows.length === 0) {
      return res.status(404).json({ message: "Cashier not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching cashier:", error);
    res.status(500).json({ message: "Server error fetching cashier" });
  }
});

router.get("/cashiers/:id/activities", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT * FROM user_activities 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [id]);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching cashier activities:", error);
    res.status(500).json({ message: "Server error fetching activities" });
  }
});

router.put("/cashiers/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required for update" });
  }

  try {
    const connection = await pool.getConnection();
    const [existingUser] = await connection.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, id]);
    if (existingUser.length > 0) {
        connection.release();
        return res.status(409).json({ message: "Username already taken by another user." });
    }

    const [result] = await connection.query("UPDATE users SET username = ? WHERE id = ? AND role = 'cashier'", [username, id]);
    connection.release();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cashier not found or no changes made" });
    }
    res.json({ id, username, message: "Cashier updated successfully" });
  } catch (error) {
     if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Username already exists" });
    }
    console.error("Error updating cashier:", error);
    res.status(500).json({ message: "Server error updating cashier" });
  }
});

router.delete("/cashiers/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query("DELETE FROM users WHERE id = ? AND role = 'cashier'", [id]);
    connection.release();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cashier not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting cashier:", error);
    res.status(500).json({ message: "Server error deleting cashier" });
  }
});

module.exports = router;
