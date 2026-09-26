const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { database } = require("../lib/config");
async function initialize(name = database.database) {
  if (!/^bpes_(training|kit_test)(_[a-zA-Z0-9]+)*$/.test(name))
    throw new Error(
      "Use a separate bpes_training or bpes_kit_test database; never the original bpes_db",
    );
  const db = await mysql.createConnection({
    ...database,
    database: undefined,
    multipleStatements: true,
  });
  try {
    await db.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await db.query(`USE \`${name}\``);
    await db.query(
      fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8"),
    );
    for (const [username, password, full_name, role] of [
      ["admin", "Admin1234!", "ฝ่ายบุคลากร", "admin"],
      ["eval01", "Eval1234!", "กรรมการหนึ่ง", "evaluator"],
      ["eval02", "Eval1234!", "กรรมการสอง", "evaluator"],
      ["emp001", "Emp1234!", "ผู้รับหนึ่ง", "evaluatee"],
      ["emp002", "Emp1234!", "ผู้รับสอง", "evaluatee"],
    ])
      await db.query(
        "INSERT IGNORE INTO users(username,password,full_name,role) VALUES(?,?,?,?)",
        [username, await bcrypt.hash(password, 10), full_name, role],
      );
    console.log("Ready:", name, "(existing users preserved)");
  } finally {
    await db.end();
  }
}
if (require.main === module)
  initialize().catch((e) => {
    console.error(e.code || e.message);
    process.exitCode = 1;
  });
module.exports = { initialize };
