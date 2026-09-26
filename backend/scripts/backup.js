// CLI-only backup exercise. Restore always creates a NEW database, never overwrites one.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const { database, storage } = require("../lib/config");
const tables = [
  "users",
  "evaluation_periods",
  "topics",
  "indicators",
  "period_participants",
  "files",
  "evaluator_assignments",
  "self_assessments",
  "evidence_items",
  "evaluator_scores",
];
const hash = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");
async function create(target) {
  const db = await mysql.createConnection({ ...database, dateStrings: true });
  try {
    await db.beginTransaction();
    await db.query("SELECT id FROM evaluation_periods ORDER BY id FOR UPDATE");
    const snapshot = {
      format: "bpes-training-backup-v1",
      created_at: new Date().toISOString(),
      tables: {},
      files: [],
    };
    for (const name of tables) {
      const [rows] = await db.query("SELECT * FROM `" + name + "`");
      snapshot.tables[name] = rows;
    }
    for (const file of snapshot.tables.files) {
      const bytes = await fs.readFile(path.join(storage, file.storage_key));
      snapshot.files.push({
        key: file.storage_key,
        sha256: hash(bytes),
        base64: bytes.toString("base64"),
      });
    }
    await fs.writeFile(target, JSON.stringify(snapshot), { flag: "wx" });
    await db.commit();
    console.log(
      "Backup created. Contains account hashes and evidence: keep private.",
    );
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    await db.end();
  }
}
async function restore(source, name) {
  if (!/^bpes_training_restore_[a-zA-Z0-9_]+$/.test(name))
    throw new Error("Restore DB must start bpes_training_restore_");
  const stat = await fs.stat(source);
  if (stat.size > 128 * 1024 * 1024)
    throw new Error("Backup is too large for this teaching tool");
  const snap = JSON.parse(await fs.readFile(source, "utf8"));
  if (
    snap.format !== "bpes-training-backup-v1" ||
    tables.some((t) => !Array.isArray(snap.tables?.[t])) ||
    !Array.isArray(snap.files)
  )
    throw new Error("Invalid backup");
  const destination = path.join(__dirname, "../restores", name);
  const blobs = new Map();
  for (const f of snap.files) {
    if (!/^[a-f0-9-]{36}$/.test(f.key) || blobs.has(f.key))
      throw new Error("Invalid storage key");
    const bytes = Buffer.from(f.base64, "base64");
    if (hash(bytes) !== f.sha256) throw new Error("File checksum mismatch");
    blobs.set(f.key, bytes);
  }
  for (const f of snap.tables.files) {
    if (
      !blobs.has(f.storage_key) ||
      blobs.get(f.storage_key).length !== Number(f.size_bytes)
    )
      throw new Error("Missing file or wrong size");
  }
  const db = await mysql.createConnection({
    ...database,
    database: undefined,
    multipleStatements: true,
  });
  let created = false;
  try {
    const [[existing]] = await db.query(
      "SELECT COUNT(*) n FROM information_schema.schemata WHERE schema_name=?",
      [name],
    );
    if (existing.n)
      throw new Error("Target database exists; choose a NEW name");
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.mkdir(destination);
    await db.query(
      "CREATE DATABASE `" +
        name +
        "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    created = true;
    await db.query("USE `" + name + "`");
    await db.query(
      await fs.readFile(path.join(__dirname, "../schema.sql"), "utf8"),
    );
    await db.beginTransaction();
    for (const table of tables) {
      const [columns] = await db.query("SHOW COLUMNS FROM `" + table + "`");
      const allowed = new Set(columns.map((c) => c.Field));
      for (const row of snap.tables[table]) {
        const keys = Object.keys(row);
        if (!keys.length || keys.some((k) => !allowed.has(k)))
          throw new Error("Unknown column");
        await db.query(
          "INSERT INTO `" +
            table +
            "` (" +
            keys.map((k) => "`" + k + "`").join(",") +
            ") VALUES(" +
            keys.map(() => "?").join(",") +
            ")",
          keys.map((k) => row[k]),
        );
      }
    }
    for (const [key, bytes] of blobs)
      await fs.writeFile(path.join(destination, key), bytes, { flag: "wx" });
    await db.commit();
    console.log("Restored to NEW database:", name);
    console.log("STORAGE_DIR=" + destination);
    console.log(
      "Use an isolated test server and compare reports/files before adopting this restore.",
    );
  } catch (e) {
    await db.rollback().catch(() => {});
    if (created)
      console.error(
        "Restore incomplete; isolated target retained for inspection:",
        name,
      );
    throw e;
  } finally {
    await db.end();
  }
}
const [mode, file, name] = process.argv.slice(2);
if (!["create", "restore"].includes(mode) || !file) {
  console.error(
    "Usage: node backend/scripts/backup.js create <new.json> | restore <backup.json> <bpes_training_restore_newname>",
  );
  process.exitCode = 1;
} else
  (mode === "create"
    ? create(path.resolve(file))
    : restore(path.resolve(file), name)
  ).catch((e) => {
    console.error(e.code || e.message);
    process.exitCode = 1;
  });
