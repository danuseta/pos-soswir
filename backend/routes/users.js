const express = require("express");
const bcrypt = require("bcryptjs");
const { pool, query } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/cashiers", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required for cashier creation" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [row] = await query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, 'cashier') RETURNING id",
      [username, hashedPassword]
    );
    res.status(201).json({ id: row.id, username, role: "cashier" });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Username already exists" });
    }
    console.error("Error creating cashier:", error);
    res.status(500).json({ message: "Server error creating cashier" });
  }
});

router.get("/cashiers", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        u.id,
        u.username,
        u.role,
        u.created_at,
        u.last_login,
        u.is_active,
        u.shift_id,
        COUNT(ua.id) AS total_activities,
        MAX(ua.created_at) AS last_activity
      FROM users u
      LEFT JOIN user_activities ua ON u.id = ua.user_id
      WHERE u.role = 'cashier'
      GROUP BY u.id
      ORDER BY u.username ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching cashiers:", error);
    res.status(500).json({ message: "Server error fetching cashiers" });
  }
});

router.get("/cashiers/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await query(
      "SELECT id, username, role, created_at FROM users WHERE id = $1 AND role = 'cashier'",
      [id]
    );
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
    const rows = await query(
      "SELECT * FROM user_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [id]
    );
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
    const existingUser = await query("SELECT id FROM users WHERE username = $1 AND id <> $2", [username, id]);
    if (existingUser.length > 0) {
      return res.status(409).json({ message: "Username already taken by another user." });
    }

    const result = await pool.query(
      "UPDATE users SET username = $1 WHERE id = $2 AND role = 'cashier'",
      [username, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Cashier not found or no changes made" });
    }
    res.json({ id, username, message: "Cashier updated successfully" });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Username already exists" });
    }
    console.error("Error updating cashier:", error);
    res.status(500).json({ message: "Server error updating cashier" });
  }
});

router.delete("/cashiers/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'cashier'", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Cashier not found" });
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({ message: "Kasir masih punya riwayat transaksi, tidak bisa dihapus" });
    }
    console.error("Error deleting cashier:", error);
    res.status(500).json({ message: "Server error deleting cashier" });
  }
});

module.exports = router;
