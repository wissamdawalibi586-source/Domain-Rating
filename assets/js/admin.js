/* ==========================================================
   Domains Rating — لوحة الإدارة (الإصدار 0.3)
   ========================================================== */
(function () {
  var CFG = window.DOMAINS_CONFIG, Store = window.DomainsStore, icon = window.domainsIcon;
  var GROUPS = window.DOMAINS_GROUPS, ITEMS = window.domainsAllItems(), TRACKS = window.DOMAINS_TRACKS, VISIT = window.DOMAINS_VISIT, SCALE = window.DOMAINS_SCALE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DAY = 864e5, REFRESH_MS = 60000;

  /* ---------- الحالة ---------- */
  var all = [], acts = [], range = 30, from = null, to = null, visit = "", tab = "overview";
  var cf = { score: "all", topic: "", status: "all", reply: false, search: "", limit: 20 };
  var month = { a: "", b: "" };
  var lastSync = 0, signature = "", online = true, timer = null;

  /* ---------- أدوات ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function fmt(x, d) { return x == null || isNaN(x) ? "–" : x.toFixed(d == null ? 1 : d); }
  function sClass(v) { return v == null ? "" : v >= 4 ? "good" : v >= 3 ? "mid" : "bad"; }
  function sWord(v) { return v == null ? "" : v >= 4 ? "جيد" : v >= 3 ? "متوسط" : "ضعيف"; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : n >= 3 && n <= 10 ? many : one); }
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  }
  function ts(r) { return new Date(r.ts).getTime(); }
  function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dateLabel(t, opts) { return new Date(t).toLocaleDateString("ar", opts || { day: "numeric", month: "short" }); }

  /* مواضيع التعليقات (D1) — كلمات مفتاحية بعد التطبيع */
  var TOPICS = [
    { id: "heat",   name: "التدفئة والجو",        words: ["تدفئ", "دفا", "برد", "بارد", "حر", "شوب", "مكيف", "تكييف", "تهوي", "حراره"] },
    { id: "noise",  name: "الهدوء والضجة",        words: ["ضجه", "ضجيج", "صوت", "هدوء", "ازعاج", "عالي", "حكي"] },
    { id: "clean",  name: "النظافة",               words: ["نظاف", "نظيف", "وسخ", "حمام", "مطبخ", "ريحه", "قمام", "غبره"] },
    { id: "light",  name: "الإضاءة",               words: ["اضاء", "ضو", "انار", "عتم", "لمبه"] },
    { id: "power",  name: "الكهرباء والإنترنت",    words: ["كهربا", "مقابس", "مقبس", "فيش", "شاحن", "شحن", "انترنت", "نت ", "واي فاي", "wifi", "شبكه"] },
    { id: "app",    name: "التطبيق والحجز",        words: ["تطبيق", "حجز", "ابلكيشن", "app", "تسجيل", "حساب"] },
    { id: "staff",  name: "الفريق والتعامل",       words: ["فريق", "موظف", "تعامل", "لطيف", "احترام", "مشرف", "استقبال"] },
    { id: "space",  name: "المقاعد والمساحة",      words: ["كرسي", "كراسي", "طاول", "مقاعد", "مساحه", "زحم", "ازدحام", "مكان ضيق"] },
    { id: "order",  name: "المواعيد والتنظيم",     words: ["موعد", "مواعيد", "تاخير", "تاخر", "نظام", "انضباط", "دوام"] },
    { id: "tracks", name: "التدريبات والفعاليات",  words: ["تدريب", "ورشه", "فعالي", "مدرب", "محاضر", "مشروع", "تطوع"] },
    { id: "social", name: "السوشيال ميديا",        words: ["انستغرام", "انستا", "سوشيال", "منشور", "محتوي", "فيسبوك", "صفحه"] }
  ];
  var SENSITIVE = ["تحرش", "اهانه", "ضرب", "سرقه", "خطر", "شتم", "تنمر", "عنصري", "حريق", "اذي", "مسروق"];
  var CAT_TOPICS = { clean: ["clean"], quiet: ["noise"], comfort: ["heat", "space"], light: ["light"], staff: ["staff"], order: ["order"], app_install: ["app"], app_overall: ["app"], social: ["social"] };
  var STATUS = [{ id: "new", t: "جديد" }, { id: "progress", t: "قيد العمل" }, { id: "done", t: "تم الحل" }];

  function textOf(r) { return norm((r.good || "") + " " + (r.improve || "")); }
  function topicsOf(r) {
    var t = " " + textOf(r) + " ";
    return TOPICS.filter(function (tp) { return tp.words.some(function (w) { return t.indexOf(w) >= 0; }); }).map(function (tp) { return tp.id; });
  }
  function isSensitive(r) { var t = textOf(r); return SENSITIVE.some(function (w) { return t.indexOf(w) >= 0; }); }
  function statusOf(r) { return r.status || "new"; }
  function hasText(r) { return !!(r.good || r.improve); }

  function respMean(r) {
    var v = Object.keys(r.scores || {}).map(function (k) { return r.scores[k]; });
    Object.keys(r.tracks || {}).forEach(function (k) { if (r.tracks[k].score) v.push(r.tracks[k].score); });
    return mean(v);
  }

  /* ---------- الفترات ---------- */
  function win(offset) {
    var len, end;
    if (range === "custom") {
      if (!from || !to) return null;
      var s = startOfDay(from), e = startOfDay(to) + DAY;
      len = e - s; end = e;
    } else if (range) { len = range * DAY; end = Date.now(); }
    else return offset ? null : [all.length ? Math.min.apply(null, all.map(ts)) : Date.now() - DAY, Date.now() + 1];
    return [end - len * ((offset || 0) + 1), end - len * (offset || 0)];
  }
  function byVisit(r) { return !visit || (r.visit || []).indexOf(visit) >= 0; }
  function within(w) { return function (r) { var t = ts(r); return byVisit(r) && (!w || (t >= w[0] && t < w[1])); }; }
  function buckets(rows, w) {
    if (!w) return [];
    var days = Math.max(1, Math.ceil((w[1] - w[0]) / DAY));
    var step = days <= 31 ? 1 : days <= 120 ? 7 : 30;
    var n = Math.ceil(days / step), out = [];
    for (var i = 0; i < n; i++) out.push({ start: w[0] + i * step * DAY, step: step, rows: [] });
    rows.forEach(function (r) { var i = Math.floor((ts(r) - w[0]) / (step * DAY)); if (out[i]) out[i].rows.push(r); });
    return out;
  }

  /* ---------- الحسابات ---------- */
  function stats(rows) {
    var means = rows.map(respMean).filter(function (x) { return x != null; });
    var nps = rows.filter(function (r) { return r.nps != null && r.nps !== ""; }).map(function (r) { return Number(r.nps); });
    var pro = nps.filter(function (x) { return x >= 9; }).length, det = nps.filter(function (x) { return x <= 6; }).length;
    return {
      n: rows.length, avg: mean(means),
      sat: means.length ? means.filter(function (x) { return x >= 4; }).length / means.length * 100 : null,
      nps: nps.length ? (pro - det) / nps.length * 100 : null, pro: pro, det: det
    };
  }
  function itemStats(rows, it) {
    var v = rows.map(function (r) { return (r.scores || {})[it.id]; }).filter(Boolean);
    var dist = [0, 0, 0, 0, 0]; v.forEach(function (x) { dist[x - 1]++; });
    return { it: it, avg: mean(v), n: v.length, dist: dist, skipped: rows.length - v.length };
  }
  function trackStats(rows, t) {
    var v = rows.map(function (r) { return ((r.tracks || {})[t.id] || {}).score; }).filter(Boolean);
    return { t: t, avg: mean(v), n: v.length };
  }
  function health(avg) { return avg == null ? null : Math.round((avg - 1) / 4 * 100); }

  /* ---------- الدخول والتحميل ---------- */
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = $("#loginForm button"); btn.disabled = true; $("#loginErr").textContent = "";
    Store.init().then(function () { return Store.login($("#pw").value); })
      .then(enter)
      .catch(function (err) { $("#loginErr").textContent = err.message || "تعذّر تسجيل الدخول"; })
      .then(function () { btn.disabled = false; });
  });

  function enter() {
    $("#loginView").hidden = true; $("#adminView").hidden = false;
    if (Store.isDemo()) { $("#modeBadge").hidden = false; $("#demoTools").style.display = "flex"; }
    load(true);
    clearInterval(timer);
    timer = setInterval(function () { load(false); }, REFRESH_MS);
    setInterval(liveText, 10000);
  }

  $("#logoutBtn").addEventListener("click", function () { Store.logout(); location.reload(); });
  $("#refreshBtn").addEventListener("click", function () { load(true); });
  $("#seedBtn").addEventListener("click", function () { Store.seedDemo(80).then(function () { load(true); }); });
  $("#clearBtn").addEventListener("click", function () {
    var b = $("#clearBtn");
    if (b.dataset.sure) { Store.clearDemo(); delete b.dataset.sure; b.textContent = "مسح"; load(true); }
    else { b.dataset.sure = "1"; b.textContent = "تأكيد المسح؟"; setTimeout(function () { delete b.dataset.sure; b.textContent = "مسح"; }, 4000); }
  });
  $("#csvBtn").addEventListener("click", exportCsv);

  $("#visitFilter").innerHTML += VISIT.map(function (v) { return '<option value="' + v.id + '">' + v.title + "</option>"; }).join("");
  $("#visitFilter").addEventListener("change", function (e) { visit = e.target.value; render(true); });
  $$("#rangeSeg button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#rangeSeg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      if (b.dataset.range === "custom") {
        range = "custom"; $("#customRange").hidden = false;
        if (!from) { to = new Date(); from = new Date(Date.now() - 13 * DAY); $("#fromDate").value = iso(from); $("#toDate").value = iso(to); }
      } else { range = Number(b.dataset.range); $("#customRange").hidden = true; }
      render(true);
    });
  });
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
  ["fromDate", "toDate"].forEach(function (id) {
    $("#" + id).addEventListener("change", function () {
      var f = $("#fromDate").value, t = $("#toDate").value;
      from = f ? new Date(f + "T00:00") : null; to = t ? new Date(t + "T00:00") : null;
      if (from && to && from > to) { var x = from; from = to; to = x; $("#fromDate").value = iso(from); $("#toDate").value = iso(to); }
      render(true);
    });
  });

  function load(animate) {
    if (animate && !all.length) $("#dash").innerHTML = '<div class="card empty-state"><p class="muted">جارٍ تحميل التقييمات…</p></div>';
    Promise.all([Store.list(), Store.activities()]).then(function (res) {
      online = true; lastSync = Date.now(); liveText();
      var rows = res[0].filter(function (r) { return r && r.ts; }).sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
      var sig = rows.length + "|" + rows.map(function (r) { return r.id + statusOf(r); }).join(",") + "|" + res[1].length;
      acts = res[1];
      if (!animate && sig === signature) return;
      signature = sig; all = rows;
      // لا نعيد الرسم أثناء الكتابة في حقل داخل اللوحة
      var a = document.activeElement;
      if (!animate && a && $("#dash").contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
      render(animate);
    }).catch(function (err) {
      if (err.status === 401) { Store.logout(); location.reload(); return; }
      online = false; liveText();
      if (animate && !all.length) $("#dash").innerHTML = '<div class="card empty-state"><p>تعذّر جلب البيانات</p><p class="muted">' + esc(err.message) + "</p></div>";
    });
  }

  function liveText() {
    var el = $("#live"); if (!el) return;
    el.classList.toggle("off", !online);
    if (!online) { $("#liveText").textContent = "غير متصل، سنحاول مجدداً"; return; }
    var s = Math.round((Date.now() - lastSync) / 1000);
    $("#liveText").textContent = "مباشر، آخر تحديث " + (s < 10 ? "الآن" : s < 60 ? "قبل " + s + " ث" : "قبل " + Math.round(s / 60) + " د");
  }

  /* ---------- الرسم ---------- */
  function render(animate) {
    var nc = all.filter(function (r) { return hasText(r) && statusOf(r) === "new"; }).length;
    $("#newCount").hidden = !nc; $("#newCount").textContent = nc;
    if (!all.length && tab !== "tracks") {
      $("#dash").innerHTML = '<div class="empty-state"><svg class="mark" viewBox="0 0 166 169" fill="none" stroke-width="27"><circle cx="83" cy="19" r="69.5"/><circle cx="83" cy="196" r="69.5"/></svg>' +
        "<h3>لا توجد تقييمات بعد</h3><p class=\"muted\">شارك رابط صفحة التقييم مع الطلاب" + (Store.isDemo() ? "، أو اضغط «بيانات تجريبية» لمعاينة اللوحة." : ".") + "</p></div>";
      return;
    }
    if (range === "custom" && !win()) { $("#dash").innerHTML = '<div class="empty-state"><p class="muted">اختر تاريخ البداية والنهاية.</p></div>'; return; }
    var w = win(), pw = win(1);
    var rows = all.filter(within(w)), prev = pw ? all.filter(within(pw)) : [];
    var html = "";

    if (tab === "overview") {
      var s = stats(rows), p = stats(prev), bk = buckets(rows, w);
      var items = ITEMS.map(function (it) { return itemStats(rows, it); });
      var pitems = ITEMS.map(function (it) { return itemStats(prev, it); });
      html = alerts() +
        '<div class="overview"><section class="sec">' + gauge(s, p) + '</section><section class="sec">' + head("الخلاصة", "تُكتب تلقائياً من تقييمات الفترة المختارة") + summary(items, pitems, rows, s) + "</section></div>" +
        kpis(s, p, bk) +
        groupsRow(rows) +
        '<section class="sec">' + head("التقييمات عبر الزمن", bk.length && bk[0].step > 1 ? "عدد التقييمات أسبوعياً" : "عدد التقييمات يومياً") + timeline(bk) + "</section>";
    } else if (tab === "cats") {
      var its = ITEMS.map(function (it) { return itemStats(rows, it); });
      html = '<div class="cols">' +
        '<section class="sec">' + head("متوسط كل تصنيف", "اضغط على أي تصنيف لعرض تفاصيله") + avgBars(its) + "</section>" +
        '<section class="sec">' + head("حسب سبب الزيارة", "متوسط كل تصنيف لكل فئة من الزوار") + heatmap(rows) + "</section></div>";
    } else if (tab === "tracks") {
      html = '<div class="cols">' +
        '<section class="sec">' + head("ترتيب التدريبات والفعاليات", "حسب متوسط التقييم في الفترة المختارة") + ranking(rows) + "</section>" +
        '<section class="sec">' + head("أسماء التدريبات والفعاليات", "تظهر للطلاب كقائمة اختيار في خطوة المسارات") + '<div id="actsBox">' + actsPanel() + "</div></section></div>";
    } else if (tab === "voice") {
      html = '<div id="commentsBox">' + commentsSection(rows) + "</div>";
    } else if (tab === "reports") {
      html = '<section class="sec">' + head("مقارنة شهر بشهر", "الفرق في كل تصنيف بين شهرين") + '<div id="cmpBox">' + monthCompare() + "</div></section>" +
        '<section class="sec">' + head("آخر التقييمات", "أحدث 50 تقييماً في الفترة المختارة، مع إمكانية الحذف") + table(rows) + "</section>";
    }
    $("#dash").innerHTML = '<div class="view">' + html + "</div>";
    post(animate);
    bindSearch();
  }
  function head(t, sub, extra) { return '<div class="sec-head"><div><h2>' + t + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>" + (extra || "") + "</div>"; }
  function currentRows() { return all.filter(within(win())); }
  function bindSearch() {
    var sb = $("#cSearch");
    if (sb) sb.addEventListener("input", function () { cf.search = sb.value; cf.limit = 20; $("#commentsList").outerHTML = commentsList(currentRows()); });
  }

  function post(animate) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) { $$(".grow").forEach(function (el) { el.classList.remove("grow"); }); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { $$(".grow").forEach(function (el) { el.classList.remove("grow"); }); }); });
    $$("[data-count]").forEach(function (el) {
      var target = Number(el.dataset.count), dec = Number(el.dataset.dec || 0), sign = el.dataset.sign === "1", t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / 700), v = target * (1 - Math.pow(1 - k, 3));
        el.textContent = (sign && target > 0 ? "+" : "") + v.toFixed(dec);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  function num(v, dec, sign) {
    if (v == null || isNaN(v)) return "–";
    return '<span data-count="' + v + '" data-dec="' + (dec || 0) + '"' + (sign ? ' data-sign="1"' : "") + ">" + (sign && v > 0 ? "+" : "") + v.toFixed(dec || 0) + "</span>";
  }

  /* C4 — تنبيهات */
  function alerts() {
    var since = Date.now() - 7 * DAY;
    var list = all.filter(function (r) {
      if (statusOf(r) === "done" || ts(r) < since) return false;
      var m = respMean(r); return (m != null && m <= 2) || isSensitive(r);
    });
    if (!list.length) return "";
    return '<div class="alerts">' + list.slice(0, 3).map(function (r) {
      var why = isSensitive(r) ? "تعليق فيه كلمة حساسة" : "تقييم منخفض جداً (" + fmt(respMean(r)) + " من 5)";
      var quote = r.improve || r.good;
      return '<div class="alert"><div class="a-txt"><b>' + why + "</b>، " +
        dateLabel(ts(r), { weekday: "long", day: "numeric", month: "short" }) + (quote ? ": <q>" + esc(quote.slice(0, 120)) + "</q>" : "") +
        (r.contact ? ' <span class="ctag reply">ينتظر رداً</span>' : "") + "</div>" + statusSeg(r) + "</div>";
    }).join("") + (list.length > 3 ? '<p class="small-note">و' + plural(list.length - 3, "تنبيه آخر", "تنبيهات أخرى") + " في «صوت الطلاب».</p>" : "") + "</div>";
  }

  /* A1 — مؤشر صحة المكان */
  function gauge(s, p) {
    var h = health(s.avg), ph = health(p.avg);
    var cls = h == null ? "" : h >= 75 ? "good" : h >= 50 ? "mid" : "bad";
    var label = h == null ? "لا بيانات" : h >= 85 ? "ممتاز" : h >= 70 ? "جيد جداً" : h >= 55 ? "جيد" : h >= 40 ? "يحتاج تحسين" : "ضعيف";
    var d = range && h != null && ph != null ? h - ph : null;
    return '<div class="gauge-box"><svg class="gauge" viewBox="0 0 220 128" aria-hidden="true">' +
      '<path class="g-track" d="M20 115 A90 90 0 0 1 200 115" fill="none" stroke-width="14" stroke-linecap="round" pathLength="100"/>' +
      '<defs><linearGradient id="gg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#7053DA"/><stop offset="1" stop-color="#1D3A89"/></linearGradient></defs>' +
      (h != null ? '<path d="M20 115 A90 90 0 0 1 200 115" fill="none" stroke="url(#gg)" stroke-width="14" stroke-linecap="round" pathLength="100" stroke-dasharray="' + Math.max(1, h) + ' 100"/>' : "") +
      '<text x="110" y="102" text-anchor="middle" font-size="46" font-weight="700">' + (h == null ? "–" : h) + "</text>" +
      '<text x="110" y="124" text-anchor="middle" font-size="12" style="fill:var(--muted)">صحة المكان من 100</text></svg>' +
      '<div class="g-label c-' + cls + '">' + label + "</div>" +
      '<div class="g-sub">' + (d == null ? "محسوب من متوسط كل الدرجات" : (Math.abs(d) < 1 ? "بدون تغيير" : (d > 0 ? "▲ " : "▼ ") + Math.abs(d) + " نقطة") + " عن الفترة السابقة") + "</div></div>";
  }

  /* A2 — الخلاصة */
  function summary(items, pitems, rows, s) {
    var ok = items.filter(function (x) { return x.n; }).sort(function (a, b) { return b.avg - a.avg; });
    var lines = [];
    if (ok.length) {
      var best = ok[0], worst = ok[ok.length - 1];
      lines.push({ c: "good", i: "▲", t: "الأعلى تقييماً <b>" + best.it.base + "</b> بمتوسط " + fmt(best.avg) + " من " + plural(best.n, "تقييم", "تقييمات") + "." });
      var tc = topicCounts(rows.filter(function (r) { var m = respMean(r); return m != null && m < 4; }))[0];
      lines.push({ c: "bad", i: "▼", t: "الأضعف <b>" + worst.it.base + "</b> بمتوسط " + fmt(worst.avg) + "، وهو أولوية التحسين" + (tc && tc.n ? ". أكثر ملاحظة مكتوبة كانت عن <b>" + tc.name + "</b> (" + plural(tc.n, "تعليق", "تعليقات") + ")." : ".") });
    }
    var moves = items.map(function (x, i) { var q = pitems[i]; return q && x.n >= 3 && q.n >= 3 ? { x: x, d: x.avg - q.avg } : null; })
      .filter(Boolean).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    if (moves.length && Math.abs(moves[0].d) >= 0.15) {
      var m = moves[0];
      lines.push({ c: m.d > 0 ? "good" : "bad", i: m.d > 0 ? "↗" : "↘", t: "<b>" + m.x.it.base + "</b> " + (m.d > 0 ? "تحسّن" : "تراجع") + " بمقدار " + fmt(Math.abs(m.d)) + " عن الفترة السابقة." });
    } else {
      lines.push({ c: "mid", i: "◆", t: "وصل " + plural(s.n, "تقييم", "تقييمات") + " في هذه الفترة، و" + fmt(s.sat, 0) + "% منهم راضون." });
    }
    var fresh = rows.filter(function (r) { return hasText(r) && statusOf(r) === "new"; }).length;
    if (fresh) lines.push({ c: "mid", i: "✎", t: plural(fresh, "ملاحظة جديدة", "ملاحظات جديدة") + " تنتظر المتابعة في <b>صوت الطلاب</b>." });
    return '<ul class="summary-list">' + lines.map(function (l) {
      return '<li><span class="tile ' + ({ good: "green", bad: "pink", mid: "peach" }[l.c] || "blue") + '" aria-hidden="true">' + l.i + "</span><span>" + l.t + "</span></li>";
    }).join("") + "</ul>";
  }

  /* A3 — الأرقام مع خطوط الاتجاه */
  function spark(vals) {
    var pts = vals.map(function (v, i) { return v == null ? null : [i, v]; }).filter(Boolean);
    if (pts.length < 2) return '<svg class="spark" viewBox="0 0 100 30"></svg>';
    var min = Math.min.apply(null, pts.map(function (p) { return p[1]; })), max = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    if (max === min) { max += 1; min -= 1; }
    var X = function (i) { return 2 + i / (vals.length - 1) * 96; }, Y = function (v) { return 27 - (v - min) / (max - min) * 24; };
    var d = pts.map(function (p, k) { return (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join(" ");
    var last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + d + " L" + X(last[0]).toFixed(1) + " 30 L" + X(pts[0][0]).toFixed(1) + ' 30Z"/><path class="line" d="' + d + '" vector-effect="non-scaling-stroke"/></svg>';
  }
  function delta(cur, prev, unit, d) {
    if (!range || cur == null || prev == null) return "";
    var x = cur - prev; if (Math.abs(x) < 0.05) return '<div class="k-sub">بدون تغيير عن الفترة السابقة</div>';
    return '<div class="k-sub"><span class="c-' + (x > 0 ? "good" : "bad") + '">' + (x > 0 ? "▲ " : "▼ ") + fmt(Math.abs(x), d) + (unit || "") + '</span> <span class="muted">عن الفترة السابقة</span></div>';
  }
  function kpis(s, p, bk) {
    var st = bk.map(function (b) { return stats(b.rows); });
    var npsLbl = s.nps == null ? "" : s.nps >= 50 ? "ممتاز" : s.nps >= 0 ? "جيد" : "يحتاج عمل";
    kpiIdx = 0;
    return '<div class="stats">' +
      kpi("عدد التقييمات", num(s.n), "", range ? delta(s.n, p.n, "", 0) : '<div class="k-sub">منذ البداية</div>', spark(bk.map(function (b) { return b.rows.length; }))) +
      kpi("متوسط الرضا", num(s.avg, 1), "<small> / 5</small>", delta(s.avg, p.avg, ""), spark(st.map(function (x) { return x.avg; }))) +
      kpi("نسبة الراضين", num(s.sat, 0), "<small>%</small>", delta(s.sat, p.sat, "%", 0) || '<div class="k-sub">متوسطهم 4 فأكثر</div>', spark(st.map(function (x) { return x.sat; }))) +
      kpi("مؤشر التوصية NPS", num(s.nps, 0, true), "", '<div class="k-sub">' + npsLbl + "، " + plural(s.pro, "مروّج", "مروّجين") + " و" + plural(s.det, "منتقد", "منتقدين") + "</div>", spark(st.map(function (x) { return x.nps; }))) +
      "</div>";
  }
  var KPI_TILES = [
    ["violet", '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'],
    ["blue", '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'],
    ["green", '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01"/>'],
    ["peach", '<path d="M3 10v4a1 1 0 001 1h3l6 4V5L7 9H4a1 1 0 00-1 1z"/><path d="M17 8.5a5 5 0 010 7"/>']
  ];
  var kpiIdx = 0;
  function kpi(label, val, suffix, sub, sp) {
    var t = KPI_TILES[kpiIdx++ % 4];
    return '<div class="stat sec"><div class="k-label">' + label + '</div><span class="tile ' + t[0] + '"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t[1] + '</svg></span><div class="k-value">' + val + suffix + "</div>" + (sub || "") + (sp || "") + "</div>";
  }

  /* B5 — المجموعات */
  function groupsRow(rows) {
    var cards = GROUPS.map(function (g) {
      var pooled = [];
      g.items.forEach(function (it) { rows.forEach(function (r) { var v = (r.scores || {})[it.id]; if (v) pooled.push(v); }); });
      return groupCard(g.title, mean(pooled), g.items.map(function (it) { var x = itemStats(rows, it); return { id: it.id, name: it.base, avg: x.avg }; }));
    });
    var pooledT = [];
    rows.forEach(function (r) { Object.keys(r.tracks || {}).forEach(function (k) { if (r.tracks[k].score) pooledT.push(r.tracks[k].score); }); });
    cards.push(groupCard("المسارات", mean(pooledT), TRACKS.map(function (t) { var x = trackStats(rows, t); return { name: t.title, avg: x.avg }; })));
    return '<div class="groups">' + cards.join("") + "</div>";
  }
  function groupCard(title, avg, list) {
    return '<div class="group sec"><div class="gh"><h3>' + title + '</h3><span class="gv c-' + sClass(avg) + '">' + fmt(avg) + "</span></div>" +
      '<div class="g-items">' + list.map(function (x) {
        var tag = x.id ? "button" : "div";
        return "<" + tag + (x.id ? ' type="button" data-cat="' + x.id + '"' : "") + ' class="g-item"><span class="n">' + esc(x.name) + '</span><span class="mini"><i class="grow" style="width:' + (x.avg ? x.avg / 5 * 100 : 0) + '%"></i></span><span class="v c-' + sClass(x.avg) + '">' + fmt(x.avg) + "</span></" + tag + ">";
      }).join("") + "</div></div>";
  }

  /* متوسط كل تصنيف (A4 + B2) */
  function avgBars(items) {
    var sorted = items.filter(function (x) { return x.n; }).sort(function (a, b) { return b.avg - a.avg; });
    if (!sorted.length) return '<p class="muted">لا توجد بيانات في هذه الفترة.</p>';
    return '<div class="hbars">' + sorted.map(function (x) {
      return '<div class="hbar" role="button" tabindex="0" data-cat="' + x.it.id + '" data-tip="<b>' + esc(x.it.base) + "</b><br>المتوسط " + fmt(x.avg, 2) + "، " + sWord(x.avg) + "<br>" + plural(x.n, "تقييم", "تقييمات") + (x.skipped ? "، و" + x.skipped + " لم يجرّب" : "") + '">' +
        '<span class="name">' + esc(x.it.base) + '</span><span class="track"><span class="fill s-' + sClass(x.avg) + ' grow" style="width:' + (x.avg / 5 * 100) + '%"></span></span><span class="val c-' + sClass(x.avg) + '">' + fmt(x.avg) + "</span></div>";
    }).join("") + '</div><div class="legend"><span class="c-good"><i></i><span style="color:var(--muted)">جيد، 4 فأكثر</span></span><span class="c-mid"><i></i><span style="color:var(--muted)">متوسط، من 3 إلى 4</span></span><span class="c-bad"><i></i><span style="color:var(--muted)">ضعيف، أقل من 3</span></span></div>';
  }

  /* B6 — حسب سبب الزيارة */
  function heatmap(rows) {
    var cols = VISIT.map(function (v) { return { v: v, rows: rows.filter(function (r) { return (r.visit || []).indexOf(v.id) >= 0; }) }; })
      .filter(function (c) { return c.rows.length; });
    if (!cols.length) return '<p class="muted">لا توجد بيانات عن سبب الزيارة.</p>';
    var hd = "<tr><th></th>" + cols.map(function (c) { return "<th>" + c.v.title + '<br><span class="small-note latin">' + c.rows.length + "</span></th>"; }).join("") + "</tr>";
    var body = ITEMS.map(function (it) {
      return '<tr><th data-cat="' + it.id + '">' + esc(it.base) + "</th>" + cols.map(function (c) {
        var x = itemStats(c.rows, it);
        if (!x.n) return '<td class="empty">–</td>';
        return '<td class="h-' + sClass(x.avg) + '" data-tip="<b>' + esc(it.base) + "</b>، " + c.v.title + "<br>المتوسط " + fmt(x.avg, 2) + " من " + plural(x.n, "تقييم", "تقييمات") + '">' + fmt(x.avg) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="heat-wrap"><table class="heat"><thead>' + hd + "</thead><tbody>" + body + "</tbody></table></div>" +
      '<p class="small-note" style="margin:12px 0 0">الرقم تحت كل فئة هو عدد التقييمات. يمكن للطالب اختيار أكثر من سبب.</p>';
  }

  function timeline(bk) {
    if (!bk.length) return '<p class="muted">لا توجد بيانات.</p>';
    var W = Math.max(340, Math.min(1160, ($("#dash") || document.body).clientWidth - 90)), H = 190, padL = 30, padR = 10, padB = 24, padT = 12, nb = bk.length;
    var counts = bk.map(function (b) { return b.rows.length; });
    var max = Math.max.apply(null, counts.concat([1]));
    var ticks = [0, Math.ceil(max / 2), max].filter(function (v, i, a) { return a.indexOf(v) === i; });
    var X = function (i) { return nb === 1 ? (padL + W - padR) / 2 : padL + i / (nb - 1) * (W - padL - padR); };
    var Y = function (v) { return H - padB - v / max * (H - padB - padT); };
    var svg = '<svg class="timeline" viewBox="0 0 ' + W + " " + H + '" direction="ltr">';
    ticks.forEach(function (t) { svg += '<line class="axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/><text x="' + (padL - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + t + "</text>"; });
    var pts = counts.map(function (c, i) { return X(i).toFixed(1) + " " + Y(c).toFixed(1); });
    svg += '<path class="tl-area" d="M' + pts.join(" L") + " L" + X(nb - 1).toFixed(1) + " " + Y(0) + " L" + X(0).toFixed(1) + " " + Y(0) + 'Z"/>';
    svg += '<path class="tl-line" d="M' + pts.join(" L") + '"/>';
    var colW = (W - padL - padR) / Math.max(1, nb - 1);
    bk.forEach(function (b, i) {
      var c = b.rows.length;
      var tip = "<b>" + (b.step > 1 ? "أسبوع " : "") + dateLabel(b.start) + "</b><br>" + plural(c, "تقييم", "تقييمات") + (c ? "، المتوسط " + fmt(stats(b.rows).avg) : "");
      svg += '<rect x="' + (X(i) - colW / 2).toFixed(1) + '" y="' + padT + '" width="' + colW.toFixed(1) + '" height="' + (H - padB - padT) + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
      if (nb <= 45) svg += '<circle class="tl-dot" r="3.5" cx="' + X(i).toFixed(1) + '" cy="' + Y(c).toFixed(1) + '" pointer-events="none"/>';
      if (i === 0 || i === nb - 1 || i === Math.floor(nb / 2)) svg += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : i === nb - 1 ? "end" : "middle") + '">' + dateLabel(b.start) + "</text>";
    });
    return svg + "</svg>";
  }

  /* B8 — ترتيب الأسماء */
  function ranking(rows) {
    var map = {};
    rows.forEach(function (r) {
      Object.keys(r.tracks || {}).forEach(function (k) {
        var x = r.tracks[k]; if (!x || !x.score || !x.name) return;
        var key = k + "|" + norm(x.name).trim();
        (map[key] = map[key] || { track: k, name: x.name.trim(), v: [] }).v.push(x.score);
      });
    });
    var list = Object.keys(map).map(function (k) { var m = map[k]; m.avg = mean(m.v); return m; })
      .sort(function (a, b) { return b.avg - a.avg || b.v.length - a.v.length; });
    if (!list.length) return '<p class="muted">لا توجد أسماء مذكورة في هذه الفترة.</p>';
    var T = {}; TRACKS.forEach(function (t) { T[t.id] = t; });
    return '<div class="rank">' + list.map(function (m) {
      var t = T[m.track] || { icon: "event", title: m.track };
      return '<div class="rank-row"><span class="q-icon">' + icon(t.icon) + '</span><span class="nm">' + esc(m.name) + "<small>" + t.title + '</small></span><span class="cnt">' + plural(m.v.length, "تقييم", "تقييمات") + '</span><span class="sc">' + pill(m.avg) + "</span></div>";
    }).join("") + "</div>";
  }

  /* B9 — إدارة الأسماء */
  function actsPanel() {
    var form = '<form class="act-form" id="actForm"><select class="field" id="actTrack" aria-label="المسار">' +
      TRACKS.map(function (t) { return '<option value="' + t.id + '">' + t.title + "</option>"; }).join("") +
      '</select><input class="field" id="actName" maxlength="80" placeholder="اسم التدريب أو الفعالية" required><button class="btn small" type="submit">إضافة</button></form>';
    var lists = TRACKS.map(function (t) {
      var mine = acts.filter(function (a) { return a.track === t.id; });
      return "<div><h4>" + icon(t.icon) + t.title + ' <span class="small-note latin">' + mine.length + '</span></h4><div class="act-chips">' +
        (mine.length ? mine.map(function (a) { return '<span class="act-chip">' + esc(a.name) + '<button type="button" data-act-del="' + a.id + '" aria-label="حذف ' + esc(a.name) + '">✕</button></span>'; }).join("")
          : '<span class="small-note">لا توجد أسماء، والطالب يكتب الاسم بنفسه</span>') + "</div></div>";
    }).join("");
    return form + '<div class="act-list">' + lists + "</div>";
  }

  /* D — صوت الطلاب */
  function topicCounts(rows) {
    var c = {}; rows.filter(hasText).forEach(function (r) { topicsOf(r).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return TOPICS.map(function (t) { return { id: t.id, name: t.name, n: c[t.id] || 0 }; }).filter(function (t) { return t.n; }).sort(function (a, b) { return b.n - a.n; });
  }
  function commentsSection(rows) {
    var withText = rows.filter(hasText);
    var counts = { low: 0, mid: 0, high: 0, reply: 0, new: 0, progress: 0, done: 0 };
    withText.forEach(function (r) {
      var m = respMean(r); counts[m == null ? "mid" : m <= 2 ? "low" : m >= 4 ? "high" : "mid"]++;
      if (r.contact) counts.reply++; counts[statusOf(r)]++;
    });
    function chip(key, val, label, n) { return '<button type="button" class="fchip" data-cf="' + key + ":" + val + '" aria-pressed="' + (String(cf[key]) === String(val)) + '">' + label + (n != null ? " <b>" + n + "</b>" : "") + "</button>"; }
    var topics = topicCounts(rows);
    return '<div class="voice"><aside class="voice-side sec">' +
      '<input class="field" id="cSearch" placeholder="بحث في الملاحظات" value="' + esc(cf.search) + '" aria-label="بحث في الملاحظات">' +
      '<div><h4>الحالة</h4><div class="fgroup">' + chip("status", "all", "الكل") + STATUS.map(function (s) { return chip("status", s.id, s.t, counts[s.id]); }).join("") +
        '<button type="button" class="fchip" data-cf="reply:toggle" aria-pressed="' + cf.reply + '">ينتظرون رداً <b>' + counts.reply + "</b></button></div></div>" +
      '<div><h4>الدرجة</h4><div class="fgroup">' + chip("score", "all", "الكل") + chip("score", "low", "منخفضة", counts.low) + chip("score", "mid", "متوسطة", counts.mid) + chip("score", "high", "مرتفعة", counts.high) + "</div></div>" +
      (topics.length ? '<div><h4>الموضوع</h4><div class="fgroup">' + chip("topic", "", "الكل") + topics.map(function (t) { return chip("topic", t.id, t.name, t.n); }).join("") + "</div></div>" : "") +
      '</aside><div class="sec">' + head("صوت الطلاب", plural(withText.length, "ملاحظة مكتوبة", "ملاحظات مكتوبة") + "، منها " + counts.new + " جديدة") + commentsList(rows) + "</div></div>";
  }
  function commentsList(rows) {
    var q = norm(cf.search.trim());
    var list = rows.filter(function (r) {
      if (!hasText(r)) return false;
      var m = respMean(r);
      if (cf.score === "low" && !(m != null && m <= 2)) return false;
      if (cf.score === "high" && !(m != null && m >= 4)) return false;
      if (cf.score === "mid" && !(m == null || (m > 2 && m < 4))) return false;
      if (cf.status !== "all" && statusOf(r) !== cf.status) return false;
      if (cf.reply && !r.contact) return false;
      if (cf.topic && topicsOf(r).indexOf(cf.topic) < 0) return false;
      if (q && textOf(r).indexOf(q) < 0) return false;
      return true;
    });
    var total = list.length; list = list.slice(0, cf.limit);
    if (!list.length) return '<div class="comments" id="commentsList"><p class="muted">لا توجد ملاحظات تطابق الفلاتر.</p></div>';
    var TN = {}; TOPICS.forEach(function (t) { TN[t.id] = t.name; });
    return '<div class="comments" id="commentsList">' + list.map(function (r) {
      var m = respMean(r);
      return '<div class="comment st-' + statusOf(r) + '"><div class="meta"><span>' + new Date(r.ts).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) + "</span><span>" + pill(m) + "</span></div>" +
        (r.good ? '<p class="g">' + esc(r.good) + "</p>" : "") + (r.improve ? '<p class="b">' + esc(r.improve) + "</p>" : "") +
        '<div class="tags">' + (r.contact ? '<span class="ctag reply">ينتظر رداً: <span class="latin" style="user-select:all">' + esc(r.contact) + "</span></span>" : "") +
        topicsOf(r).map(function (t) { return '<span class="ctag">' + TN[t] + "</span>"; }).join("") + "</div>" +
        '<div class="c-foot">' + statusSeg(r) + delBtn(r.id) + "</div></div>";
    }).join("") + (total > list.length ? '<div><button type="button" class="btn ghost small more-btn" id="moreComments">عرض ' + Math.min(20, total - list.length) + " ملاحظات أخرى (المتبقي " + (total - list.length) + ")</button></div>" : "") + "</div>";
  }
  function pill(v) { return v == null ? '<span class="muted">–</span>' : '<span class="score-pill c-' + sClass(v) + '">' + fmt(v) + " / 5</span>"; }
  function statusSeg(r) {
    return '<span class="status-seg" role="group" aria-label="حالة المتابعة">' + STATUS.map(function (s) {
      return '<button type="button" data-st="' + s.id + '" data-rid="' + esc(r.id) + '" aria-pressed="' + (statusOf(r) === s.id) + '">' + s.t + "</button>";
    }).join("") + "</span>";
  }
  function delBtn(id) { return '<span class="del-wrap"><button type="button" class="del-btn" data-del="' + esc(id) + '">حذف التقييم</button></span>'; }

  /* E3 — مقارنة شهر بشهر */
  function monthKey(t) { var d = new Date(t); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function monthName(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("ar", { month: "long", year: "numeric" }); }
  function monthCompare() {
    var rows = all.filter(byVisit);
    var keys = []; rows.forEach(function (r) { var k = monthKey(ts(r)); if (keys.indexOf(k) < 0) keys.push(k); });
    keys.sort().reverse();
    if (keys.length < 2) return '<p class="muted">تحتاج المقارنة تقييمات في شهرين على الأقل.</p>';
    if (keys.indexOf(month.a) < 0) month.a = keys[1];
    if (keys.indexOf(month.b) < 0) month.b = keys[0];
    function sel(id, v) { return '<select class="field" id="' + id + '" aria-label="الشهر">' + keys.map(function (k) { return '<option value="' + k + '"' + (k === v ? " selected" : "") + ">" + monthName(k) + "</option>"; }).join("") + "</select>"; }
    var A = rows.filter(function (r) { return monthKey(ts(r)) === month.a; }), B = rows.filter(function (r) { return monthKey(ts(r)) === month.b; });
    function line(name, a, b, n) {
      var d = a != null && b != null ? b - a : null;
      return "<tr><td>" + name + '</td><td class="num">' + (n ? n[0] : fmt(a)) + '</td><td class="num">' + (n ? n[1] : fmt(b)) + '</td><td class="diff ' + (d == null || n ? "" : Math.abs(d) < 0.05 ? "muted" : d > 0 ? "c-good" : "c-bad") + '">' +
        (n ? (n[1] - n[0] > 0 ? "+" : "") + (n[1] - n[0]) : d == null ? "–" : Math.abs(d) < 0.05 ? "=" : (d > 0 ? "▲ " : "▼ ") + fmt(Math.abs(d))) + "</td></tr>";
    }
    var sa = stats(A), sb = stats(B);
    return '<div class="month-pick" style="margin-bottom:14px">' + sel("monthA", month.a) + "<span>مقابل</span>" + sel("monthB", month.b) + "</div>" +
      '<div class="table-wrap"><table class="cmp"><thead><tr><th>التصنيف</th><th>' + monthName(month.a) + "</th><th>" + monthName(month.b) + "</th><th>الفرق</th></tr></thead><tbody>" +
      line("<b>عدد التقييمات</b>", null, null, [A.length, B.length]) + line("<b>المتوسط العام</b>", sa.avg, sb.avg) +
      ITEMS.map(function (it) { return line(esc(it.base), itemStats(A, it).avg, itemStats(B, it).avg); }).join("") +
      "</tbody></table></div>";
  }

  function table(rows) {
    var hd = "<tr><th>التاريخ</th><th>الزيارة</th>" + ITEMS.map(function (it) { return "<th>" + esc(it.base) + "</th>"; }).join("") + "<th>NPS</th><th></th></tr>";
    var body = rows.slice(0, 50).map(function (r) {
      return "<tr><td>" + new Date(r.ts).toLocaleDateString("ar") + "</td><td>" + visitNames(r) + "</td>" +
        ITEMS.map(function (it) { var v = (r.scores || {})[it.id]; return '<td class="num ' + (v ? "c-" + sClass(v) : "muted") + '">' + (v || "–") + "</td>"; }).join("") +
        '<td class="num">' + (r.nps == null ? "–" : r.nps) + "</td><td>" + delBtn(r.id) + "</td></tr>";
    }).join("");
    return '<div class="table-wrap" style="max-height:560px"><table class="data"><thead>' + hd + "</thead><tbody>" + body + "</tbody></table></div>";
  }
  function visitNames(r) {
    return (r.visit || []).map(function (id) { var v = VISIT.filter(function (x) { return x.id === id; })[0]; return v ? v.title : id; }).join("، ");
  }

  /* ---------- B2 — تفاصيل التصنيف ---------- */
  function openDetail(id) {
    var it = ITEMS.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var w = win(), pw = win(1), rows = all.filter(within(w)), prev = pw ? all.filter(within(pw)) : [];
    var x = itemStats(rows, it), px = itemStats(prev, it);
    var g = GROUPS.filter(function (gr) { return gr.items.indexOf(it) >= 0; })[0];
    var bk = buckets(rows, w).map(function (b) { var s = itemStats(b.rows, it); return { start: b.start, step: b.step, avg: s.avg, n: s.n }; });
    var topics = CAT_TOPICS[id] || [];
    var related = rows.filter(function (r) {
      if (!hasText(r)) return false;
      var v = (r.scores || {})[id];
      return (v && v <= 2) || topicsOf(r).some(function (t) { return topics.indexOf(t) >= 0; });
    });
    var d = range && x.avg != null && px.avg != null ? x.avg - px.avg : null;
    var html = '<div class="d-head"><span class="q-icon">' + icon(it.icon) + '</span><div><h2 id="drawerTitle">' + esc(it.base) + "</h2><p>" + (g ? g.title : "") + '</p></div><button class="d-close" type="button" id="drawerClose" aria-label="إغلاق">✕</button></div><div class="d-body">' +
      '<div class="d-stats"><div class="stat sec"><div class="k-label">المتوسط</div><div class="k-value c-' + sClass(x.avg) + '">' + fmt(x.avg) + "</div>" +
      (d != null ? '<div class="k-sub c-' + (d >= 0 ? "good" : "bad") + '">' + (Math.abs(d) < 0.05 ? "بدون تغيير" : (d > 0 ? "▲ " : "▼ ") + fmt(Math.abs(d))) + "</div>" : '<div class="k-sub">' + sWord(x.avg) + "</div>") + "</div>" +
      '<div class="stat sec"><div class="k-label">المقيّمون</div><div class="k-value">' + x.n + "</div></div>" +
      '<div class="stat sec"><div class="k-label">' + (it.optional ? "لم يجرّب" : "لم يقيّم") + '</div><div class="k-value">' + (rows.length ? Math.round(x.skipped / rows.length * 100) : 0) + "<small>%</small></div></div></div>" +
      '<section class="sec"><h3>توزيع الدرجات</h3><div class="d-dist">' +
      SCALE.slice().reverse().map(function (s) {
        var c = x.dist[s.v - 1], pct = x.n ? c / x.n * 100 : 0;
        return '<div class="row"><span>' + s.v + " " + s.label + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><span class="ct">' + c + "، " + fmt(pct, 0) + "%</span></div>";
      }).join("") + "</div></section>" +
      '<section class="sec"><h3>المتوسط عبر الزمن</h3>' + trend(bk) + "</section>" +
      '<section class="sec"><h3>ملاحظات متعلقة</h3><p class="sub" style="margin:-8px 0 12px">ممن قيّموه بـ 2 أو أقل، أو كتبوا عن موضوعه</p>' +
      (related.length ? '<div class="comments">' + related.slice(0, 30).map(function (r) {
        var v = (r.scores || {})[id];
        return '<div class="comment"><div class="meta"><span>' + dateLabel(ts(r), { day: "numeric", month: "short", year: "numeric" }) + "</span><span>" + (v ? pill(v) : "") + "</span></div>" +
          (r.good ? '<p class="g">' + esc(r.good) + "</p>" : "") + (r.improve ? '<p class="b">' + esc(r.improve) + "</p>" : "") + "</div>";
      }).join("") + "</div>" : '<p class="muted">لا توجد ملاحظات متعلقة في هذه الفترة.</p>') + "</section></div>";
    $("#drawer").innerHTML = html;
    $("#drawer").hidden = false; $("#drawerBack").hidden = false;
    document.body.style.overflow = "hidden";
    $("#drawerClose").focus();
  }
  function closeDetail() { $("#drawer").hidden = true; $("#drawerBack").hidden = true; document.body.style.overflow = ""; }
  function trend(bk) {
    var pts = bk.map(function (b, i) { return b.avg == null ? null : { i: i, b: b }; }).filter(Boolean);
    if (pts.length < 2) return '<p class="muted">لا توجد بيانات كافية لرسم الاتجاه.</p>';
    var W = 500, H = 150, padL = 24, padR = 8, padB = 22, padT = 10, n = bk.length;
    var X = function (i) { return padL + (n === 1 ? 0 : i / (n - 1) * (W - padL - padR)); };
    var Y = function (v) { return padT + (5 - v) / 4 * (H - padT - padB); };
    var svg = '<svg class="trend" viewBox="0 0 ' + W + " " + H + '" direction="ltr">';
    [1, 3, 5].forEach(function (t) { svg += '<line class="axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/><text x="' + (padL - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + t + "</text>"; });
    svg += '<path class="tline" d="' + pts.map(function (p, k) { return (k ? "L" : "M") + X(p.i).toFixed(1) + " " + Y(p.b.avg).toFixed(1); }).join(" ") + '"/>';
    pts.forEach(function (p) {
      svg += '<circle class="tdot" r="4" cx="' + X(p.i).toFixed(1) + '" cy="' + Y(p.b.avg).toFixed(1) + '" data-tip="' + esc("<b>" + dateLabel(p.b.start) + "</b><br>المتوسط " + fmt(p.b.avg, 2) + " من " + plural(p.b.n, "تقييم", "تقييمات")) + '"/>';
    });
    svg += '<text x="' + padL + '" y="' + (H - 5) + '">' + dateLabel(bk[0].start) + '</text><text x="' + (W - padR) + '" y="' + (H - 5) + '" text-anchor="end">' + dateLabel(bk[n - 1].start) + "</text>";
    return svg + "</svg>";
  }
  $("#drawerBack").addEventListener("click", closeDetail);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("#drawer").hidden) closeDetail();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".hbar[data-cat]")) { e.preventDefault(); openDetail(e.target.dataset.cat); }
  });

  /* التبويبات */
  function setTab(t) {
    tab = t; try { localStorage.setItem("domains_admin_tab", t); } catch (e) {}
    setTitle();
    $$("#tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === t)); });
    render(true); window.scrollTo({ top: 0 });
  }
  function setTitle() { var b = $('#tabs [data-tab="' + tab + '"]'); if (b) $("#pageTitle").textContent = b.textContent.replace(/\d+$/, "").trim(); }
  $$("#tabs button").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });
  (function () { var t = null; try { t = localStorage.getItem("domains_admin_tab"); } catch (e) {} if (t && $('#tabs [data-tab="' + t + '"]')) { tab = t; $$("#tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === t)); }); } setTitle(); })();

  /* ---------- التفاعل (تفويض الأحداث) ---------- */
  document.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("#drawerClose"))) return closeDetail();
    if ((b = e.target.closest("[data-cat]")) && !e.target.closest("#drawer")) return openDetail(b.dataset.cat);
    if ((b = e.target.closest("#moreComments"))) { cf.limit += 20; $("#commentsList").outerHTML = commentsList(currentRows()); return; }
    if ((b = e.target.closest("[data-cf]"))) {
      var p = b.dataset.cf.split(":"); cf.limit = 20;
      if (p[0] === "reply") cf.reply = !cf.reply; else cf[p[0]] = p[1];
      $("#commentsBox").innerHTML = commentsSection(currentRows()); bindSearch();
      return;
    }
    if ((b = e.target.closest(".status-seg button"))) {
      var id = b.dataset.rid, st = b.dataset.st, r = all.filter(function (x) { return x.id === id; })[0];
      if (!r || statusOf(r) === st) return;
      var old = r.status; r.status = st; signature = "";
      render(false);
      Store.setStatus(id, st).then(function () { toast("تم تحديث الحالة"); }).catch(function (err) { r.status = old; render(false); toast(err.message || "تعذّر الحفظ"); });
      return;
    }
    if ((b = e.target.closest("[data-del]"))) {
      b.parentNode.innerHTML = '<span class="confirm">حذف نهائي؟ <button type="button" class="yes" data-del-yes="' + esc(b.dataset.del) + '">نعم، احذف</button><button type="button" class="no" data-del-no>إلغاء</button></span>';
      return;
    }
    if ((b = e.target.closest("[data-del-no]"))) { b.closest(".del-wrap").innerHTML = '<button type="button" class="del-btn" data-del="' + esc(b.parentNode.querySelector("[data-del-yes]").dataset.delYes) + '">حذف التقييم</button>'; return; }
    if ((b = e.target.closest("[data-del-yes]"))) {
      var rid = b.dataset.delYes; b.disabled = true;
      Store.remove(rid).then(function () {
        all = all.filter(function (x) { return x.id !== rid; }); signature = ""; render(false); toast("تم حذف التقييم");
      }).catch(function (err) { b.disabled = false; toast(err.message || "تعذّر الحذف"); });
      return;
    }
    if ((b = e.target.closest("[data-act-del]"))) {
      Store.removeActivity(Number(b.dataset.actDel)).then(function () {
        acts = acts.filter(function (a) { return a.id !== Number(b.dataset.actDel); }); $("#actsBox").innerHTML = actsPanel(); toast("تم حذف الاسم");
      }).catch(function (err) { toast(err.message || "تعذّر الحذف"); });
    }
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "actForm") return;
    e.preventDefault();
    var track = $("#actTrack").value, name = $("#actName").value.trim(); if (!name) return;
    Store.addActivity(track, name).then(function (a) {
      acts.push(a); $("#actsBox").innerHTML = actsPanel(); $("#actTrack").value = track; $("#actName").focus(); toast("تمت إضافة «" + name + "»");
    }).catch(function (err) { toast(err.message || "تعذّر الحفظ"); });
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "monthA" || e.target.id === "monthB") {
      month[e.target.id === "monthA" ? "a" : "b"] = e.target.value; $("#cmpBox").innerHTML = monthCompare();
    }
  });

  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  /* ---------- التصدير ---------- */
  function exportCsv() {
    var rows = all.filter(within(win()));
    var cols = ["التاريخ", "الزيارة"].concat(ITEMS.map(function (it) { return it.base; }))
      .concat(TRACKS.reduce(function (a, t) { return a.concat([t.title + " - التقييم", t.title + " - الاسم"]); }, []))
      .concat(["NPS", "المتوسط", "أكثر شي عجبه", "اقتراح التحسين", "التواصل", "حالة المتابعة"]);
    var ST = {}; STATUS.forEach(function (s) { ST[s.id] = s.t; });
    var lines = [cols];
    rows.forEach(function (r) {
      lines.push([new Date(r.ts).toLocaleString("en-GB"), visitNames(r)]
        .concat(ITEMS.map(function (it) { return (r.scores || {})[it.id] || ""; }))
        .concat(TRACKS.reduce(function (a, t) { var x = (r.tracks || {})[t.id] || {}; return a.concat([x.score || "", x.name || ""]); }, []))
        .concat([r.nps == null ? "" : r.nps, fmt(respMean(r), 2), r.good || "", r.improve || "", r.contact || "", ST[statusOf(r)]]));
    });
    var csv = "﻿" + lines.map(function (l) { return l.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "domains-ratings-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- التلميحات ---------- */
  var tip = $("#tip");
  document.addEventListener("mousemove", function (e) {
    var t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.classList.remove("show"); return; }
    tip.innerHTML = t.getAttribute("data-tip"); tip.classList.add("show");
    var x = e.clientX + 14, y = e.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });

  /* ---------- البدء ---------- */
  Store.init().then(function () { if (Store.hasSession()) enter(); });
})();
