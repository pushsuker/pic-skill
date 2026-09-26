class ApiError extends Error {
  constructor(status, message, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
function demand(condition, status, message, code) {
  if (!condition) throw new ApiError(status, message, code);
}
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const ok = (res, data = null, message = "สำเร็จ", status = 200) =>
  res.status(status).json({ status: "success", message, data });
function id(value) {
  demand(
    /^\d+$/.test(String(value)) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) > 0,
    400,
    "รหัสไม่ถูกต้อง",
  );
  return Number(value);
}
function text(value, max, required = false) {
  demand(
    typeof value === "string" &&
      value.length <= max &&
      (!required || value.trim()),
    400,
    `ข้อความต้อง${required ? "ไม่ว่างและ" : ""}ยาวไม่เกิน ${max} ตัวอักษร`,
  );
  return value.trim();
}
function password(value) {
  demand(
    typeof value === "string" &&
      value.length >= 8 &&
      Buffer.byteLength(value) <= 72,
    400,
    "รหัสผ่านอย่างน้อย 8 ตัวอักษร ไม่เกิน 72 ไบต์",
  );
  return value;
}
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  let code = err.code || "SERVER_ERROR";
  if (err.code === "ER_DUP_ENTRY") {
    status = 409;
    message = "ข้อมูลซ้ำ";
  }
  if (
    err.code === "ER_ROW_IS_REFERENCED_2" ||
    err.code === "ER_NO_REFERENCED_ROW_2"
  ) {
    status = 409;
    message = "ข้อมูลมีความสัมพันธ์ที่ไม่อนุญาตให้เปลี่ยน";
  }
  if (err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large") {
    status = 413;
    message = "ไฟล์หรือข้อมูลใหญ่เกินกำหนด";
  }
  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "JSON ไม่ถูกต้อง";
  }
  if (status === 500) {
    console.error(err.code || err.name);
    message = "ระบบขัดข้อง";
  }
  res.status(status).json({ status: "error", message, data: null, code });
}
module.exports = {
  ApiError,
  demand,
  wrap,
  ok,
  id,
  text,
  password,
  errorHandler,
};
