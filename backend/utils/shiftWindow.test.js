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
  assert.strictEqual(minutesNowInJakarta(new Date("2026-08-24T01:00:00Z")), 480);
  assert.strictEqual(minutesNowInJakarta(new Date("2026-08-23T17:30:00Z")), 30);
  assert.strictEqual(minutesNowInJakarta(new Date("2026-08-23T16:00:00Z")), 1380);
});

test("isWithinWindow menerima batas persis", () => {
  assert.strictEqual(isWithinWindow(480, "08:00:00", "10:00:00"), true);
  assert.strictEqual(isWithinWindow(600, "08:00:00", "10:00:00"), true);
});

test("isWithinWindow menghormati toleransi di dua sisi", () => {
  assert.strictEqual(isWithinWindow(465, "08:00:00", "10:00:00"), true);
  assert.strictEqual(isWithinWindow(464, "08:00:00", "10:00:00"), false);
  assert.strictEqual(isWithinWindow(615, "08:00:00", "10:00:00"), true);
  assert.strictEqual(isWithinWindow(616, "08:00:00", "10:00:00"), false);
});

test("isWithinWindow menolak jam yang jauh di luar sesi", () => {
  assert.strictEqual(isWithinWindow(0, "08:00:00", "10:00:00"), false);
  assert.strictEqual(isWithinWindow(1200, "08:00:00", "10:00:00"), false);
});
