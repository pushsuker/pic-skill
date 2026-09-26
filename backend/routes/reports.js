const router = require("express").Router();
const { pool } = require("../lib/db");
const { wrap, ok, demand, id } = require("../lib/http");
const { role } = require("../lib/security");
const {
  percentage,
  resultLabel,
  participant,
  details,
} = require("../lib/domain");
async function individual(db, p) {
  const indicators = await details(db, p);
  const [assignments] = await db.query(
    "SELECT a.*,u.full_name AS evaluator_name FROM evaluator_assignments a JOIN users u ON u.id=a.evaluator_id WHERE a.participant_id=? ORDER BY a.id",
    [p.id],
  );
  for (const a of assignments) {
    const [scores] = await db.query(
      "SELECT indicator_id,score FROM evaluator_scores WHERE assignment_id=?",
      [a.id],
    );
    a.scores = scores;
    a.completed = scores.length;
    a.percentage = percentage(
      indicators,
      new Map(scores.map((s) => [s.indicator_id, s.score])),
    );
  }
  const complete =
    assignments.length > 0 &&
    assignments.every((a) => a.status === "submitted" && a.percentage !== null);
  const pct = complete
    ? assignments.reduce((n, a) => n + a.percentage, 0) / assignments.length
    : null;
  return {
    participant: p,
    indicators,
    assignments,
    complete,
    percentage: pct,
    result: resultLabel(pct),
    self_completed: indicators.filter(
      (i) =>
        i.self_score !== null && (!i.evidence_required || i.evidence.length),
    ).length,
  };
}
router.get(
  "/periods/:id/report",
  role("admin"),
  wrap(async (req, res) => {
    const [[period]] = await pool.query(
      "SELECT * FROM evaluation_periods WHERE id=?",
      [id(req.params.id)],
    );
    demand(period, 404, "ไม่พบรอบ");
    const [people] = await pool.query(
      "SELECT id FROM period_participants WHERE period_id=?",
      [period.id],
    );
    const rows = [];
    for (const p of people)
      rows.push(await individual(pool, await participant(pool, p.id)));
    const done = rows.filter((r) => r.complete);
    ok(res, {
      period,
      rows,
      statistics: {
        total: rows.length,
        completed: done.length,
        pending: rows.length - done.length,
        average: done.length
          ? done.reduce((n, r) => n + r.percentage, 0) / done.length
          : null,
      },
    });
  }),
);
router.get(
  "/participants/:id/result",
  role("admin", "evaluatee"),
  wrap(async (req, res) => {
    const p = await participant(pool, req.params.id);
    const [[period]] = await pool.query(
      "SELECT * FROM evaluation_periods WHERE id=?",
      [p.period_id],
    );
    demand(
      req.user.role === "admin" ||
        (p.evaluatee_id === req.user.id && period.published_at),
      403,
      "ยังไม่เผยแพร่ผลหรือไม่ใช่ข้อมูลของคุณ",
    );
    ok(res, { ...(await individual(pool, p)), period });
  }),
);
module.exports = router;
