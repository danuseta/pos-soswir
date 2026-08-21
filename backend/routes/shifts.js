const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const { timeToMinutes } = require("../utils/shiftWindow");

const router = express.Router();

const onlySuperadmin = [authenticateToken, authorizeRole(["superadmin"])];

async function validatePayload(connection, body, excludeShiftId) {
  const { start_time, end_time, label } = body;

  if (!start_time || !end_time) {
    return "Jam mulai dan jam selesai wajib diisi.";
  }
  if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
    return "Jam selesai harus lebih besar dari jam mulai.";
  }
  if (!label || label.trim() === "") {
    return "Nama sesi tidak boleh kosong.";
  }

  const [bentrok] = await connection.query(
    "SELECT id FROM shifts WHERE id <> ? AND start_time < ? AND end_time > ?",
    [excludeShiftId || 0, end_time, start_time]
  );
  if (bentrok.length > 0) {
    return "Jam sesi bertabrakan dengan sesi lain.";
  }

  return null;
}

router.get("/", ...onlySuperadmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [shifts] = await connection.query(
      "SELECT id, label, start_time, end_time, is_active FROM shifts ORDER BY start_time ASC"
    );
    connection.release();
    res.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ message: "Server error fetching shifts" });
  }
});

router.post("/", ...onlySuperadmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const problem = await validatePayload(connection, req.body, null);
    if (problem) {
      connection.release();
      return res.status(400).json({ message: problem });
    }

    const { start_time, end_time, label } = req.body;
    const [result] = await connection.query(
      "INSERT INTO shifts (label, start_time, end_time) VALUES (?, ?, ?)",
      [label.trim(), start_time, end_time]
    );
    connection.release();

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    connection.release();
    console.error("Error creating shift:", error);
    res.status(500).json({ message: "Server error creating shift" });
  }
});

router.put("/:id", ...onlySuperadmin, async (req, res) => {
  const shiftId = Number(req.params.id);
  const connection = await pool.getConnection();
  try {
    const problem = await validatePayload(connection, req.body, shiftId);
    if (problem) {
      connection.release();
      return res.status(400).json({ message: problem });
    }

    const { start_time, end_time, label } = req.body;
    const [result] = await connection.query(
      "UPDATE shifts SET label = ?, start_time = ?, end_time = ? WHERE id = ?",
      [label.trim(), start_time, end_time, shiftId]
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Sesi tidak ditemukan." });
    }
    res.json({ id: shiftId });
  } catch (error) {
    connection.release();
    console.error("Error updating shift:", error);
    res.status(500).json({ message: "Server error updating shift" });
  }
});

router.delete("/:id", ...onlySuperadmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query("DELETE FROM shifts WHERE id = ?", [
      Number(req.params.id)
    ]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Sesi tidak ditemukan." });
    }
    res.json({ message: "Sesi dihapus. Kasir di sesi itu jadi tanpa jadwal." });
  } catch (error) {
    console.error("Error deleting shift:", error);
    res.status(500).json({ message: "Server error deleting shift" });
  }
});

router.put("/assign/:userId", ...onlySuperadmin, async (req, res) => {
  const userId = Number(req.params.userId);
  const shiftId = req.body.shift_id === null ? null : Number(req.body.shift_id);

  try {
    const connection = await pool.getConnection();

    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ? AND role = 'cashier'",
      [userId]
    );
    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Kasir tidak ditemukan." });
    }

    if (shiftId !== null) {
      const [shifts] = await connection.query("SELECT id FROM shifts WHERE id = ?", [shiftId]);
      if (shifts.length === 0) {
        connection.release();
        return res.status(404).json({ message: "Sesi tidak ditemukan." });
      }
    }

    await connection.query("UPDATE users SET shift_id = ? WHERE id = ?", [shiftId, userId]);
    connection.release();

    res.json({ user_id: userId, shift_id: shiftId });
  } catch (error) {
    console.error("Error assigning shift:", error);
    res.status(500).json({ message: "Server error assigning shift" });
  }
});

module.exports = router;
