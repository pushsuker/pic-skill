const router = require("express").Router();
const { pool } = require("../lib/db");
const { wrap, ok, demand, id, text } = require("../lib/http");
const { role } = require("../lib/security");
const {
  withPeriod,
  editable,
  scoreFor,
  participant,
  assignment,
  canRead,
  details,
} = require("../lib/domain");
const { upload, saveFile, discard } = require("../lib/uploads");
router.get(
  "/periods/:id/me/assessment",
  role("evaluatee"),
  wrap(async (req, res) => {
    const [[person]] = await pool.query(
      "SELECT id FROM period_participants WHERE period_id=? AND evaluatee_id=?",
      [id(req.params.id), req.user.id],
    );
    demand(person, 404, "ยังไม่ได้เข้ารอบนี้");
    const p = await participant(pool, person.id);
    const [[period]] = await pool.query(
      "SELECT * FROM evaluation_periods WHERE id=?",
      [p.period_id],
    );
    ok(res, { participant: p, period, indicators: await details(pool, p) });
  }),
);
router.put(
  "/participants/:id/self-assessments/:indicatorId",
  role("evaluatee"),
  wrap(async (req, res) => {
    const p = await participant(pool, req.params.id);
    demand(p.evaluatee_id === req.user.id, 403, "ไม่ใช่ข้อมูลของคุณ");
    const data = await withPeriod(p.period_id, async (db, period) => {
      editable(period);
      const current = await participant(db, p.id);
      demand(current.status === "draft", 409, "ส่งตนเองแล้ว แก้ไขไม่ได้");
      const [[i]] = await db.query(
        "SELECT * FROM indicators WHERE id=? AND period_id=?",
        [id(req.params.indicatorId), period.id],
      );
      demand(i, 404, "ไม่พบตัวชี้วัดในรอบ");
      const score = scoreFor(i, req.body.score, true);
      const narrative = text(req.body.narrative || "", 10000);
      await db.query(
        "INSERT INTO self_assessments(period_id,participant_id,indicator_id,score,narrative) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE score=VALUES(score),narrative=VALUES(narrative)",
        [period.id, p.id, i.id, score, narrative],
      );
      const [[s]] = await db.query(
        "SELECT id FROM self_assessments WHERE participant_id=? AND indicator_id=?",
        [p.id, i.id],
      );
      return s;
    });
    ok(res, data, "บันทึกฉบับร่างแล้ว");
  }),
);
async function editableSelf(db, selfId, user, period) {
  const [[s]] = await db.query(
    "SELECT s.*,p.evaluatee_id,p.status,i.evidence_mode FROM self_assessments s JOIN period_participants p ON p.id=s.participant_id JOIN indicators i ON i.id=s.indicator_id WHERE s.id=?",
    [id(selfId)],
  );
  demand(s, 404, "ไม่พบรายการ");
  demand(s.evaluatee_id === user.id, 403, "ไม่ใช่ข้อมูลของคุณ");
  editable(period);
  demand(s.status === "draft", 409, "ส่งแล้ว แก้หลักฐานไม่ได้");
  return s;
}
router.post(
  "/self-assessments/:id/evidence",
  role("evaluatee"),
  upload,
  wrap(async (req, res) => {
    const [[s]] = await pool.query(
      "SELECT period_id FROM self_assessments WHERE id=?",
      [id(req.params.id)],
    );
    demand(s, 404, "บันทึกฉบับร่างก่อนแนบหลักฐาน");
    let stored;
    try {
      const data = await withPeriod(s.period_id, async (db, p) => {
        const self = await editableSelf(db, req.params.id, req.user, p);
        let fileId = null,
          url = null,
          kind;
        if (req.file) {
          demand(
            ["file", "either"].includes(self.evidence_mode),
            400,
            "ตัวชี้วัดไม่รับไฟล์",
          );
          kind = "file";
          stored = await saveFile(db, req.file, req.user, "evidence");
          fileId = stored.id;
        } else {
          demand(
            ["url", "either"].includes(self.evidence_mode),
            400,
            "ตัวชี้วัดไม่รับ URL",
          );
          kind = "url";
          url = text(req.body.url, 2000, true);
          let parsed;
          try {
            parsed = new URL(url);
          } catch {}
          demand(
            parsed && ["http:", "https:"].includes(parsed.protocol),
            400,
            "URL ต้องเป็น http/https",
          );
        }
        const [r] = await db.query(
          "INSERT INTO evidence_items(self_assessment_id,kind,url,file_id) VALUES(?,?,?,?)",
          [self.id, kind, url, fileId],
        );
        return { id: r.insertId };
      });
      ok(res, data, "แนบหลักฐานแล้ว", 201);
    } catch (e) {
      await discard(stored);
      throw e;
    }
  }),
);
router.delete(
  "/evidence/:id",
  role("evaluatee"),
  wrap(async (req, res) => {
    const [[e]] = await pool.query(
      "SELECT e.*,s.period_id FROM evidence_items e JOIN self_assessments s ON s.id=e.self_assessment_id WHERE e.id=?",
      [id(req.params.id)],
    );
    demand(e, 404, "ไม่พบหลักฐาน");
    await withPeriod(e.period_id, async (db, p) => {
      await editableSelf(db, e.self_assessment_id, req.user, p);
      await db.query("DELETE FROM evidence_items WHERE id=?", [e.id]);
    });
    ok(res);
    // Keep detached files until controlled cleanup/backup; no public access after unlink.
  }),
);
router.post(
  "/participants/:id/submit",
  role("evaluatee"),
  wrap(async (req, res) => {
    const p = await participant(pool, req.params.id);
    demand(p.evaluatee_id === req.user.id, 403, "ไม่ใช่ข้อมูลของคุณ");
    await withPeriod(p.period_id, async (db, period) => {
      editable(period);
      const current = await participant(db, p.id);
      demand(current.status === "draft", 409, "ส่งแล้ว");
      const rows = await details(db, current);
      demand(
        rows.length &&
          rows.every(
            (i) =>
              i.self_score !== null &&
              (!i.evidence_required || i.evidence.length),
          ),
        400,
        "กรอกคะแนนและหลักฐานที่บังคับให้ครบ",
      );
      rows.forEach((i) => scoreFor(i, i.self_score));
      await db.query(
        "UPDATE period_participants SET status='submitted',submitted_at=UTC_TIMESTAMP() WHERE id=?",
        [p.id],
      );
    });
    ok(res, null, "ส่งการประเมินตนเองแล้ว");
  }),
);
router.get(
  "/assignments/me",
  role("evaluator"),
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT a.*,u.full_name,e.name AS period_name,p.status AS self_status FROM evaluator_assignments a JOIN period_participants p ON p.id=a.participant_id JOIN users u ON u.id=p.evaluatee_id JOIN evaluation_periods e ON e.id=a.period_id WHERE a.evaluator_id=? ORDER BY a.id DESC",
      [req.user.id],
    );
    ok(res, rows);
  }),
);
router.get(
  "/assignments/:id",
  role("evaluator", "admin"),
  wrap(async (req, res) => {
    const a = await assignment(pool, req.params.id, req.user);
    const p = await participant(pool, a.participant_id);
    const [[period]] = await pool.query(
      "SELECT * FROM evaluation_periods WHERE id=?",
      [a.period_id],
    );
    const [scores] = await pool.query(
      "SELECT indicator_id,score FROM evaluator_scores WHERE assignment_id=?",
      [a.id],
    );
    ok(res, {
      assignment: a,
      participant: p,
      period,
      indicators: await details(pool, p),
      scores,
    });
  }),
);
router.put(
  "/assignments/:id/scores/:indicatorId",
  role("evaluator"),
  wrap(async (req, res) => {
    const a = await assignment(pool, req.params.id, req.user);
    await withPeriod(a.period_id, async (db, period) => {
      editable(period);
      const current = await assignment(db, a.id, req.user);
      demand(current.status !== "submitted", 409, "ส่งแล้ว แก้คะแนนไม่ได้");
      const p = await participant(db, a.participant_id);
      demand(p.status === "submitted", 409, "รอผู้รับส่งตนเอง");
      const [[i]] = await db.query(
        "SELECT * FROM indicators WHERE id=? AND period_id=?",
        [id(req.params.indicatorId), period.id],
      );
      demand(i, 404, "ไม่พบตัวชี้วัดในรอบ");
      const score = scoreFor(i, req.body.score);
      await db.query(
        "INSERT INTO evaluator_scores(period_id,assignment_id,indicator_id,score) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE score=VALUES(score)",
        [period.id, a.id, i.id, score],
      );
      await db.query(
        "UPDATE evaluator_assignments SET status='in_progress' WHERE id=?",
        [a.id],
      );
    });
    ok(res);
  }),
);
router.post(
  "/assignments/:id/signature",
  role("evaluator"),
  upload,
  wrap(async (req, res) => {
    const a = await assignment(pool, req.params.id, req.user);
    let stored;
    try {
      const data = await withPeriod(a.period_id, async (db, p) => {
        editable(p);
        const current = await assignment(db, a.id, req.user);
        demand(current.status !== "submitted", 409, "ส่งแล้ว แก้ลายเซ็นไม่ได้");
        const person = await participant(db, a.participant_id);
        demand(person.status === "submitted", 409, "รอผู้รับส่งตนเอง");
        stored = await saveFile(db, req.file, req.user, "signature");
        await db.query(
          "UPDATE evaluator_assignments SET signature_file_id=? WHERE id=?",
          [stored.id, a.id],
        );
        return { id: stored.id };
      });
      ok(res, data, "บันทึกลายเซ็นแล้ว", 201);
    } catch (e) {
      await discard(stored);
      throw e;
    }
  }),
);
router.post(
  "/assignments/:id/submit",
  role("evaluator"),
  wrap(async (req, res) => {
    const a = await assignment(pool, req.params.id, req.user);
    await withPeriod(a.period_id, async (db, p) => {
      editable(p);
      const current = await assignment(db, a.id, req.user);
      demand(current.status !== "submitted", 409, "ส่งผลแล้ว");
      const person = await participant(db, a.participant_id);
      demand(person.status === "submitted", 409, "รอผู้รับส่งตนเอง");
      const [[c]] = await db.query(
        "SELECT COUNT(*) total,COUNT(s.id) done FROM indicators i LEFT JOIN evaluator_scores s ON s.indicator_id=i.id AND s.assignment_id=? WHERE i.period_id=?",
        [a.id, p.id],
      );
      demand(
        c.total > 0 && c.total === c.done,
        400,
        "ให้คะแนนครบทุกข้อก่อนส่ง",
      );
      demand(current.signature_file_id, 400, "แนบลายเซ็นก่อนส่ง");
      await db.query(
        "UPDATE evaluator_assignments SET status='submitted',overall_feedback=?,submitted_at=UTC_TIMESTAMP() WHERE id=?",
        [text(req.body.overall_feedback, 10000, true), a.id],
      );
    });
    ok(res, null, "ยืนยันผลแล้ว");
  }),
);
module.exports = router;
