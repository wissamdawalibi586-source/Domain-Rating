/* ==========================================================
   Domains Rating — الخادم (Express + PostgreSQL / Neon)
   - يقدّم صفحة التقييم ولوحة الإدارة
   - POST /api/ratings        حفظ تقييم (عام)
   - POST /api/admin/login    تسجيل دخول الإدارة ← رمز جلسة
   - GET  /api/ratings        كل التقييمات (للإدارة فقط)
   - GET  /api/health         فحص الحالة
   ========================================================== */
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_HOURS = 12;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL غير معرّف — أضف رابط قاعدة بيانات Neon في متغيرات البيئة.");
  process.exit(1);
}
if (/\.\.\.|\*\*\*/.test(process.env.DATABASE_URL) || !/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
  console.error("DATABASE_URL يبدو مثالاً وليس رابطاً حقيقياً (فيه ... أو ***). انسخه كاملاً من Neon ← Connect ← Copy snippet.");
  process.exit(1);
}
if (!ADMIN_PASSWORD) console.warn("تحذير: ADMIN_PASSWORD غير معرّف — لوحة الإدارة معطّلة.");

const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  max: 5
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id          TEXT PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      visit       TEXT[]      NOT NULL DEFAULT '{}',
      scores      JSONB       NOT NULL DEFAULT '{}',
      tracks      JSONB       NOT NULL DEFAULT '{}',
      nps         SMALLINT,
      good        TEXT,
      improve     TEXT,
      contact     TEXT,
      client_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS ratings_created_at_idx ON ratings (created_at DESC);
    ALTER TABLE ratings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
    CREATE TABLE IF NOT EXISTS activities (
      id          SERIAL PRIMARY KEY,
      track       TEXT        NOT NULL,
      name        TEXT        NOT NULL,
      active      BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/* ---------- أدوات ---------- */
const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const score = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

function clean(body) {
  const r = body && typeof body === "object" ? body : {};
  const scores = {};
  for (const [k, v] of Object.entries(r.scores || {}).slice(0, 30)) {
    if (KEY_RE.test(k) && score(v)) scores[k] = v;
  }
  const tracks = {};
  for (const [k, v] of Object.entries(r.tracks || {}).slice(0, 10)) {
    if (KEY_RE.test(k) && v && score(v.score)) tracks[k] = { score: v.score, name: text(v.name, 80) };
  }
  const nps = Number.isInteger(r.nps) && r.nps >= 0 && r.nps <= 10 ? r.nps : null;
  const visit = Array.isArray(r.visit) ? r.visit.filter((x) => typeof x === "string" && KEY_RE.test(x)).slice(0, 6) : [];
  const id = typeof r.id === "string" && /^[a-z0-9]{6,40}$/.test(r.id) ? r.id : crypto.randomUUID().replace(/-/g, "");
  return { id, visit, scores, tracks, nps, good: text(r.good, 800), improve: text(r.improve, 800), contact: text(r.contact, 120) };
}

/* حد بسيط للطلبات لكل عنوان IP (في الذاكرة) */
function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now(), key = req.ip;
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ ok: false, error: "طلبات كثيرة — حاول لاحقاً" });
    list.push(now); hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

