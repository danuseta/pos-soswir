const { pool } = require("../models/db");
const { nowInJakarta, findActiveShift, findNextShift } = require("./shiftWindow");

const DAY_NAMES = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

async function isOnShift(userId, role, at = new Date()) {
  if (role === "superadmin") {
    return { allowed: true, shift: null, nextShift: null };
  }

  const connection = await pool.getConnection();
  try {
    const [shifts] = await connection.query(
      `SELECT s.id, s.day_of_week, s.start_time, s.end_time, s.label
       FROM shifts s
       JOIN shift_assignments sa ON sa.shift_id = s.id
       WHERE sa.user_id = ? AND s.is_active = 1`,
      [userId]
    );

    const now = nowInJakarta(at);
    const shift = findActiveShift(shifts, now);

    return {
      allowed: shift !== null,
      shift,
      nextShift: shift ? null : findNextShift(shifts, now)
    };
  } finally {
    connection.release();
  }
}

function describeShift(shift) {
  if (!shift) return null;
  const day = DAY_NAMES[shift.day_of_week] || "";
  return `${day} ${String(shift.start_time).slice(0, 5)}-${String(shift.end_time).slice(0, 5)}`;
}

function outOfShiftMessage(nextShift) {
  const jadwal = describeShift(nextShift);
  return jadwal
    ? `Di luar jadwal shift Anda. Jadwal berikutnya: ${jadwal}.`
    : "Anda belum punya jadwal shift. Hubungi superadmin.";
}

module.exports = { isOnShift, describeShift, outOfShiftMessage };
