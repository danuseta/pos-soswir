const SHIFT_GRACE_MINUTES = 15;

function minutesNowInJakarta(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type).value;

  return Number(get("hour")) * 60 + Number(get("minute"));
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

module.exports = {
  SHIFT_GRACE_MINUTES,
  minutesNowInJakarta,
  timeToMinutes,
  isWithinWindow
};
