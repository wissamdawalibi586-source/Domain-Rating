/* ==========================================================
   Domains Rating — لوحة الإدارة
   ========================================================== */
(function () {
  var CFG = window.DOMAINS_CONFIG, Store = window.DomainsStore, icon = window.domainsIcon;
  var ITEMS = window.domainsAllItems(), TRACKS = window.DOMAINS_TRACKS, VISIT = window.DOMAINS_VISIT, SCALE = window.DOMAINS_SCALE;
  var SESSION_KEY = "domains_admin_session";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var all = [], password = "", range = 30, visit = "", search = "";

  function ss(op, k, v) { try { return op === "get" ? sessionStorage.getItem(k) : op === "set" ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function fmt(x, d) { return x == null || isNaN(x) ? "–" : x.toFixed(d == null ? 1 : d); }

  /* ---------- الدخول ---------- */
  function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error("insecure"));
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }

  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("#pw").value; $("#loginErr").textContent = "";
    sha256(pw).then(function (h) {
      if (h !== CFG.ADMIN_PASSWORD_HASH) { $("#loginErr").textContent = "كلمة السر غير صحيحة"; return; }
      password = pw; ss("set", SESSION_KEY, pw); enter();
    }).catch(function () { $("#loginErr").textContent = "افتح الصفحة عبر رابط https لتسجيل الدخول"; });
  });

  function enter() {
    $("#loginView").hidden = true; $("#adminView").hidden = false;
    if (Store.isDemo()) { $("#modeBadge").hidden = false; $("#demoTools").style.display = "flex"; }
    load();
  }

  $("#logoutBtn").addEventListener("click", function () { ss("del", SESSION_KEY); location.reload(); });
  $("#refreshBtn").addEventListener("click", load);
  $("#seedBtn").addEventListener("click", function () { Store.seedDemo(80).then(load); });
  $("#clearBtn").addEventListener("click", function () { if (confirm("مسح كل البيانات التجريبية على هذا الجهاز؟")) { Store.clearDemo(); load(); } });
  $("#csvBtn").addEventListener("click", exportCsv);

  $("#visitFilter").innerHTML += VISIT.map(function (v) { return '<option value="' + v.id + '">' + v.title + "</option>"; }).join("");
  $("#visitFilter").addEventListener("change", function (e) { visit = e.target.value; render(); });
  $$("#rangeSeg button").forEach(function (b) {
    b.addEventListener("click", function () {
      range = Number(b.dataset.range);
      $$("#rangeSeg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      render();
    });
  });

  function load() {
    $("#dash").innerHTML = '<div class="card empty-state"><p class="muted">جارٍ تحميل التقييمات…</p></div>';
    Store.list(password).then(function (rows) {
      all = rows.filter(function (r) { return r && r.ts; }).sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
      render();
    }).catch(function (err) {
      $("#dash").innerHTML = '<div class="card empty-state"><p>تعذّر جلب البيانات</p><p class="muted">' + esc(err.message) + "</p></div>";
    });
  }

  /* ---------- الحسابات ---------- */
  function inRange(r, days, offset) {
    if (!days) return true;
    var age = (Date.now() - new Date(r.ts).getTime()) / 864e5;
    return age >= (offset || 0) * days && age < ((offset || 0) + 1) * days;
  }
  function byVisit(r) { return !visit || (r.visit || []).indexOf(visit) >= 0; }
  function respMean(r) {
    var v = Object.keys(r.scores || {}).map(function (k) { return r.scores[k]; });
    Object.keys(r.tracks || {}).forEach(function (k) { if (r.tracks[k].score) v.push(r.tracks[k].score); });
    return mean(v);
  }
  function stats(rows) {
    var means = rows.map(respMean).filter(function (x) { return x != null; });
    var nps = rows.filter(function (r) { return r.nps != null && r.nps !== ""; }).map(function (r) { return Number(r.nps); });
    var pro = nps.filter(function (x) { return x >= 9; }).length, det = nps.filter(function (x) { return x <= 6; }).length;
    return {
      n: rows.length,
      avg: mean(means),
      sat: means.length ? means.filter(function (x) { return x >= 4; }).length / means.length * 100 : null,
      nps: nps.length ? (pro - det) / nps.length * 100 : null,
      npsN: nps.length, pro: pro, det: det
    };
  }
  function itemStats(rows) {
    return ITEMS.map(function (it) {
      var v = rows.map(function (r) { return (r.scores || {})[it.id]; }).filter(Boolean);
      var dist = [0, 0, 0, 0, 0]; v.forEach(function (x) { dist[x - 1]++; });
      var skipped = rows.filter(function (r) { return !(r.scores || {})[it.id]; }).length;
      return { it: it, avg: mean(v), n: v.length, dist: dist, skipped: skipped };
    });
  }

  /* ---------- العرض ---------- */
  function render() {
    var rows = all.filter(function (r) { return inRange(r, range) && byVisit(r); });
    var prev = range ? all.filter(function (r) { return inRange(r, range, 1) && byVisit(r); }) : [];
    if (!all.length) {
      $("#dash").innerHTML = '<div class="card empty-state"><svg class="mark" viewBox="0 0 166 169" fill="none" stroke-width="27"><circle cx="83" cy="19" r="69.5"/><circle cx="83" cy="196" r="69.5"/></svg>' +
        "<h3>لا توجد تقييمات بعد</h3><p class=\"muted\">شارك رابط صفحة التقييم مع الطلاب" + (Store.isDemo() ? "، أو اضغط «توليد بيانات تجريبية» لمعاينة اللوحة." : ".") + "</p></div>";
      return;
    }
    var s = stats(rows), p = stats(prev), items = itemStats(rows);
    $("#dash").innerHTML =
      kpis(s, p) +
      '<div class="grid-2">' + panel("متوسط كل تصنيف", "من 5 — مرتبة من الأعلى للأدنى", avgBars(items)) + panel("أبرز النقاط", "أقوى ما لدينا وأولويات التحسين", insights(items)) + "</div>" +
      '<div class="grid-2">' + panel("توزيع التقييمات", "نسبة كل درجة في كل تصنيف", distChart(items)) + panel("التقييمات عبر الزمن", "عدد التقييمات يومياً", timeline(rows)) + "</div>" +
      '<div class="card panel" style="margin-bottom:14px"><h3>المسارات</h3><p class="sub">تقييم التدريبات والفعاليات والمشاريع والتطوع</p>' + trackCards(rows) + "</div>" +
      '<div class="grid-2">' + panel("صوت الطلاب", "أحدث الملاحظات المكتوبة", comments(rows), '<input class="field" id="searchBox" placeholder="بحث…" style="max-width:160px;padding:7px 12px" value="' + esc(search) + '">') +
      panel("آخر التقييمات", "جدول تفصيلي (أحدث 50)", table(rows)) + "</div>";
    var sb = $("#searchBox");
    if (sb) sb.addEventListener("input", function () { search = sb.value; var c = $("#commentsList"); if (c) c.outerHTML = commentsList(rows); });
  }

  function panel(title, sub, body, extra) {
    return '<div class="card panel"><div class="panel-head"><div><h3>' + title + '</h3><p class="sub">' + sub + "</p></div>" + (extra || "") + "</div>" + body + "</div>";
  }

  function delta(cur, prev, unit, d) {
    if (!range || cur == null || prev == null) return "";
    var x = cur - prev; if (Math.abs(x) < 0.05) return '<div class="k-sub">بدون تغيير عن الفترة السابقة</div>';
    return '<div class="k-sub" style="color:var(--' + (x > 0 ? "good" : "warn") + ')">' + (x > 0 ? "▲ " : "▼ ") + fmt(Math.abs(x), d) + (unit || "") + ' <span class="muted">عن الفترة السابقة</span></div>';
  }

  function kpis(s, p) {
    var npsLbl = s.nps == null ? "" : s.nps >= 50 ? "ممتاز" : s.nps >= 0 ? "جيد" : "يحتاج عمل";
    return '<div class="kpis">' +
      kpi("عدد التقييمات", s.n, "", range ? delta(s.n, p.n, "", 0) : '<div class="k-sub">منذ البداية</div>') +
      kpi("متوسط الرضا العام", fmt(s.avg), "<small> / 5</small>", delta(s.avg, p.avg, "")) +
      kpi("نسبة الراضين", fmt(s.sat, 0), "<small>%</small>", delta(s.sat, p.sat, "%", 0) || '<div class="k-sub">متوسطهم 4 فأكثر</div>') +
      kpi("مؤشر التوصية NPS", s.nps == null ? "–" : (s.nps > 0 ? "+" : "") + fmt(s.nps, 0), "", '<div class="k-sub">' + npsLbl + " · " + s.pro + " مروّج · " + s.det + " منتقد</div>") +
      "</div>";
  }
  function kpi(label, val, suffix, sub) {
    return '<div class="card kpi"><div class="k-label">' + label + '</div><div class="k-value">' + val + suffix + "</div>" + (sub || "") + "</div>";
  }

  function avgBars(items) {
    var sorted = items.filter(function (x) { return x.n; }).sort(function (a, b) { return b.avg - a.avg; });
    if (!sorted.length) return '<p class="muted">لا توجد بيانات في هذه الفترة.</p>';
    return '<div class="hbars">' + sorted.map(function (x) {
      return '<div class="hbar' + (x.avg < 3.5 ? " low" : "") + '" data-tip="<b>' + esc(x.it.base) + "</b><br>" + esc(x.it.title) + "<br>المتوسط " + fmt(x.avg, 2) + " من " + x.n + " تقييم" + (x.skipped ? " · " + x.skipped + " لم يجرّب" : "") + '">' +
        '<span class="name">' + esc(x.it.base) + '</span><span class="track"><span class="fill" style="width:' + (x.avg / 5 * 100) + '%"></span></span><span class="val">' + fmt(x.avg) + "</span></div>";
    }).join("") + '</div><p class="sub" style="margin:12px 0 0">الأشرطة الفاتحة: أقل من 3.5 — تحتاج انتباهاً.</p>';
  }

  function insights(items) {
    var sorted = items.filter(function (x) { return x.n; }).sort(function (a, b) { return b.avg - a.avg; });
    if (sorted.length < 2) return '<p class="muted">بيانات غير كافية.</p>';
    var top = sorted.slice(0, 2), low = sorted.slice(-3).reverse();
    function row(x, up) {
      return '<div class="insight"><span class="tag ' + (up ? "up" : "down") + '">' + (up ? "▲ نقطة قوة" : "▼ أولوية") + '</span><span class="t">' + esc(x.it.base) + '</span><span class="v">' + fmt(x.avg) + "</span></div>";
    }
    return '<div class="insights">' + top.map(function (x) { return row(x, true); }).join("") + low.map(function (x) { return row(x, false); }).join("") + "</div>";
  }

  function distChart(items) {
    var html = '<div class="dist">' + items.map(function (x) {
      if (!x.n) return '<div class="dist-row"><span class="name">' + esc(x.it.base) + '</span><span class="muted" style="font-size:12px">لا بيانات</span></div>';
      return '<div class="dist-row"><span class="name">' + esc(x.it.base) + '</span><div class="stack">' + x.dist.map(function (c, i) {
        if (!c) return "";
        var pct = c / x.n * 100;
        return '<span style="width:' + pct + '%;background:var(--d' + (i + 1) + ')" data-tip="<b>' + esc(x.it.base) + "</b><br>" + SCALE[i].face + " " + SCALE[i].label + ": " + c + " (" + fmt(pct, 0) + '%)"></span>';
      }).join("") + "</div></div>";
    }).join("") + "</div>";
    html += '<div class="legend">' + SCALE.map(function (s, i) { return '<span><i style="background:var(--d' + (i + 1) + ')"></i>' + s.v + " " + s.label + "</span>"; }).join("") + "</div>";
    return html;
  }

  function timeline(rows) {
    if (!rows.length) return '<p class="muted">لا توجد بيانات.</p>';
    var days = range || Math.max(7, Math.ceil((Date.now() - new Date(rows[rows.length - 1].ts).getTime()) / 864e5) + 1);
    var weekly = days > 90, bucket = weekly ? 7 : 1, nb = Math.ceil(days / bucket);
    var counts = new Array(nb).fill(0), sums = new Array(nb).fill(0);
    var today = new Date(); today.setHours(23, 59, 59, 999);
    rows.forEach(function (r) {
      var idx = nb - 1 - Math.floor((today - new Date(r.ts)) / 864e5 / bucket);
      if (idx >= 0 && idx < nb) { counts[idx]++; sums[idx] += respMean(r) || 0; }
    });
    var W = 560, H = 190, padL = 28, padB = 22, padT = 10, max = Math.max.apply(null, counts.concat([1]));
    var step = (W - padL) / nb, bw = Math.max(2, Math.min(18, step - 2));
    var ticks = [0, Math.ceil(max / 2), max].filter(function (v, i, a) { return a.indexOf(v) === i; });
    var y = function (v) { return H - padB - v / max * (H - padB - padT); };
    var svg = '<svg class="timeline" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" direction="ltr">';
    ticks.forEach(function (t) { svg += '<line class="axis" x1="' + padL + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (padL - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + "</text>"; });
    counts.forEach(function (c, i) {
      var x = padL + i * step + (step - bw) / 2, d = new Date(today - (nb - 1 - i) * bucket * 864e5);
      var label = (weekly ? "أسبوع " : "") + d.toLocaleDateString("ar", { day: "numeric", month: "short" });
      var tip = "<b>" + label + "</b><br>" + c + " تقييم" + (c ? " · متوسط " + fmt(sums[i] / c) : "");
      svg += '<rect class="hit" x="' + (padL + i * step) + '" y="' + padT + '" width="' + step + '" height="' + (H - padB - padT) + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
      if (c) svg += '<rect class="bar" x="' + x + '" y="' + y(c) + '" width="' + bw + '" height="' + (H - padB - y(c)) + '" rx="' + Math.min(4, bw / 2) + '" pointer-events="none"/>';
      if (i === 0 || i === nb - 1 || i === Math.floor(nb / 2)) svg += '<text x="' + (x + bw / 2) + '" y="' + (H - 5) + '" text-anchor="' + (i === 0 ? "start" : i === nb - 1 ? "end" : "middle") + '">' + d.toLocaleDateString("ar", { day: "numeric", month: "short" }) + "</text>";
    });
    return svg + "</svg>";
  }

  function trackCards(rows) {
    return '<div class="track-cards">' + TRACKS.map(function (t) {
      var v = [], names = {};
      rows.forEach(function (r) {
        var x = (r.tracks || {})[t.id]; if (!x || !x.score) return;
        v.push(x.score);
        if (x.name) { var k = x.name.trim(); names[k] = names[k] || []; names[k].push(x.score); }
      });
      var top = Object.keys(names).sort(function (a, b) { return names[b].length - names[a].length; }).slice(0, 3);
      return '<div class="track-card"><div class="top"><span class="q-icon">' + icon(t.icon) + "</span>" + t.title + "</div>" +
        '<div class="num">' + fmt(mean(v)) + ' <small>/ 5 · ' + v.length + " تقييم</small></div>" +
        '<div class="names">' + (top.length ? top.map(function (n) { return esc(n) + ' <span class="muted latin">(' + fmt(mean(names[n])) + ")</span>"; }).join("<br>") : '<span class="muted">لا أسماء مذكورة</span>') + "</div></div>";
    }).join("") + "</div>";
  }

  function comments(rows) { return commentsList(rows); }
  function commentsList(rows) {
    var q = search.trim().toLowerCase();
    var list = rows.filter(function (r) { return (r.good || r.improve) && (!q || ((r.good || "") + " " + (r.improve || "")).toLowerCase().indexOf(q) >= 0); }).slice(0, 60);
    if (!list.length) return '<div class="comments" id="commentsList"><p class="muted">لا توجد ملاحظات.</p></div>';
    return '<div class="comments" id="commentsList">' + list.map(function (r) {
      return '<div class="comment"><div class="meta"><span>' + new Date(r.ts).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) + "</span><span>متوسط " + fmt(respMean(r)) + (r.nps != null ? " · NPS " + r.nps : "") + "</span></div>" +
        (r.good ? '<p class="g">' + esc(r.good) + "</p>" : "") + (r.improve ? '<p class="b">' + esc(r.improve) + "</p>" : "") +
        (r.contact ? '<p class="muted" style="font-size:12.5px">📞 ' + esc(r.contact) + "</p>" : "") + "</div>";
    }).join("") + "</div>";
  }

  function table(rows) {
    var head = "<tr><th>التاريخ</th><th>الزيارة</th>" + ITEMS.map(function (it) { return "<th>" + esc(it.base) + "</th>"; }).join("") + "<th>NPS</th></tr>";
    var body = rows.slice(0, 50).map(function (r) {
      return "<tr><td>" + new Date(r.ts).toLocaleDateString("ar") + "</td><td>" + visitNames(r) + "</td>" +
        ITEMS.map(function (it) { var v = (r.scores || {})[it.id]; return '<td class="num">' + (v || "–") + "</td>"; }).join("") + '<td class="num">' + (r.nps == null ? "–" : r.nps) + "</td></tr>";
    }).join("");
    return '<div class="table-wrap" style="max-height:520px"><table class="data"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }
  function visitNames(r) {
    return (r.visit || []).map(function (id) { var v = VISIT.filter(function (x) { return x.id === id; })[0]; return v ? v.title : id; }).join("، ");
  }

  /* ---------- التصدير ---------- */
  function exportCsv() {
    var rows = all.filter(function (r) { return inRange(r, range) && byVisit(r); });
    var cols = ["التاريخ", "الزيارة"].concat(ITEMS.map(function (it) { return it.base; }))
      .concat(TRACKS.reduce(function (a, t) { return a.concat([t.title + " - التقييم", t.title + " - الاسم"]); }, []))
      .concat(["NPS", "المتوسط", "أكثر شي عجبه", "اقتراح التحسين", "التواصل"]);
    var lines = [cols];
    rows.forEach(function (r) {
      lines.push([new Date(r.ts).toLocaleString("en-GB"), visitNames(r)]
        .concat(ITEMS.map(function (it) { return (r.scores || {})[it.id] || ""; }))
        .concat(TRACKS.reduce(function (a, t) { var x = (r.tracks || {})[t.id] || {}; return a.concat([x.score || "", x.name || ""]); }, []))
        .concat([r.nps == null ? "" : r.nps, fmt(respMean(r), 2), r.good || "", r.improve || "", r.contact || ""]));
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
  var saved = ss("get", SESSION_KEY);
  if (saved) sha256(saved).then(function (h) { if (h === CFG.ADMIN_PASSWORD_HASH) { password = saved; enter(); } }).catch(function () {});
})();