/* رموز جلسة الإدارة: exp.توقيع */
function sign(exp) { return crypto.createHmac("sha256", SESSION_SECRET).update(String(exp)).digest("hex"); }
function makeToken() { const exp = Date.now() + SESSION_HOURS * 36e5; return exp + "." + sign(exp); }
function validToken(t) {
  const [exp, sig] = String(t || "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function requireAdmin(req, res, next) {
  const t = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!validToken(t)) return res.status(401).json({ ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" });
  next();
}

/* ---------- التطبيق ---------- */
const app = express();
app.set("trust proxy", 1); // Render يمرّر الطلبات عبر وكيل
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  res.set("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.get("/api/health", async (req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, db: true }); }
  catch (e) { res.status(503).json({ ok: false, db: false }); }
});

app.post("/api/ratings", limiter(10, 60 * 60 * 1000), async (req, res) => {
  if (req.body && req.body.website) return res.json({ ok: true }); // روبوت
  const r = clean(req.body);
  if (!Object.keys(r.scores).length) return res.status(400).json({ ok: false, error: "تقييم فارغ" });
  const clientHash = crypto.createHash("sha256").update(req.ip + SESSION_SECRET).digest("hex").slice(0, 16);
  try {
    await pool.query(
      `INSERT INTO ratings (id, visit, scores, tracks, nps, good, improve, contact, client_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.visit, r.scores, r.tracks, r.nps, r.good, r.improve, r.contact, clientHash]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "تعذّر الحفظ" });
  }
});

app.post("/api/admin/login", limiter(8, 15 * 60 * 1000), (req, res) => {
  const pw = req.body && req.body.password;
  if (!ADMIN_PASSWORD || !pw || !safeEqual(pw, ADMIN_PASSWORD)) {
    return res.status(401).json({ ok: false, error: "كلمة السر غير صحيحة" });
  }
  res.json({ ok: true, token: makeToken() });
});

app.get("/api/ratings", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, visit, scores, tracks, nps, good, improve, contact, status
       FROM ratings ORDER BY created_at DESC LIMIT 20000`
    );
    res.json({ ok: true, responses: rows.map((r) => ({ ...r, ts: r.created_at.toISOString(), created_at: undefined })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "تعذّر جلب البيانات" });
  }
});

/* حالة متابعة الاقتراح: جديد / قيد العمل / تم الحل */
const STATUSES = ["new", "progress", "done"];
app.patch("/api/ratings/:id", requireAdmin, async (req, res) => {
  const status = req.body && req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ ok: false, error: "حالة غير صالحة" });
  try {
    const r = await pool.query("UPDATE ratings SET status = $1 WHERE id = $2", [status, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "التقييم غير موجود" });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "تعذّر الحفظ" }); }
});

app.delete("/api/ratings/:id", requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM ratings WHERE id = $1", [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "التقييم غير موجود" });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "تعذّر الحذف" }); }
});

/* قائمة أسماء التدريبات والفعاليات والمشاريع ومجالات التطوع */
const TRACK_IDS = ["training", "event", "project", "volunteer"];
app.get("/api/activities", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, track, name FROM activities WHERE active ORDER BY track, name");
    res.json({ ok: true, activities: rows });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "تعذّر جلب القائمة" }); }
});

app.post("/api/activities", requireAdmin, async (req, res) => {
  const track = req.body && req.body.track, name = text(req.body && req.body.name, 80);
  if (!TRACK_IDS.includes(track) || !name) return res.status(400).json({ ok: false, error: "اختر المسار واكتب الاسم" });
  try {
    const dup = await pool.query("SELECT 1 FROM activities WHERE active AND track = $1 AND lower(name) = lower($2)", [track, name]);
    if (dup.rowCount) return res.status(409).json({ ok: false, error: "الاسم موجود مسبقاً" });
    const { rows } = await pool.query("INSERT INTO activities (track, name) VALUES ($1, $2) RETURNING id, track, name", [track, name]);
    res.json({ ok: true, activity: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "تعذّر الحفظ" }); }
});

app.delete("/api/activities/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE activities SET active = false WHERE id = $1", [Number(req.params.id) || 0]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "تعذّر الحذف" }); }
});

app.use("/api", (req, res) => res.status(404).json({ ok: false, error: "not found" }));

/* الملفات الثابتة: الجذر = مجلد المشروع، مع حجب ملفات الخادم */
const ROOT = path.join(__dirname, "..");
app.use((req, res, next) => {
  if (/^\/(server|node_modules|\.git|\.env|package|render\.yaml|PROJECT\.md|backend)/i.test(req.path)) return res.status(404).end();
  next();
});
app.use((req, res, next) => {
  const p = req.path.replace(/\/+$/, "").toLowerCase();
  if ((p === "/admin" && !req.path.endsWith("/")) || p === "/domains-rating-admin") return res.redirect(301, "/admin/");
  next();
});
app.use(express.static(ROOT, { extensions: ["html"], maxAge: "1h" }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, "index.html")));

migrate()
  .then(() => app.listen(PORT, () => console.log("Domains Rating يعمل على المنفذ " + PORT)))
  .catch((e) => { console.error("فشل الاتصال بقاعدة البيانات:", e.message); process.exit(1); });
