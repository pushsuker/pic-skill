const jwt = require("jsonwebtoken");
const { pool } = require("./db");
const { secret } = require("./config");
const { demand } = require("./http");
if (!secret || secret.length < 32)
  throw new Error(
    "Run npm run configure: JWT_SECRET must have at least 32 characters",
  );
const safeUser = (u) => ({
  id: u.id,
  username: u.username,
  full_name: u.full_name,
  role: u.role,
  department: u.department,
  position: u.position,
  must_change_password: !!u.must_change_password,
});
const session = (u) => ({
  token: jwt.sign({ id: u.id, version: u.token_version }, secret, {
    expiresIn: "1h",
    algorithm: "HS256",
  }),
  user: safeUser(u),
});
// Call async authentication with next only after lookup completes.
function auth(req, res, next) {
  Promise.resolve()
    .then(async () => {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      demand(token, 401, "กรุณาเข้าสู่ระบบ");
      let payload;
      try {
        payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
      } catch {
        demand(false, 401, "Token ไม่ถูกต้องหรือหมดอายุ");
      }
      const [[u]] = await pool.query(
        "SELECT * FROM users WHERE id=? AND is_active=1",
        [payload.id],
      );
      demand(
        u && u.token_version === payload.version,
        401,
        "บัญชีหรือ Token ใช้งานไม่ได้",
      );
      req.user = u;
      demand(
        !u.must_change_password ||
          ["/auth/me", "/auth/change-password"].includes(req.path),
        403,
        "กรุณาเปลี่ยนรหัสผ่านก่อน",
        "PASSWORD_CHANGE_REQUIRED",
      );
    })
    .then(() => next(), next);
}
const role =
  (...roles) =>
  (req, res, next) => {
    try {
      demand(roles.includes(req.user.role), 403, "ไม่มีสิทธิ์ใช้งาน");
      next();
    } catch (e) {
      next(e);
    }
  };
module.exports = { auth, role, session, safeUser };
