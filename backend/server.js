const app = require("./app");
const { pool } = require("./lib/db");
const server = app.listen(
  Number(process.env.PORT || 3101),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "PIC training: http://localhost:" + (process.env.PORT || 3101),
    ),
);
function stop() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
