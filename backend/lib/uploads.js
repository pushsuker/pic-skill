const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const multer = require("multer");
const { storage } = require("./config");
const { demand } = require("./http");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
}).single("file");
function validateFile(file, purpose) {
  demand(file, 400, "เลือกไฟล์");
  const b = file.buffer;
  const png =
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const pdf = b.subarray(0, 5).toString() === "%PDF-";
  const mime = png
    ? "image/png"
    : jpeg
      ? "image/jpeg"
      : pdf
        ? "application/pdf"
        : null;
  const ext = path.extname(file.originalname).toLowerCase();
  demand(
    mime &&
      file.mimetype === mime &&
      (png
        ? ext === ".png"
        : jpeg
          ? [".jpg", ".jpeg"].includes(ext)
          : ext === ".pdf"),
    415,
    "อนุญาตเฉพาะไฟล์ PDF, PNG, JPEG ที่ชนิดและเนื้อหาตรงกัน",
  );
  demand(
    purpose !== "signature" || ((png || jpeg) && b.length <= 512 * 1024),
    400,
    "ลายเซ็นต้องเป็น PNG/JPEG ไม่เกิน 512 KB",
  );
  return mime;
}
async function saveFile(db, file, user, purpose) {
  const mime = validateFile(file, purpose);
  await fs.mkdir(storage, { recursive: true });
  const key = crypto.randomUUID();
  const target = path.join(storage, key);
  await fs.writeFile(target, file.buffer, { flag: "wx" });
  try {
    const [r] = await db.query(
      "INSERT INTO files(owner_id,storage_key,original_name,mime_type,size_bytes,purpose) VALUES(?,?,?,?,?,?)",
      [user.id, key, file.originalname.slice(0, 255), mime, file.size, purpose],
    );
    return { id: r.insertId, target };
  } catch (e) {
    await fs.unlink(target);
    throw e;
  }
}
async function discard(file) {
  if (file) await fs.unlink(file.target).catch(() => {});
}
module.exports = { upload, saveFile, discard };
