const test = require("node:test");
const assert = require("node:assert");

const {
  SHIFT_GRACE_MINUTES,
  nowInJakarta,
  timeToMinutes,
  isWithinWindow,
  findActiveShift,
  findNextShift
} = require("./shiftWindow");

const sesi1 = { id: 1, day_of_week: 1, start_time: "08:00:00", end_time: "10:00:00" };
const sesi2 = { id: 2, day_of_week: 1, start_time: "10:00:00", end_time: "12:00:00" };
const selasa = { id: 3, day_of_week: 2, start_time: "08:00:00", end_time: "10:00:00" };

test("toleransi bernilai 15 menit", () => {
  assert.strictEqual(SHIFT_GRACE_MINUTES, 15);
});

test("timeToMinutes menerima format dengan dan tanpa detik", () => {
  assert.strictEqual(timeToMinutes("08:00:00"), 480);
  assert.strictEqual(timeToMinutes("08:00"), 480);
  assert.strictEqual(timeToMinutes("00:00:00"), 0);
  assert.strictEqual(timeToMinutes("23:59:00"), 1439);
});

test("nowInJakarta memetakan UTC ke hari dan menit WIB", () => {
  // 2026-08-24 01:00 UTC = Senin 08:00 WIB
  assert.deepStrictEqual(nowInJakarta(new Date("2026-08-24T01:00:00Z")), {
    dayOfWeek: 1,
    minutesSinceMidnight: 480
  });
  // 2026-08-23 17:30 UTC = Senin 00:30 WIB, masih hari Minggu kalau salah pakai UTC
  assert.deepStrictEqual(nowInJakarta(new Date("2026-08-23T17:30:00Z")), {
    dayOfWeek: 1,
    minutesSinceMidnight: 30
  });
  // 2026-08-23 16:00 UTC = Minggu 23:00 WIB, memastikan Minggu jadi 7 bukan 0
  assert.deepStrictEqual(nowInJakarta(new Date("2026-08-23T16:00:00Z")), {
    dayOfWeek: 7,
    minutesSinceMidnight: 1380
  });
});

test("isWithinWindow menerima batas persis", () => {
  assert.strictEqual(isWithinWindow(480, "08:00:00", "10:00:00"), true); // tepat mulai
  assert.strictEqual(isWithinWindow(600, "08:00:00", "10:00:00"), true); // tepat selesai
});

test("isWithinWindow menghormati toleransi di dua sisi", () => {
  assert.strictEqual(isWithinWindow(465, "08:00:00", "10:00:00"), true);  // 07:45, batas awal
  assert.strictEqual(isWithinWindow(464, "08:00:00", "10:00:00"), false); // 07:44
  assert.strictEqual(isWithinWindow(615, "08:00:00", "10:00:00"), true);  // 10:15, batas akhir
  assert.strictEqual(isWithinWindow(616, "08:00:00", "10:00:00"), false); // 10:16
});

test("findActiveShift mengabaikan shift di hari lain", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 540 }; // Senin 09:00
  assert.strictEqual(findActiveShift([selasa], now), null);
  assert.strictEqual(findActiveShift([selasa, sesi1], now).id, 1);
});

test("findActiveShift mengembalikan null kalau kasir tidak punya shift", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 540 };
  assert.strictEqual(findActiveShift([], now), null);
});

test("findActiveShift saat dua sesi tumpang tindih karena toleransi", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 600 }; // Senin 10:00 persis
  const hasil = findActiveShift([sesi1, sesi2], now);
  assert.notStrictEqual(hasil, null);
  assert.ok(hasil.id === 1 || hasil.id === 2);
});

test("findNextShift memilih shift terdekat ke depan", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 420 }; // Senin 07:00
  assert.strictEqual(findNextShift([sesi2, sesi1], now).id, 1);
});

test("findNextShift memutar ke minggu berikutnya", () => {
  const now = { dayOfWeek: 3, minutesSinceMidnight: 600 }; // Rabu 10:00
  assert.strictEqual(findNextShift([sesi1], now).id, 1);
});

test("findNextShift mengembalikan null kalau daftar kosong", () => {
  const now = { dayOfWeek: 1, minutesSinceMidnight: 420 };
  assert.strictEqual(findNextShift([], now), null);
});
