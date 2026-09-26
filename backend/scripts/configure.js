const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const target = path.join(__dirname, "../.env");
let content = fs.existsSync(target)
  ? fs.readFileSync(target, "utf8")
  : fs.readFileSync(path.join(__dirname, "../.env.example"), "utf8");
if ((content.match(/^JWT_SECRET=(.*)$/m)?.[1].trim().length || 0) < 32) {
  content = content.replace(
    /^JWT_SECRET=.*$/m,
    "JWT_SECRET=" + crypto.randomBytes(48).toString("hex"),
  );
}
fs.writeFileSync(target, content);
console.log(
  "Configured backend/.env. Set DB connection before db:setup. Secret is not printed.",
);
