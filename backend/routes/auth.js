const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../models/db");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      connection.release();
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      connection.release();
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await connection.query(
      "UPDATE users SET last_login = UTC_TIMESTAMP(), is_active = TRUE WHERE id = ?", 
      [user.id]
    );

    await connection.query(
      "INSERT INTO user_activities (user_id, username, activity_type, ip_address, user_agent, created_at) VALUES (?, ?, 'login', ?, ?, UTC_TIMESTAMP())",
      [user.id, user.username, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
    );

    connection.release();

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        last_login: new Date().toISOString(),
        is_active: true
      } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    await connection.query("UPDATE users SET is_active = FALSE WHERE id = ?", [req.user.id]);
    
    await connection.query(
      "INSERT INTO user_activities (user_id, username, activity_type, ip_address, user_agent, created_at) VALUES (?, ?, 'logout', ?, ?, UTC_TIMESTAMP())",
      [req.user.id, req.user.username, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
    );
    
    connection.release();
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
});

router.post("/track-activity", authenticateToken, async (req, res) => {
  const { route_path } = req.body;
  
  try {
    const connection = await pool.getConnection();
    
    await connection.query("UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id = ?", [req.user.id]);
    
    await connection.query(
      "INSERT INTO user_activities (user_id, username, activity_type, route_path, ip_address, user_agent, created_at) VALUES (?, ?, 'route_change', ?, ?, ?, UTC_TIMESTAMP())",
      [req.user.id, req.user.username, route_path, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
    );
    
    connection.release();
    res.json({ message: "Activity tracked" });
  } catch (error) {
    console.error("Activity tracking error:", error);
    res.status(500).json({ message: "Error tracking activity" });
  }
});

router.get("/verify", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    
    res.status(200).json({ 
      valid: true, 
      user: { 
        id: decoded.id, 
        username: decoded.username, 
        role: decoded.role 
      } 
    });
  });
});

router.put("/profile", authenticateToken, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  
  try {
    const connection = await pool.getConnection();
    
    const [currentUser] = await connection.query("SELECT * FROM users WHERE id = ?", [userId]);
    
    if (currentUser.length === 0) {
      connection.release();
      return res.status(404).json({ message: "User not found" });
    }
    
    const user = currentUser[0];
    
    if (username !== user.username) {
      const [existingUser] = await connection.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, userId]);
      if (existingUser.length > 0) {
        connection.release();
        return res.status(400).json({ message: "Username sudah digunakan" });
      }
    }
    
    let updateFields = ["username = ?"];
    let updateValues = [username];
    
    if (newPassword) {
      if (!currentPassword) {
        connection.release();
        return res.status(400).json({ message: "Password lama harus diisi" });
      }
      
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        connection.release();
        return res.status(400).json({ message: "Password lama tidak benar" });
      }
      
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      updateFields.push("password = ?");
      updateValues.push(hashedNewPassword);
    }
    
    updateValues.push(userId);
    
    await connection.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );
    
    connection.release();
    
    res.json({ 
      message: "Profil berhasil diperbarui",
      user: { 
        id: userId, 
        username: username, 
        role: user.role 
      }
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
});


module.exports = router;
