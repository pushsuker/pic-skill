const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const { pool } = require("../lib/db");
const { wrap, ok, demand, text, password } = require("../lib/http");
const { session, safeUser } = require("../lib/security");
const publicRouter = express.Router(),
  privateRouter = express.Router();
publicRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    skipSuccessfulRequests: true,
    handler: (req, res) =>
      res
        .status(429)
        .json({
          status: "error",
          message: "ลองบ่อยเกินไป กรุณารอ",
          data: null,
        }),
  }),
);
publicRouter.post(
  "/login",
  wrap(async (req, res) => {
    const username = text(req.body.username, 50, true);
    demand(typeof req.body.password === "string", 400, "กรอกรหัสผ่าน");
    const [[u]] = await pool.query(
      "SELECT * FROM users WHERE username=? AND is_active=1",
      [username],
    );
    demand(
      u && (await bcrypt.compare(req.body.password, u.password)),
      401,
      "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    );
    ok(res, session(u));
  }),
);
publicRouter.post(
  "/register",
  wrap(async (req, res) => {
    demand(
      !req.body.role || req.body.role === "evaluatee",
      400,
      "สมัครได้เฉพาะผู้รับการประเมิน",
    );
    const { username, full_name, department = "", position = "" } = req.body;
    const hash = await bcrypt.hash(password(req.body.password), 10);
    const [r] = await pool.query(
      "INSERT INTO users(username,password,full_name,department,position,role,must_change_password) VALUES(?,?,?,?,?,'evaluatee',0)",
      [
        text(username, 50, true),
        hash,
        text(full_name, 100, true),
        text(department, 100),
        text(position, 100),
      ],
    );
    ok(res, { id: r.insertId }, "ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ", 201);
  }),
);
privateRouter.get(
  "/auth/me",
  wrap(async (req, res) => ok(res, safeUser(req.user))),
);
privateRouter.post(
  "/auth/change-password",
  wrap(async (req, res) => {
    const next = password(req.body.new_password);
    // First-login sessions have already authenticated with the initial password.
    // Later password changes still require the current password.
    if (!req.user.must_change_password) {
      demand(typeof req.body.old_password === "string", 400, "กรอกรหัสผ่านเดิม");
      demand(
        await bcrypt.compare(req.body.old_password, req.user.password),
        400,
        "รหัสผ่านเดิมไม่ถูกต้อง",
      );
    }
    demand(
      !(await bcrypt.compare(next, req.user.password)),
      400,
      "รหัสใหม่ต้องต่างจากเดิม",
    );
    const [updated] = await pool.query(
      "UPDATE users SET password=?,must_change_password=0,token_version=token_version+1 WHERE id=? AND token_version=?",
      [await bcrypt.hash(next, 10), req.user.id, req.user.token_version],
    );
    demand(
      updated.affectedRows === 1,
      409,
      "บัญชีเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่",
    );
    ok(
      res,
      session({
        ...req.user,
        must_change_password: 0,
        token_version: req.user.token_version + 1,
      }),
    );
  }),
);
privateRouter.put(
  "/profile",
  wrap(async (req, res) => {
    demand(!("role" in req.body), 400, "แก้ไขบทบาทไม่ได้");
    const { full_name, department = "", position = "" } = req.body;
    await pool.query(
      "UPDATE users SET full_name=?,department=?,position=? WHERE id=?",
      [
        text(full_name, 100, true),
        text(department, 100),
        text(position, 100),
        req.user.id,
      ],
    );
    const [[u]] = await pool.query("SELECT * FROM users WHERE id=?", [
      req.user.id,
    ]);
    ok(res, safeUser(u));
  }),
);
module.exports = { publicRouter, privateRouter };
