const { demand } = require("./http");
const thaiDate = (value = new Date()) =>
  new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

function periodDates(start, end) {
  for (const value of [start, end]) {
    demand(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
      400, "ระบุวันที่เป็น YYYY-MM-DD โดยไม่ใส่เวลา");
    const parsed = new Date(`${value}T00:00:00+07:00`);
    demand(Number.isFinite(parsed.getTime()) && thaiDate(parsed) === value,
      400, "วันที่ไม่ถูกต้อง");
  }
  demand(start <= end, 400, "วันเริ่มต้องไม่เกินวันสิ้นสุด");
  // Keep the existing UTC DATETIME schema; access checks compare Thai calendar days.
  return [new Date(`${start}T00:00:00+07:00`), new Date(`${end}T23:59:59+07:00`)];
}

function withinPeriod(period, now = new Date()) {
  const today = thaiDate(now);
  return period.status === "open" && today >= thaiDate(period.starts_at) && today <= thaiDate(period.ends_at);
}
module.exports = { thaiDate, periodDates, withinPeriod };
