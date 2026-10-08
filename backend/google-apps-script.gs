/**
 * Domains Rating — الخادم (Google Apps Script + Google Sheets)
 * ------------------------------------------------------------
 * طريقة التركيب (بالتفصيل في PROJECT.md):
 * 1) أنشئ Google Sheet جديد باسم "Domains Ratings".
 * 2) Extensions → Apps Script، امسح الكود والصق هذا الملف كاملاً.
 * 3) Deploy → New deployment → Web app
 *      Execute as: Me    |    Who has access: Anyone
 * 4) انسخ رابط Web app وضعه في assets/js/config.js داخل API_URL.
 */

var ADMIN_KEY = "wiss";          // نفس كلمة سر لوحة الإدارة
var SHEET_NAME = "Responses";
var MAX_TEXT = 1000;

var HEADERS = [
  "timestamp", "id", "visit",
  "clean", "quiet", "comfort", "light", "staff", "order", "app_install", "app_overall", "social",
  "training", "training_name", "event", "event_name", "project", "project_name", "volunteer", "volunteer_name",
  "nps", "good", "improve", "contact", "json"
];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clip_(s) { return String(s == null ? "" : s).slice(0, MAX_TEXT); }
function score_(v, max) { v = Number(v); return v >= (max === 10 ? 0 : 1) && v <= (max || 5) ? Math.round(v) : ""; }

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== "submit" || !body.response) return json_({ ok: false, error: "bad request" });
    var r = body.response, s = r.scores || {}, t = r.tracks || {};
    var clean = {
      id: clip_(r.id), ts: new Date().toISOString(),
      visit: (r.visit || []).slice(0, 6).map(clip_),
      scores: {}, tracks: {},
      nps: r.nps === null || r.nps === undefined ? null : score_(r.nps, 10),
      good: clip_(r.good), improve: clip_(r.improve), contact: clip_(r.contact).slice(0, 120)
    };
    ["clean", "quiet", "comfort", "light", "staff", "order", "app_install", "app_overall", "social"].forEach(function (k) {
      if (s[k]) clean.scores[k] = score_(s[k]);
    });
    ["training", "event", "project", "volunteer"].forEach(function (k) {
      if (t[k] && t[k].score) clean.tracks[k] = { score: score_(t[k].score), name: clip_(t[k].name).slice(0, 80) };
    });

    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      sheet_().appendRow([
        clean.ts, clean.id, clean.visit.join(","),
        clean.scores.clean || "", clean.scores.quiet || "", clean.scores.comfort || "", clean.scores.light || "",
        clean.scores.staff || "", clean.scores.order || "", clean.scores.app_install || "", clean.scores.app_overall || "", clean.scores.social || "",
        (clean.tracks.training || {}).score || "", (clean.tracks.training || {}).name || "",
        (clean.tracks.event || {}).score || "", (clean.tracks.event || {}).name || "",
        (clean.tracks.project || {}).score || "", (clean.tracks.project || {}).name || "",
        (clean.tracks.volunteer || {}).score || "", (clean.tracks.volunteer || {}).name || "",
        clean.nps === null ? "" : clean.nps, clean.good, clean.improve, clean.contact,
        JSON.stringify(clean)
      ]);
    } finally { lock.releaseLock(); }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action !== "list") return json_({ ok: true, service: "Domains Rating" });
  if (p.key !== ADMIN_KEY) return json_({ ok: false, error: "كلمة السر غير صحيحة" });
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return json_({ ok: true, responses: [] });
  var col = HEADERS.indexOf("json") + 1;
  var values = sh.getRange(2, col, last - 1, 1).getValues();
  var out = [];
  values.forEach(function (row) { try { out.push(JSON.parse(row[0])); } catch (x) {} });
  return json_({ ok: true, responses: out });
}
