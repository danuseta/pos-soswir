const SHIFT_GRACE_MINUTES = 15;

const WEEKDAY_TO_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function nowInJakarta(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type).value;

  return {
    dayOfWeek: WEEKDAY_TO_ISO[get("weekday")],
    minutesSinceMidnight: Number(get("hour")) * 60 + Number(get("minute"))
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isWithinWindow(nowMinutes, startTime, endTime) {
  const start = timeToMinutes(startTime) - SHIFT_GRACE_MINUTES;
  const end = timeToMinutes(endTime) + SHIFT_GRACE_MINUTES;
  return nowMinutes >= start && nowMinutes <= end;
}

function findActiveShift(shifts, now) {
  const found = shifts.find(
    (shift) =>
      shift.day_of_week === now.dayOfWeek &&
      isWithinWindow(now.minutesSinceMidnight, shift.start_time, shift.end_time)
  );
  return found || null;
}

function minutesUntil(now, shift) {
  const shiftStart = (shift.day_of_week - 1) * 1440 + timeToMinutes(shift.start_time);
  const nowAbsolute = (now.dayOfWeek - 1) * 1440 + now.minutesSinceMidnight;
  const diff = shiftStart - nowAbsolute;
  return diff >= 0 ? diff : diff + 7 * 1440;
}

function findNextShift(shifts, now) {
  if (shifts.length === 0) return null;
  return shifts
    .slice()
    .sort((a, b) => minutesUntil(now, a) - minutesUntil(now, b))[0];
}

module.exports = {
  SHIFT_GRACE_MINUTES,
  nowInJakarta,
  timeToMinutes,
  isWithinWindow,
  findActiveShift,
  findNextShift
};
