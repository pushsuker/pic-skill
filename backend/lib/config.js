const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
module.exports = {
  database: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "bpes_training",
    charset: "utf8mb4",
    timezone: "Z",
  },
  storage: process.env.STORAGE_DIR || path.join(__dirname, "../storage"),
  secret: process.env.JWT_SECRET,
};
