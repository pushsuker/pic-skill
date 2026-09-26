const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../lib/db");
const { wrap, ok, demand, id, text, password } = require("../lib/http");
const { role } = require("../lib/security");
const { withPeriod, draft } = require("../lib/domain");
const { periodDates, thaiDate } = require("../lib/period-dates");
router.use(role("admin"));
router.get(
  "/users",
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id,username,full_name,department,position,role,is_active FROM users ORDER BY id",
    );
    ok(res, rows);
  }),
);
router.post(
  "/users",
  wrap(async (req, res) => {
    const b = req.body;
    demand(["evaluatee", "evaluator"].includes(b.role), 400, "บทบาทไม่ถูกต้อง");
    const [r] = await pool.query(
      "INSERT INTO users(username,password,full_name,department,position,role) VALUES(?,?,?,?,?,?)",
      [
        text(b.username, 50, true),
        await bcrypt.hash(password(b.password), 10),
        text(b.full_name, 100, true),
        text(b.department || "", 100),
        text(b.position || "", 100),
        b.role,
      ],
    );
    ok(res, { id: r.insertId }, "เพิ่มผู้ใช้แล้ว", 201);
  }),
);
router.put(
  "/users/:id",
  wrap(async (req, res) => {
    const b = req.body;
    demand(typeof b.is_active === "boolean", 400, "สถานะบัญชีไม่ถูกต้อง");
    const [[u]] = await pool.query(
      "SELECT * FROM users WHERE id=? AND role!='admin'",
      [id(req.params.id)],
    );
    demand(u, 404, "ไม่พบผู้ใช้ที่แก้ไขได้");
    const newHash = b.password ? await bcrypt.hash(password(b.password), 10) : null;
    await pool.query(
      "UPDATE users SET full_name=?,department=?,position=?,is_active=?,token_version=token_version+1,password=COALESCE(?,password),must_change_password=IF(? IS NULL,must_change_password,1) WHERE id=?",
      [
        text(b.full_name, 100, true),
        text(b.department || "", 100),
        text(b.position || "", 100),
        b.is_active,
        newHash,
        newHash,
        u.id,
      ],
    );
    ok(res);
  }),
);
function periodInput(b) {
  const [start, end] = periodDates(b.starts_at, b.ends_at);
  demand(
    Number.isInteger(b.eval_year) && b.eval_year >= 2000 && b.eval_year <= 2100,
    400,
    "ใช้ปี ค.ศ. 2000–2100",
  );
  return [text(b.name, 200, true), b.eval_year, start, end];
}
router.post(
  "/periods",
  wrap(async (req, res) => {
    const [r] = await pool.query(
      "INSERT INTO evaluation_periods(name,eval_year,starts_at,ends_at,created_by) VALUES(?,?,?,?,?)",
      [...periodInput(req.body), req.user.id],
    );
    ok(res, { id: r.insertId }, "สร้างรอบแล้ว", 201);
  }),
);
router.put(
  "/periods/:id",
  wrap(async (req, res) => {
    await withPeriod(req.params.id, async (db, p) => {
      draft(p);
      await db.query(
        "UPDATE evaluation_periods SET name=?,eval_year=?,starts_at=?,ends_at=? WHERE id=?",
        [...periodInput(req.body), p.id],
      );
    });
    ok(res);
  }),
);
router.post(
  "/periods/:id/open",
  wrap(async (req, res) => {
    await withPeriod(req.params.id, async (db, p) => {
      draft(p);
      demand(thaiDate(p.ends_at) >= thaiDate(), 400, "รอบสิ้นสุดแล้ว");
      const [[c]] = await db.query(
        "SELECT COUNT(*) n FROM indicators WHERE period_id=?",
        [p.id],
      );
      demand(c.n > 0, 400, "ต้องมีตัวชี้วัด");
      const [people] = await db.query(
        'SELECT p.id,COUNT(a.id) total,SUM(a.committee_role="chair") chairs FROM period_participants p LEFT JOIN evaluator_assignments a ON a.participant_id=p.id WHERE p.period_id=? GROUP BY p.id',
        [p.id],
      );
      demand(
        people.length > 0 &&
          people.every((x) => x.total > 0 && Number(x.chairs) === 1),
        400,
        "ทุกคนต้องมีกรรมการและประธานหนึ่งคน",
      );
      const [[inactive]] = await db.query(
        "SELECT COUNT(*) n FROM evaluator_assignments a JOIN users u ON u.id=a.evaluator_id WHERE a.period_id=? AND u.is_active=0",
        [p.id],
      );
      demand(!inactive.n, 400, "มีกรรมการที่ปิดบัญชี");
      await db.query("UPDATE evaluation_periods SET status='open' WHERE id=?", [
        p.id,
      ]);
    });
    ok(res);
  }),
);
router.post(
  "/periods/:id/close",
  wrap(async (req, res) => {
    await withPeriod(req.params.id, async (db, p) => {
      demand(p.status === "open", 409, "ปิดได้เฉพาะรอบที่เปิด");
      await db.query(
        "UPDATE evaluation_periods SET status='closed' WHERE id=?",
        [p.id],
      );
    });
    ok(res);
  }),
);
router.post(
  "/periods/:id/publish",
  wrap(async (req, res) => {
    await withPeriod(req.params.id, async (db, p) => {
      demand(
        p.status !== "draft" && !p.published_at,
        409,
        "รอบยังไม่เปิดหรือเผยแพร่แล้ว",
      );
      const [[c]] = await db.query(
        "SELECT COUNT(*) total,SUM(status='submitted') done FROM evaluator_assignments WHERE period_id=?",
        [p.id],
      );
      demand(
        c.total > 0 && Number(c.done) === c.total,
        409,
        "กรรมการยังส่งไม่ครบ",
      );
      await db.query(
        "UPDATE evaluation_periods SET published_at=UTC_TIMESTAMP() WHERE id=?",
        [p.id],
      );
    });
    ok(res);
  }),
);
router.post(
  "/periods/:id/topics",
  wrap(async (req, res) => {
    const data = await withPeriod(req.params.id, async (db, p) => {
      draft(p);
      const [r] = await db.query(
        "INSERT INTO topics(period_id,name,description) VALUES(?,?,?)",
        [
          p.id,
          text(req.body.name, 200, true),
          text(req.body.description || "", 10000),
        ],
      );
      return { id: r.insertId };
    });
    ok(res, data, "เพิ่มหัวข้อแล้ว", 201);
  }),
);
router.put(
  "/topics/:id",
  wrap(async (req, res) => {
    const [[t]] = await pool.query("SELECT * FROM topics WHERE id=?", [
      id(req.params.id),
    ]);
    demand(t, 404, "ไม่พบหัวข้อ");
    await withPeriod(t.period_id, async (db, p) => {
      draft(p);
      await db.query("UPDATE topics SET name=?,description=? WHERE id=?", [
        text(req.body.name, 200, true),
        text(req.body.description || "", 10000),
        t.id,
      ]);
    });
    ok(res);
  }),
);
router.delete(
  "/topics/:id",
  wrap(async (req, res) => {
    const [[t]] = await pool.query("SELECT * FROM topics WHERE id=?", [
      id(req.params.id),
    ]);
    demand(t, 404, "ไม่พบหัวข้อ");
    await withPeriod(t.period_id, async (db, p) => {
      draft(p);
      await db.query("DELETE FROM topics WHERE id=?", [t.id]);
    });
    ok(res);
  }),
);
function indicatorInput(b) {
  demand(
    ["scale4", "boolean"].includes(b.score_type),
    400,
    "ชนิดคะแนนไม่ถูกต้อง",
  );
  demand(
    Number.isFinite(b.weight) && b.weight > 0 && b.weight <= 999999.99,
    400,
    "น้ำหนักต้องมากกว่า 0",
  );
  demand(
    ["none", "url", "file", "either"].includes(b.evidence_mode) &&
      typeof b.evidence_required === "boolean",
    400,
    "รูปแบบหลักฐานไม่ถูกต้อง",
  );
  demand(
    !(b.evidence_mode === "none" && b.evidence_required),
    400,
    "ห้ามบังคับหลักฐานเมื่อเลือกไม่ใช้หลักฐาน",
  );
  return [
    text(b.name, 200, true),
    text(b.description || "", 10000),
    b.weight,
    b.score_type,
    b.evidence_mode,
    b.evidence_required,
    text(b.evidence_instruction || "", 500),
  ];
}
router.post(
  "/topics/:id/indicators",
  wrap(async (req, res) => {
    const [[t]] = await pool.query("SELECT * FROM topics WHERE id=?", [
      id(req.params.id),
    ]);
    demand(t, 404, "ไม่พบหัวข้อ");
    const data = await withPeriod(t.period_id, async (db, p) => {
      draft(p);
      const [r] = await db.query(
        "INSERT INTO indicators(period_id,topic_id,name,description,weight,score_type,evidence_mode,evidence_required,evidence_instruction) VALUES(?,?,?,?,?,?,?,?,?)",
        [p.id, t.id, ...indicatorInput(req.body)],
      );
      return { id: r.insertId };
    });
    ok(res, data, "เพิ่มตัวชี้วัดแล้ว", 201);
  }),
);
router.put(
  "/indicators/:id",
  wrap(async (req, res) => {
    const [[i]] = await pool.query("SELECT * FROM indicators WHERE id=?", [
      id(req.params.id),
    ]);
    demand(i, 404, "ไม่พบตัวชี้วัด");
    await withPeriod(i.period_id, async (db, p) => {
      draft(p);
      await db.query(
        "UPDATE indicators SET name=?,description=?,weight=?,score_type=?,evidence_mode=?,evidence_required=?,evidence_instruction=? WHERE id=?",
        [...indicatorInput(req.body), i.id],
      );
    });
    ok(res);
  }),
);
router.delete(
  "/indicators/:id",
  wrap(async (req, res) => {
    const [[i]] = await pool.query("SELECT * FROM indicators WHERE id=?", [
      id(req.params.id),
    ]);
    demand(i, 404, "ไม่พบตัวชี้วัด");
    await withPeriod(i.period_id, async (db, p) => {
      draft(p);
      await db.query("DELETE FROM indicators WHERE id=?", [i.id]);
    });
    ok(res);
  }),
);
router.post(
  "/periods/:id/participants",
  wrap(async (req, res) => {
    const data = await withPeriod(req.params.id, async (db, p) => {
      draft(p);
      const [[u]] = await db.query(
        "SELECT id FROM users WHERE id=? AND role='evaluatee' AND is_active=1",
        [id(req.body.evaluatee_id)],
      );
      demand(u, 400, "ผู้รับไม่ถูกต้อง");
      const [r] = await db.query(
        "INSERT INTO period_participants(period_id,evaluatee_id) VALUES(?,?)",
        [p.id, u.id],
      );
      return { id: r.insertId };
    });
    ok(res, data, "เพิ่มผู้รับแล้ว", 201);
  }),
);
router.post(
  "/participants/:id/assignments",
  wrap(async (req, res) => {
    const [[person]] = await pool.query(
      "SELECT * FROM period_participants WHERE id=?",
      [id(req.params.id)],
    );
    demand(person, 404, "ไม่พบผู้รับ");
    const data = await withPeriod(person.period_id, async (db, p) => {
      draft(p);
      const [[u]] = await db.query(
        "SELECT id FROM users WHERE id=? AND role='evaluator' AND is_active=1",
        [id(req.body.evaluator_id)],
      );
      demand(u, 400, "กรรมการไม่ถูกต้อง");
      demand(
        ["chair", "member"].includes(req.body.committee_role),
        400,
        "บทบาทกรรมการไม่ถูกต้อง",
      );
      if (req.body.committee_role === "chair") {
        const [[c]] = await db.query(
          "SELECT COUNT(*) n FROM evaluator_assignments WHERE participant_id=? AND committee_role='chair'",
          [person.id],
        );
        demand(!c.n, 409, "มีประธานแล้ว");
      }
      const [r] = await db.query(
        "INSERT INTO evaluator_assignments(period_id,participant_id,evaluator_id,committee_role) VALUES(?,?,?,?)",
        [p.id, person.id, u.id, req.body.committee_role],
      );
      return { id: r.insertId };
    });
    ok(res, data, "มอบหมายแล้ว", 201);
  }),
);
router.delete(
  "/assignments/:id",
  wrap(async (req, res) => {
    const [[a]] = await pool.query(
      "SELECT * FROM evaluator_assignments WHERE id=?",
      [id(req.params.id)],
    );
    demand(a, 404, "ไม่พบการมอบหมาย");
    await withPeriod(a.period_id, async (db, p) => {
      draft(p);
      await db.query("DELETE FROM evaluator_assignments WHERE id=?", [a.id]);
    });
    ok(res);
  }),
);
module.exports = router;
