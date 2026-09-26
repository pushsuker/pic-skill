const assert = require("node:assert/strict");
const { periodDates, withinPeriod, thaiDate } = require("../lib/period-dates");
const [start, end] = periodDates("2026-09-26", "2026-09-26");
assert.equal(start.toISOString(), "2026-09-25T17:00:00.000Z");
assert.equal(end.toISOString(), "2026-09-26T16:59:59.000Z");
const period = { status: "open", starts_at: start, ends_at: end };
for (const [time, expected] of [
  ["2026-09-25T16:59:59.999Z", false],
  ["2026-09-25T17:00:00.000Z", true],
  ["2026-09-26T16:59:59.999Z", true],
  ["2026-09-26T17:00:00.000Z", false],
]) assert.equal(withinPeriod(period, time), expected, time);
assert.equal(withinPeriod({ ...period, status: "closed" }, start), false);
assert.equal(withinPeriod({ ...period, status: "draft" }, start), false);
// Old rows retain their dates, but their former hours no longer restrict access.
const legacy = { status: "open", starts_at: "2026-09-26T03:56:00Z", ends_at: "2026-09-26T08:56:00Z" };
assert.equal(withinPeriod(legacy, start), true);
assert.equal(withinPeriod(legacy, "2026-09-26T16:59:59.999Z"), true);
assert.equal(thaiDate("2026-12-31T17:00:00Z"), "2027-01-01");
assert.equal(periodDates("2028-02-29", "2028-03-01")[0].toISOString(), "2028-02-28T17:00:00.000Z");
for (const invalid of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "26/09/2026", "2026-09-26T10:00:00Z", "", null, 0]) {
  assert.throws(() => periodDates(invalid, "2026-09-26"), { status: 400 });
  assert.throws(() => periodDates("2026-09-26", invalid), { status: 400 });
}
assert.throws(() => periodDates("2026-09-27", "2026-09-26"), { status: 400 });
console.log("PASS date-only periods: Thai midnight boundaries, inclusive end date, same-day, legacy rows and invalid dates.");
