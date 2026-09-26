const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const { pool } = require("./lib/db");
const { auth } = require("./lib/security");
const { ok, wrap, errorHandler } = require("./lib/http");
const { publicRouter, privateRouter } = require("./routes/auth");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "150kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});
app.get(
  "/api/health",
  wrap(async (req, res) => {
    await pool.query("SELECT id FROM users LIMIT 1");
    ok(res, { ready: true });
  }),
);
app.use("/api/auth", publicRouter);
app.use("/api", auth, privateRouter);
app.use("/api", require("./routes/catalog").router);
app.use("/api", require("./routes/assessments"));
app.use("/api", require("./routes/files"));
app.use("/api", require("./routes/reports"));
app.use("/api", require("./routes/admin"));
app.use("/api", (req, res) =>
  res.status(404).json({ status: "error", message: "ไม่พบ API", data: null }),
);
const dist = path.join(__dirname, "../dist");
app.use(express.static(dist));
app.get("*", (req, res) => {
  if (!fs.existsSync(path.join(dist, "index.html")))
    return res.status(503).send("Run npm run build first");
  res.sendFile(path.join(dist, "index.html"));
});
app.use(errorHandler);
module.exports = app;
