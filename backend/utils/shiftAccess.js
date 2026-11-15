const { query } = require("../models/db");
const { minutesNowInJakarta, isWithinWindow } = require("./shiftWindow");

async function isOnShift(userId, role, at = new Date()) {
  if (role === "superadmin") {
    return { allowed: true, shift: null };
  }

  const rows = await query(
    `SELECT s.id, s.label, s.start_time, s.end_time
     FROM users u
     JOIN shifts s ON s.id = u.shift_id AND s.is_active = true
     WHERE u.id = $1`,
    [userId]
  );

  const shift = rows[0] || null;
  if (!shift) {
    return { allowed: false, shift: null };
  }

  return {
    allowed: isWithinWindow(minutesNowInJakarta(at), shift.start_time, shift.end_time),
    shift
  };
}

function describeShift(shift) {
  if (!shift) return null;
  return `${shift.label} ${String(shift.start_time).slice(0, 5)}-${String(shift.end_time).slice(0, 5)}`;
}

function outOfShiftMessage(shift) {
  const jadwal = describeShift(shift);
  return jadwal
    ? `Di luar jam shift Anda. Jadwal Anda ${jadwal} setiap hari.`
    : "Anda belum ditempatkan di sesi shift mana pun. Hubungi superadmin.";
}

module.exports = { isOnShift, describeShift, outOfShiftMessage };
