const router = require("express").Router();
const path = require("node:path");
const fs = require("node:fs/promises");
const { pool } = require("../lib/db");
const { storage } = require("../lib/config");
const { wrap, demand, id } = require("../lib/http");
const { participant, canRead } = require("../lib/domain");
router.get(
  "/files/:id",
  wrap(async (req, res) => {
    const [[file]] = await pool.query("SELECT * FROM files WHERE id=?", [
      id(req.params.id),
    ]);
    demand(file, 404, "ไม่พบไฟล์");
    const [[e]] = await pool.query(
      "SELECT s.participant_id FROM evidence_items e JOIN self_assessments s ON s.id=e.self_assessment_id WHERE e.file_id=?",
      [file.id],
    );
    const [[a]] = await pool.query(
      "SELECT a.*,p.evaluatee_id,r.published_at FROM evaluator_assignments a JOIN period_participants p ON p.id=a.participant_id JOIN evaluation_periods r ON r.id=a.period_id WHERE a.signature_file_id=?",
      [file.id],
    );
    demand(e || a, 404, "ไฟล์ไม่มีรายการอ้างอิง");
    if (e) {
      await canRead(pool, await participant(pool, e.participant_id), req.user);
    } else
      demand(
        req.user.role === "admin" ||
          a.evaluator_id === req.user.id ||
          (a.evaluatee_id === req.user.id && a.published_at),
        403,
        "ยังไม่มีสิทธิ์ดูลายเซ็นนี้",
      );
    const buffer = await fs.readFile(path.join(storage, file.storage_key)).catch((err) => {
      demand(
        err.code !== "ENOENT",
        404,
        "ไม่พบไฟล์ในพื้นที่จัดเก็บ กรุณาให้ผู้ดูแลกู้คืนไฟล์จากสำรอง",
        "FILE_MISSING",
      );
      throw err;
    });
    res.set("Content-Type", file.mime_type);
    res.set(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
    );
    res.send(buffer);
  }),
);
module.exports = router;
