const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT setting_key, setting_value FROM store_settings");
    connection.release();
    
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Server error fetching settings" });
  }
});

router.put("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const settings = req.body;
  
  try {
    const connection = await pool.getConnection();
    
    for (const [key, value] of Object.entries(settings)) {
      await connection.query(
        "INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP",
        [key, value, value]
      );
    }
    
    connection.release();
    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Server error updating settings" });
  }
});

router.get("/:key", authenticateToken, async (req, res) => {
  const { key } = req.params;
  
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT setting_value FROM store_settings WHERE setting_key = ?", [key]);
    connection.release();
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Setting not found" });
    }
    
    res.json({ setting_key: key, setting_value: rows[0].setting_value });
  } catch (error) {
    console.error("Error fetching setting:", error);
    res.status(500).json({ message: "Server error fetching setting" });
  }
});

module.exports = router;
