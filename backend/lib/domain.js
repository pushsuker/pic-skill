const { demand, id } = require("./http");
const { transaction } = require("./db");
const { withinPeriod } = require("./period-dates");
async function withPeriod(periodId, work) {
  return transaction(async (db) => {
    const [[period]] = await db.query(
      "SELECT * FROM evaluation_periods WHERE id=? FOR UPDATE",
      [id(periodId)],
    );
    demand(period, 404, "ไม่พบรอบประเมิน");
    return work(db, period);
  });
}
function editable(period) {
  demand(
    withinPeriod(period),
    403,
    "อยู่นอกวันที่เปิดประเมิน",
    "PERIOD_CLOSED",
  );
}
function draft(period) {
  demand(period.status === "draft", 409, "แก้ชุดข้อมูลได้เฉพาะรอบฉบับร่าง");
}
function scoreFor(indicator, score, nullable = false) {
  if (nullable && score === null) return null;
  demand(
    Number.isInteger(score) &&
      (indicator.score_type === "boolean"
        ? [0, 1].includes(score)
        : score >= 1 && score <= 4),
    400,
    "คะแนนไม่ตรงชนิดตัวชี้วัด",
  );
  return score;
}
function percentage(indicators, scores) {
  if (!indicators.length || indicators.some((i) => !scores.has(i.id)))
    return null;
  const total = indicators.reduce((sum, i) => sum + Number(i.weight), 0);
  return (
    (indicators.reduce(
      (sum, i) =>
        sum +
        (Number(i.weight) * scores.get(i.id)) /
          (i.score_type === "boolean" ? 1 : 4),
      0,
    ) /
      total) *
    100
  );
}
const resultLabel = (p) =>
  p === null
    ? "ยังไม่ครบ"
    : p >= 90
      ? "ดีเยี่ยม"
      : p >= 75
        ? "ดี"
        : p >= 60
          ? "ผ่าน"
          : "ไม่ผ่าน";
async function participant(db, participantId) {
  const [[p]] = await db.query(
    "SELECT p.*,u.full_name,u.department,u.position FROM period_participants p JOIN users u ON u.id=p.evaluatee_id WHERE p.id=?",
    [id(participantId)],
  );
  demand(p, 404, "ไม่พบผู้รับในรอบ");
  return p;
}
async function assignment(db, assignmentId, user) {
  const [[a]] = await db.query(
    "SELECT * FROM evaluator_assignments WHERE id=?",
    [id(assignmentId)],
  );
  demand(a, 404, "ไม่พบการมอบหมาย");
  demand(
    user.role === "admin" || a.evaluator_id === user.id,
    403,
    "ไม่ได้รับมอบหมาย",
  );
  return a;
}
async function canRead(db, p, user) {
  if (user.role === "admin" || p.evaluatee_id === user.id) return;
  const [[a]] = await db.query(
    "SELECT id FROM evaluator_assignments WHERE participant_id=? AND evaluator_id=?",
    [p.id, user.id],
  );
  demand(a, 403, "ไม่ได้รับมอบหมาย");
}
async function details(db, p) {
  const [rows] = await db.query(
    "SELECT i.*,t.name AS topic_name,s.id AS self_id,s.score AS self_score,s.narrative FROM indicators i JOIN topics t ON t.id=i.topic_id LEFT JOIN self_assessments s ON s.indicator_id=i.id AND s.participant_id=? WHERE i.period_id=? ORDER BY t.id,i.id",
    [p.id, p.period_id],
  );
  const [evidence] = await db.query(
    "SELECT e.*,f.original_name,f.mime_type,s.indicator_id FROM evidence_items e JOIN self_assessments s ON s.id=e.self_assessment_id LEFT JOIN files f ON f.id=e.file_id WHERE s.participant_id=?",
    [p.id],
  );
  return rows.map((r) => ({
    ...r,
    evidence: evidence.filter((e) => e.indicator_id === r.id),
  }));
}
module.exports = {
  withPeriod,
  editable,
  draft,
  scoreFor,
  percentage,
  resultLabel,
  participant,
  assignment,
  canRead,
  details,
};
