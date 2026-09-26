const mysql = require("mysql2/promise");
const { database } = require("./config");
const pool = mysql.createPool({ ...database, connectionLimit: 10 });
async function transaction(work) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const value = await work(db);
    await db.commit();
    return value;
  } catch (err) {
    await db.rollback();
    throw err;
  } finally {
    db.release();
  }
}
module.exports = { pool, transaction };
