const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const { timeToMinutes } = require("../utils/shiftWindow");

const router = express.Router();

const onlySuperadmin = [authenticateToken, authorizeRole(["superadmin"])];

async function validatePayload(connection, body, excludeShiftId) {
  const { day_of_week, start_time, end_time, label, user_ids } = body;

  if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7) {
    return "Hari tidak valid.";
  }
  if (!start_time || !end_time) {
    return "Jam mulai dan jam selesai wajib diisi.";
  }
  if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
    return "Jam selesai harus lebih besar dari jam mulai.";
  }
  if (!label || label.trim() === "") {
    return "Label sesi tidak boleh kosong.";
  }
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return "Pilih minimal satu kasir.";
  }

  const [rows] = await connection.query(
    "SELECT id FROM users WHERE id IN (?) AND role = 'cashier'",
    [user_ids]
  );
  if (rows.length !== user_ids.length) {
    return "Ada pengguna yang bukan kasir atau tidak ditemukan.";
  }

  const [bentrok] = await connection.query(
    `SELECT id FROM shifts
     WHERE day_of_week = ? AND id <> ? AND start_time < ? AND end_time > ?`,
    [day_of_week, excludeShiftId || 0, end_time, start_time]
  );
  if (bentrok.length > 0) {
    return "Jam sesi bertabrakan dengan sesi lain di hari yang sama.";
  }

  return null;
}

router.get("/", ...onlySuperadmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [shifts] = await connection.query(
      "SELECT id, day_of_week, start_time, end_time, label, is_active FROM shifts ORDER BY day_of_week ASC, start_time ASC"
    );
    const [assignments] = await connection.query(
      `SELECT sa.shift_id, u.id, u.username
       FROM shift_assignments sa
       JOIN users u ON u.id = sa.user_id
       ORDER BY u.username ASC`
    );
    connection.release();

    const byShift = new Map();
    for (const row of assignments) {
      if (!byShift.has(row.shift_id)) byShift.set(row.shift_id, []);
      byShift.get(row.shift_id).push({ id: row.id, username: row.username });
    }

    res.json(shifts.map((shift) => ({ ...shift, cashiers: byShift.get(shift.id) || [] })));
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

    const { day_of_week, start_time, end_time, label, user_ids } = req.body;

    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO shifts (day_of_week, start_time, end_time, label) VALUES (?, ?, ?, ?)",
      [day_of_week, start_time, end_time, label.trim()]
    );
    await connection.query(
      "INSERT INTO shift_assignments (shift_id, user_id) VALUES ?",
      [user_ids.map((id) => [result.insertId, id])]
    );
    await connection.commit();
    connection.release();

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
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

    const { day_of_week, start_time, end_time, label, user_ids } = req.body;

    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE shifts SET day_of_week = ?, start_time = ?, end_time = ?, label = ? WHERE id = ?",
      [day_of_week, start_time, end_time, label.trim(), shiftId]
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "Sesi tidak ditemukan." });
    }
    await connection.query("DELETE FROM shift_assignments WHERE shift_id = ?", [shiftId]);
    await connection.query(
      "INSERT INTO shift_assignments (shift_id, user_id) VALUES ?",
      [user_ids.map((id) => [shiftId, id])]
    );
    await connection.commit();
    connection.release();

    res.json({ id: shiftId });
  } catch (error) {
    await connection.rollback();
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
    res.json({ message: "Sesi dihapus." });
  } catch (error) {
    console.error("Error deleting shift:", error);
    res.status(500).json({ message: "Server error deleting shift" });
  }
});

module.exports = router;
