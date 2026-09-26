const router = require("express").Router();
const { pool } = require("../lib/db");
const { wrap, ok, demand, id } = require("../lib/http");
async function periodAccess(periodId, user) {
  const [[p]] = await pool.query(
    "SELECT * FROM evaluation_periods WHERE id=?",
    [id(periodId)],
  );
  demand(p, 404, "ไม่พบรอบ");
  if (user.role !== "admin") {
    const [[c]] = await pool.query(
      "SELECT COUNT(*) n FROM period_participants p LEFT JOIN evaluator_assignments a ON a.participant_id=p.id WHERE p.period_id=? AND (p.evaluatee_id=? OR a.evaluator_id=?)",
      [p.id, user.id, user.id],
    );
    demand(c.n > 0, 403, "ไม่ได้อยู่ในรอบนี้");
  }
  return p;
}
router.get(
  "/periods",
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      req.user.role === "admin"
        ? "SELECT * FROM evaluation_periods ORDER BY id DESC"
        : "SELECT DISTINCT e.* FROM evaluation_periods e JOIN period_participants p ON p.period_id=e.id LEFT JOIN evaluator_assignments a ON a.participant_id=p.id WHERE p.evaluatee_id=? OR a.evaluator_id=? ORDER BY e.id DESC",
      req.user.role === "admin" ? [] : [req.user.id, req.user.id],
    );
    ok(res, rows);
  }),
);
router.get(
  "/periods/:id",
  wrap(async (req, res) => {
    const p = await periodAccess(req.params.id, req.user);
    const [topics] = await pool.query(
      "SELECT * FROM topics WHERE period_id=? ORDER BY id",
      [p.id],
    );
    const [indicators] = await pool.query(
      "SELECT * FROM indicators WHERE period_id=? ORDER BY id",
      [p.id],
    );
    let participants = [],
      assignments = [];
    if (req.user.role === "admin") {
      [participants] = await pool.query(
        "SELECT p.*,u.full_name FROM period_participants p JOIN users u ON u.id=p.evaluatee_id WHERE p.period_id=?",
        [p.id],
      );
      [assignments] = await pool.query(
        "SELECT a.*,u.full_name AS evaluator_name,v.full_name AS evaluatee_name FROM evaluator_assignments a JOIN users u ON u.id=a.evaluator_id JOIN period_participants p ON p.id=a.participant_id JOIN users v ON v.id=p.evaluatee_id WHERE a.period_id=?",
        [p.id],
      );
    }
    ok(res, { period: p, topics, indicators, participants, assignments });
  }),
);
module.exports = { router, periodAccess };
