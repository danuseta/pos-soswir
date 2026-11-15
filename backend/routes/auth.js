const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../models/db");
const { authenticateToken } = require("../middleware/authMiddleware");
const { isOnShift, outOfShiftMessage } = require("../utils/shiftAccess");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const rows = await query("SELECT * FROM users WHERE username = $1", [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const shiftStatus = await isOnShift(user.id, user.role);
    if (!shiftStatus.allowed) {
      return res.status(403).json({
        code: "OUT_OF_SHIFT",
        message: outOfShiftMessage(shiftStatus.shift),
        shift: shiftStatus.shift
      });
    }

    await query("UPDATE users SET last_login = now(), is_active = true WHERE id = $1", [user.id]);

    await query(
      "INSERT INTO user_activities (user_id, username, activity_type, ip_address, user_agent, created_at) VALUES ($1, $2, 'login', $3, $4, now())",
      [user.id, user.username, req.ip || req.connection.remoteAddress, req.headers["user-agent"]]
    );

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
    await query("UPDATE users SET is_active = false WHERE id = $1", [req.user.id]);

    await query(
      "INSERT INTO user_activities (user_id, username, activity_type, ip_address, user_agent, created_at) VALUES ($1, $2, 'logout', $3, $4, now())",
      [req.user.id, req.user.username, req.ip || req.connection.remoteAddress, req.headers["user-agent"]]
    );

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
});

router.post("/track-activity", authenticateToken, async (req, res) => {
  const { route_path } = req.body;

  try {
    await query("UPDATE users SET last_login = now() WHERE id = $1", [req.user.id]);

    await query(
      "INSERT INTO user_activities (user_id, username, activity_type, route_path, ip_address, user_agent, created_at) VALUES ($1, $2, 'route_change', $3, $4, $5, now())",
      [req.user.id, req.user.username, route_path, req.ip || req.connection.remoteAddress, req.headers["user-agent"]]
    );

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

  if (typeof username !== "string" || username.trim() === "") {
    return res.status(400).json({ message: "Username wajib diisi" });
  }

  try {
    const [user] = await query("SELECT * FROM users WHERE id = $1", [userId]);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (username !== user.username) {
      const taken = await query("SELECT id FROM users WHERE username = $1 AND id <> $2", [username, userId]);
      if (taken.length > 0) return res.status(400).json({ message: "Username sudah digunakan" });
    }

    let passwordHash = user.password;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: "Password lama harus diisi" });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "Password lama tidak benar" });
      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await query("UPDATE users SET username = $1, password = $2 WHERE id = $3", [username, passwordHash, userId]);
    res.json({ message: "Profil berhasil diperbarui", user: { id: userId, username, role: user.role } });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
});

module.exports = router;
