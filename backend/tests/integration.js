// Run only through `npm test`. This runner creates and drops its own database.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const name = `bpes_kit_test_${process.pid}_${Date.now()}`;
process.env.DB_NAME = name;
process.env.JWT_SECRET = "training-test-secret-at-least-32-characters";
process.env.STORAGE_DIR = path.join(os.tmpdir(), name);
const { initialize } = require("../scripts/setup");
const { database } = require("../lib/config");
const mysql = require("mysql2/promise");
const { promisify } = require("node:util");
const execFile = promisify(require("node:child_process").execFile);
const restoredName = `bpes_training_restore_test_${process.pid}_${Date.now()}`;
let restoreCreated = false;
let server,
  pool,
  initialized = false,
  checks = 0;
async function main() {
  await initialize(name);
  initialized = true;
  const app = require("../app");
  pool = require("../lib/db").pool;
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(method, url, token, body, status = 200) {
    const form = body instanceof FormData;
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !form ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
    const json = await res.json();
    assert.equal(
      res.status,
      status,
      `${method} ${url}: ${JSON.stringify(json)}`,
    );
    checks++;
    return json.data;
  }
  const get = (url, token, status) => call("GET", url, token, null, status);
  async function login(username, password) {
    const s = await call("POST", "/auth/login", null, { username, password });
    if (s.user.must_change_password)
      return (
        await call("POST", "/auth/change-password", s.token, {
          new_password: "Changed1234!",
        })
      ).token;
    return s.token;
  }
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNuoAAAAASUVORK5CYII=",
    "base64",
  );
  const file = (name, mime, bytes) => {
    const f = new FormData();
    f.append("file", new Blob([bytes], { type: mime }), name);
    return f;
  };
  await get("/health");
  await call(
    "POST",
    "/auth/login",
    null,
    { username: "admin", password: "wrong" },
    401,
  );
  await get("/periods", null, 401);
  const initial = await call("POST", "/auth/login", null, {
    username: "admin",
    password: "Admin1234!",
  });
  await get("/periods", initial.token, 403);
  await call("POST", "/auth/change-password", initial.token, { new_password: "short" }, 400);
  await call("POST", "/auth/change-password", initial.token, { new_password: "Admin1234!" }, 400);
  const admin = await login("admin", "Admin1234!"),
    self = await login("emp001", "Emp1234!"),
    other = await login("emp002", "Emp1234!"),
    eval1 = await login("eval01", "Eval1234!"),
    eval2 = await login("eval02", "Eval1234!");
  await get("/periods", initial.token, 401);
  await call("POST", "/auth/change-password", admin, { new_password: "Another1234!" }, 400);
  await call("POST", "/auth/change-password", admin, { old_password: "incorrect", new_password: "Another1234!" }, 400);
  await call("POST", "/auth/login", null, { username: "admin", password: "Admin1234!" }, 401);
  await call("POST", "/auth/login", null, { username: "admin", password: "Changed1234!" });
  await get("/users", self, 403);
  await call(
    "POST",
    "/auth/register",
    null,
    { username: "evil", password: "Safe12345!", full_name: "X", role: "admin" },
    400,
  );
  const registered = await call(
    "POST",
    "/auth/register",
    null,
    { username: "student", password: "Student1234!", full_name: "นักเรียน" },
    201,
  );
  assert(registered.id);
  await call(
    "POST",
    "/auth/register",
    null,
    { username: "student", password: "Student1234!", full_name: "นักเรียน" },
    409,
  );
  await call("PUT", "/profile", self, {
    full_name: "ผู้รับทดสอบ",
    department: "IT",
    position: "ครู",
  });
  assert.equal((await get("/auth/me", self)).full_name, "ผู้รับทดสอบ");
  await call("PUT", "/profile", self, { full_name: "X", role: "admin" }, 400);
  const users = await get("/users", admin),
    emp = users.find((u) => u.username === "emp001"),
    e1 = users.find((u) => u.username === "eval01"),
    e2 = users.find((u) => u.username === "eval02");
  const form = {
    name: "รอบฝึก",
    eval_year: 2026,
    starts_at: require("../lib/period-dates").thaiDate(),
    ends_at: require("../lib/period-dates").thaiDate(),
  };
  await call(
    "POST",
    "/periods",
    admin,
    { ...form, ends_at: "2000-01-01" },
    400,
  );
  const period = await call("POST", "/periods", admin, form, 201);
  const pid = period.id;
  const savedPeriod = (await get(`/periods/${pid}`, admin)).period;
  assert.equal(require("../lib/period-dates").thaiDate(savedPeriod.starts_at), form.starts_at);
  assert.equal(require("../lib/period-dates").thaiDate(savedPeriod.ends_at), form.ends_at);
  checks += 2;
  await call("PUT", `/periods/${pid}`, admin, { ...form, starts_at: "2026-02-30" }, 400);
  await call("PUT", `/periods/${pid}`, admin, { ...form, starts_at: new Date().toISOString() }, 400);
  await call("PUT", `/periods/${pid}`, admin, form);
  await call("POST", `/periods/${pid}/open`, admin, {}, 400);
  const topic = await call(
    "POST",
    `/periods/${pid}/topics`,
    admin,
    { name: "งานสอน" },
    201,
  );
  const topic2 = await call(
    "POST",
    `/periods/${pid}/topics`,
    admin,
    { name: "พัฒนาตนเอง" },
    201,
  );
  const indicators = [];
  for (const b of [
    {
      name: "ผลงาน",
      weight: 60,
      score_type: "scale4",
      evidence_mode: "file",
      evidence_required: true,
    },
    {
      name: "มีแผนงาน",
      weight: 20,
      score_type: "boolean",
      evidence_mode: "url",
      evidence_required: true,
    },
    {
      name: "พัฒนา",
      weight: 20,
      score_type: "scale4",
      evidence_mode: "none",
      evidence_required: false,
    },
  ])
    indicators.push(
      await call(
        "POST",
        `/topics/${indicators.length === 2 ? topic2.id : topic.id}/indicators`,
        admin,
        b,
        201,
      ),
    );
  await call(
    "POST",
    `/topics/${topic.id}/indicators`,
    admin,
    {
      name: "ผิด",
      weight: 0,
      score_type: "scale4",
      evidence_mode: "none",
      evidence_required: false,
    },
    400,
  );
  const person = await call(
    "POST",
    `/periods/${pid}/participants`,
    admin,
    { evaluatee_id: emp.id },
    201,
  );
  await call(
    "POST",
    `/periods/${pid}/participants`,
    admin,
    { evaluatee_id: emp.id },
    409,
  );
  const a1 = await call(
    "POST",
    `/participants/${person.id}/assignments`,
    admin,
    { evaluator_id: e1.id, committee_role: "chair" },
    201,
  );
  await call(
    "POST",
    `/participants/${person.id}/assignments`,
    admin,
    { evaluator_id: e2.id, committee_role: "chair" },
    409,
  );
  const a2 = await call(
    "POST",
    `/participants/${person.id}/assignments`,
    admin,
    { evaluator_id: e2.id, committee_role: "member" },
    201,
  );
  await call(
    "PUT",
    `/participants/${person.id}/self-assessments/${indicators[0].id}`,
    self,
    { score: 3, narrative: "ก่อนเปิด" },
    403,
  );
  await call("POST", `/periods/${pid}/open`, admin, {});
  await call("PUT", `/periods/${pid}`, admin, form, 409);
  await call(
    "POST",
    `/periods/${pid}/topics`,
    admin,
    { name: "ห้ามแก้ชุดเดิม" },
    409,
  );
  await get(`/periods/${pid}`, other, 403);
  await get(`/assignments/${a1.id}`, eval2, 403);
  await call(
    "PUT",
    `/assignments/${a1.id}/scores/${indicators[0].id}`,
    eval1,
    { score: 4 },
    409,
  );
  await call("POST", `/participants/${person.id}/submit`, self, {}, 400);
  await call(
    "PUT",
    `/participants/${person.id}/self-assessments/${indicators[1].id}`,
    self,
    { score: 4, narrative: "" },
    400,
  );
  await call(
    "PUT",
    `/participants/${person.id}/self-assessments/${indicators[0].id}`,
    other,
    { score: 4, narrative: "" },
    403,
  );
  const selves = [];
  for (let i = 0; i < 3; i++)
    selves.push(
      await call(
        "PUT",
        `/participants/${person.id}/self-assessments/${indicators[i].id}`,
        self,
        { score: i === 1 ? 0 : 3, narrative: "ตัวอย่างผลงาน" },
      ),
    );
  const before = await get(`/periods/${pid}/me/assessment`, self);
  assert.equal(before.indicators[1].self_score, 0);
  checks++;
  await call("POST", `/participants/${person.id}/submit`, self, {}, 400);
  await call(
    "POST",
    `/self-assessments/${selves[0].id}/evidence`,
    self,
    file("fake.pdf", "application/pdf", "not a pdf"),
    415,
  );
  await call(
    "POST",
    `/self-assessments/${selves[0].id}/evidence`,
    self,
    file("large.pdf", "application/pdf", Buffer.alloc(6 * 1024 * 1024)),
    413,
  );
  await call(
    "POST",
    `/self-assessments/${selves[0].id}/evidence`,
    self,
    file("proof.pdf", "application/pdf", "%PDF-1.4\n%%EOF"),
    201,
  );
  await call(
    "POST",
    `/self-assessments/${selves[1].id}/evidence`,
    self,
    { url: "javascript:alert(1)" },
    400,
  );
  await call(
    "POST",
    `/self-assessments/${selves[1].id}/evidence`,
    self,
    { url: "https://example.com/proof" },
    201,
  );
  const d = await get(`/periods/${pid}/me/assessment`, self);
  const fid = d.indicators[0].evidence[0].file_id;
  assert.equal(
    (
      await fetch(base + `/files/${fid}`, {
        headers: { Authorization: `Bearer ${self}` },
      })
    ).status,
    200,
  );
  checks++;
  await get(`/files/${fid}`, other, 403);
  await call("POST", `/participants/${person.id}/submit`, self, {});
  await call(
    "PUT",
    `/participants/${person.id}/self-assessments/${indicators[0].id}`,
    self,
    { score: 4 },
    409,
  );
  await call(
    "DELETE",
    `/evidence/${d.indicators[0].evidence[0].id}`,
    self,
    null,
    409,
  );
  await call(
    "POST",
    `/assignments/${a1.id}/submit`,
    eval1,
    { overall_feedback: "ยังไม่ครบ" },
    400,
  );
  for (let i = 0; i < 3; i++) {
    await call(
      "PUT",
      `/assignments/${a1.id}/scores/${indicators[i].id}`,
      eval1,
      { score: [4, 1, 1][i] },
    );
    await call(
      "PUT",
      `/assignments/${a2.id}/scores/${indicators[i].id}`,
      eval2,
      { score: [4, 0, 3][i] },
    );
  }
  const one = await get(`/assignments/${a1.id}`, eval1),
    two = await get(`/assignments/${a2.id}`, eval2);
  assert.notDeepEqual(one.scores, two.scores);
  checks++;
  await call(
    "POST",
    `/assignments/${a1.id}/submit`,
    eval1,
    { overall_feedback: "ยังไม่มีลายเซ็น" },
    400,
  );
  await call(
    "POST",
    `/assignments/${a1.id}/signature`,
    eval1,
    file("sign.pdf", "application/pdf", "%PDF-1.4\n%%EOF"),
    400,
  );
  await call(
    "POST",
    `/assignments/${a1.id}/signature`,
    eval1,
    file("sign.png", "image/png", png),
    201,
  );
  const statuses = await Promise.all(
    [1, 2].map(() =>
      fetch(base + `/assignments/${a1.id}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${eval1}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overall_feedback: "กรรมการหนึ่งเห็นว่าเหมาะสม",
        }),
      }).then((r) => r.status),
    ),
  );
  assert.deepEqual(statuses.sort(), [200, 409]);
  checks++;
  await call(
    "PUT",
    `/assignments/${a1.id}/scores/${indicators[0].id}`,
    eval1,
    { score: 1 },
    409,
  );
  await call("POST", `/periods/${pid}/publish`, admin, {}, 409);
  assert.equal(
    (await get(`/periods/${pid}/report`, admin)).statistics.completed,
    0,
  );
  checks++;
  await call("PUT", `/assignments/${a2.id}/scores/${indicators[2].id}`, eval2, {
    score: 3,
  });
  await call(
    "POST",
    `/assignments/${a2.id}/signature`,
    eval2,
    file("sign.png", "image/png", png),
    201,
  );
  await call("POST", `/assignments/${a2.id}/submit`, eval2, {
    overall_feedback: "กรรมการสองเสนอให้พัฒนาอย่างต่อเนื่อง",
  });
  await get(`/participants/${person.id}/result`, self, 403);
  const report = await get(`/periods/${pid}/report`, admin);
  assert.equal(report.rows[0].assignments[0].percentage, 85);
  assert.equal(report.rows[0].assignments[1].percentage, 75);
  assert.equal(report.statistics.average, 80);
  checks += 3;
  await call("POST", `/periods/${pid}/publish`, admin, {});
  const result = await get(`/participants/${person.id}/result`, self);
  assert.equal(result.percentage, 80);
  checks++;
  // A missing stored signature must not make the result unavailable.
  const signatureId = result.assignments[0].signature_file_id;
  const [[signatureFile]] = await pool.query("SELECT storage_key FROM files WHERE id=?", [signatureId]);
  const signaturePath = path.join(process.env.STORAGE_DIR, signatureFile.storage_key);
  const signatureBytes = await fs.readFile(signaturePath);
  await fs.unlink(signaturePath);
  try {
    const missing = await fetch(`${base}/files/${signatureId}`, {
      headers: { Authorization: `Bearer ${self}` },
    });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, "FILE_MISSING");
    assert.equal((await get(`/participants/${person.id}/result`, self)).percentage, 80);
    checks += 3;
  } finally {
    await fs.writeFile(signaturePath, signatureBytes);
  }
  await get(`/participants/${person.id}/result`, other, 403);
  await call("POST", `/periods/${pid}/close`, admin, {});
  await call(
    "PUT",
    `/assignments/${a2.id}/scores/${indicators[2].id}`,
    eval2,
    { score: 4 },
    403,
  );
  const nextPeriod = await call(
    "POST",
    "/periods",
    admin,
    { ...form, name: "รอบใหม่" },
    201,
  );
  const nextTopic = await call(
    "POST",
    `/periods/${nextPeriod.id}/topics`,
    admin,
    { name: "รอบใหม่" },
    201,
  );
  const nextIndicator = await call(
    "POST",
    `/topics/${nextTopic.id}/indicators`,
    admin,
    {
      name: "คนละรอบ",
      weight: 1,
      score_type: "scale4",
      evidence_mode: "none",
      evidence_required: false,
    },
    201,
  );
  // Composite foreign key rejects a cross-period score even if API validation is bypassed.
  await assert.rejects(() =>
    pool.query(
      "INSERT INTO evaluator_scores(period_id,assignment_id,indicator_id,score) VALUES(?,?,?,4)",
      [pid, a1.id, nextIndicator.id],
    ),
  );
  checks++;
  assert.equal(
    (await get(`/participants/${person.id}/result`, self)).percentage,
    80,
  );
  checks++;
  const { percentage } = require("../lib/domain");
  assert.equal(
    percentage(
      [{ id: 1, weight: 1, score_type: "boolean" }],
      new Map([[1, 0]]),
    ),
    0,
  );
  assert.equal(
    percentage([{ id: 1, weight: 1, score_type: "scale4" }], new Map()),
    null,
  );
  checks += 2;
  const backupFile = path.join(process.env.STORAGE_DIR, "snapshot.json");
  const backupScript = path.join(__dirname, "../scripts/backup.js");
  await execFile(process.execPath, [backupScript, "create", backupFile]);
  const snapshot = JSON.parse(await fs.readFile(backupFile, "utf8"));
  assert(snapshot.files.length >= 3);
  await execFile(process.execPath, [
    backupScript,
    "restore",
    backupFile,
    restoredName,
  ]);
  restoreCreated = true;
  const restored = await mysql.createConnection({
    ...database,
    database: restoredName,
  });
  try {
    for (const [table, rows] of Object.entries(snapshot.tables)) {
      const [[count]] = await restored.query(
        "SELECT COUNT(*) n FROM `" + table + "`",
      );
      assert.equal(count.n, rows.length);
      checks++;
    }
    const [[zero]] = await restored.query(
      "SELECT COUNT(*) n FROM evaluator_scores WHERE score=0",
    );
    assert(zero.n > 0);
    checks++;
    for (const file of snapshot.files) {
      const bytes = await fs.readFile(
        path.join(__dirname, "../restores", restoredName, file.key),
      );
      assert.equal(
        require("node:crypto").createHash("sha256").update(bytes).digest("hex"),
        file.sha256,
      );
      checks++;
    }
    await assert.rejects(() =>
      execFile(process.execPath, [
        backupScript,
        "restore",
        backupFile,
        restoredName,
      ]),
    );
    checks++;
  } finally {
    await restored.end();
  }
  console.log(
    `PASS ${checks} assertions: auth, CRUD, registration, profile, periods, assignment, boolean 0, uploads, permissions, concurrent submit, locks, weighted 85/75/80, reports, cross-period FK and backup/restore.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    if (initialized) {
      assert(/^bpes_kit_test_\d+_\d+$/.test(name));
      const db = await mysql.createConnection({
        ...database,
        database: undefined,
      });
      try {
        await db.query("DROP DATABASE `" + name + "`");
        if (restoreCreated) {
          assert(/^bpes_training_restore_test_\d+_\d+$/.test(restoredName));
          await db.query("DROP DATABASE `" + restoredName + "`");
          const restoreTarget = path.resolve(
            __dirname,
            "../restores",
            restoredName,
          );
          assert.equal(
            path.dirname(restoreTarget),
            path.resolve(__dirname, "../restores"),
          );
          await fs.rm(restoreTarget, { recursive: true, force: true });
        }
      } finally {
        await db.end();
      }
    }
    const target = path.resolve(process.env.STORAGE_DIR);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.equal(path.basename(target), name);
    await fs.rm(target, { recursive: true, force: true });
    console.log("Temporary test database/storage cleaned.");
  });
