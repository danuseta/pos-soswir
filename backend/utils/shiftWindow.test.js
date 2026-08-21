const test = require("node:test");
const assert = require("node:assert");

const {
  SHIFT_GRACE_MINUTES,
  minutesNowInJakarta,
  timeToMinutes,
  isWithinWindow
} = require("./shiftWindow");

test("toleransi bernilai 15 menit", () => {
  assert.strictEqual(SHIFT_GRACE_MINUTES, 15);
});

test("timeToMinutes menerima format dengan dan tanpa detik", () => {
  assert.strictEqual(timeToMinutes("08:00:00"), 480);
  assert.strictEqual(timeToMinutes("08:00"), 480);
  assert.strictEqual(timeToMinutes("00:00:00"), 0);
  assert.strictEqual(timeToMinutes("23:59:00"), 1439);
});

test("minutesNowInJakarta memetakan UTC ke menit WIB", () => {
  // 01:00 UTC = 08:00 WIB
  assert.strictEqual(minutesNowInJakarta(new Date("2026-08-24T01:00:00Z")), 480);
  // 17:30 UTC = 00:30 WIB hari berikutnya, bukan 17:30
  assert.strictEqual(minutesNowInJakarta(new Date("2026-08-23T17:30:00Z")), 30);
  // 16:00 UTC = 23:00 WIB
  assert.strictEqual(minutesNowInJakarta(new Date("2026-08-23T16:00:00Z")), 1380);
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

test("isWithinWindow menolak jam yang jauh di luar sesi", () => {
  assert.strictEqual(isWithinWindow(0, "08:00:00", "10:00:00"), false);    // tengah malam
  assert.strictEqual(isWithinWindow(1200, "08:00:00", "10:00:00"), false); // 20:00
});
