/* ==========================================================
   Domains Rating — منطق صفحة المستخدم
   ========================================================== */
(function () {
  var CFG = window.DOMAINS_CONFIG, Store = window.DomainsStore, icon = window.domainsIcon;
  var GROUPS = window.DOMAINS_GROUPS, TRACKS = window.DOMAINS_TRACKS, SCALE = window.DOMAINS_SCALE;
  var AR_NUM = ["٠", "١", "٢", "٣", "٤", "٥"];
  var LAST_STEP = 5, THANKS = 6;

  var state = { step: 0, visit: [], scores: {}, skipped: {}, tracks: {}, nps: null };
  var ACTS = {}; // أسماء التدريبات والفعاليات حسب المسار (من لوحة الإدارة)
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- بناء الواجهة ---------- */
  /* مقياس من 5 خانات متصلة تمتلئ حتى الدرجة المختارة */
  function scaleHtml(key) {
    return '<div class="scale" role="radiogroup" data-key="' + key + '">' + SCALE.map(function (s) {
      return '<button type="button" role="radio" aria-checked="false" data-v="' + s.v + '" aria-label="' + s.v + " من 5، " + s.label + '">' + s.v + "</button>";
    }).join("") + '</div><div class="scale-foot"><span>' + SCALE[0].label + '</span><b data-val="' + key + '"></b><span>' + SCALE[4].label + "</span></div>";
  }

  function buildGroups() {
    $("#groupSteps").innerHTML = GROUPS.map(function (g, gi) {
      return '<section class="step" data-step="' + (gi + 1) + '">' +
        '<div class="section-head"><h2>' + g.title + "</h2><p>" + g.subtitle + "</p></div>" +
        g.items.map(function (it) {
          return '<div class="q" id="q-' + it.id + '">' +
            '<div class="q-head"><div class="q-icon">' + icon(it.icon) + "</div><div>" +
            '<p class="q-title">' + it.title + "</p>" +
            '<p class="q-hint">' + it.hint + "</p></div></div>" + scaleHtml(it.id) +
            (it.optional ? '<button type="button" class="skip" data-skip="' + it.id + '" aria-pressed="false">لم أجرّب هذا بعد</button>' : "") +
            "</div>";
        }).join("") + "</section>";
    }).join("");
  }

  function buildVisit() {
    $("#visitChips").innerHTML = window.DOMAINS_VISIT.map(function (v) {
      return '<button type="button" class="chip" aria-pressed="false" data-visit="' + v.id + '">' + v.title + "</button>";
    }).join("");
  }

  function buildTracks() {
    $("#trackToggles").innerHTML = TRACKS.map(function (t) {
      return '<button type="button" class="track-toggle" aria-pressed="false" data-track="' + t.id + '">' +
        '<span class="q-icon">' + icon(t.icon) + "</span>" + t.title + '<span class="check">✓</span></button>';
    }).join("");
  }

  function renderTrackQuestions() {
    var sel = TRACKS.filter(function (t) { return state.tracks[t.id]; });
    if (!sel.length) { $("#trackQuestions").innerHTML = '<div class="empty-note">لم تختر أي مسار — يمكنك المتابعة مباشرة.</div>'; return; }
    $("#trackQuestions").innerHTML = sel.map(function (t) {
      var tr = state.tracks[t.id];
      return '<div class="q track-q" id="q-track-' + t.id + '">' +
        '<div class="q-head"><div class="q-icon">' + icon(t.icon) + '</div><div><p class="q-title">' + t.question + "</p>" +
        '<p class="q-hint">المحتوى، المدرب أو المنظّم، والفائدة التي خرجت بها.</p></div></div>' +
        nameField(t, tr) +
        scaleHtml("track:" + t.id) + "</div>";
    }).join("");
    sel.forEach(function (t) { if (state.tracks[t.id].score) markScale("track:" + t.id, state.tracks[t.id].score); });
  }

  /* قائمة منسدلة إذا أضافت الإدارة أسماء لهذا المسار، وإلا حقل نص حر */
  function nameField(t, tr) {
    var list = ACTS[t.id] || [];
    var input = '<input class="field" data-track-name="' + t.id + '" maxlength="80" placeholder="' + t.placeholder + '" value="' + escAttr(tr.name || "") + '"';
    if (!list.length) return input + ">";
    var other = tr.pick === "__other";
    return '<select class="field" data-track-pick="' + t.id + '" aria-label="' + t.placeholder + '">' +
      '<option value="">' + t.placeholder.replace("اسم", "اختر") + "</option>" +
      list.map(function (n) { return '<option value="' + escAttr(n) + '"' + (tr.pick === n ? " selected" : "") + ">" + escAttr(n) + "</option>"; }).join("") +
      '<option value="__other"' + (other ? " selected" : "") + ">أخرى — سأكتب الاسم</option></select>" +
      input + (other ? "" : " hidden") + ' placeholder="اكتب الاسم">';
  }

  function buildNps() {
    var h = "";
    for (var i = 0; i <= 10; i++) h += '<button type="button" role="radio" aria-checked="false" data-nps="' + i + '" aria-label="' + i + ' من 10">' + i + "</button>";
    $("#nps").innerHTML = h;
  }

  function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  /* ---------- التفاعل ---------- */
  function markScale(key, v) {
    var el = document.querySelector('.scale[data-key="' + key + '"]');
    if (!el) return;
    $$("button", el).forEach(function (b) {
      var n = Number(b.dataset.v);
      b.setAttribute("aria-checked", String(n === v));
      b.classList.toggle("on", v > 0 && n < v);
    });
    var lbl = document.querySelector('[data-val="' + key + '"]');
    if (lbl) lbl.textContent = v ? SCALE[v - 1].label : "";
  }

  document.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest(".scale[data-key] button"))) {
      var key = b.parentNode.dataset.key, v = Number(b.dataset.v);
      if (key.indexOf("track:") === 0) state.tracks[key.slice(6)].score = v;
      else { state.scores[key] = v; delete state.skipped[key]; var sk = $('[data-skip="' + key + '"]'); if (sk) sk.setAttribute("aria-pressed", "false"); }
      markScale(key, v);
      var card = b.closest(".q"); card.classList.add("done"); card.classList.remove("missing");
      autoScroll(card);
      return;
    }
    if ((b = e.target.closest("[data-skip]"))) {
      var id = b.dataset.skip, on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      if (on) { state.skipped[id] = true; delete state.scores[id]; markScale(id, 0); b.closest(".q").classList.add("done"); b.closest(".q").classList.remove("missing"); autoScroll(b.closest(".q")); }
      else { delete state.skipped[id]; b.closest(".q").classList.remove("done"); }
      return;
    }
    if ((b = e.target.closest("[data-visit]"))) {
      var vid = b.dataset.visit, i = state.visit.indexOf(vid);
      if (i >= 0) state.visit.splice(i, 1); else state.visit.push(vid);
      b.setAttribute("aria-pressed", String(i < 0));
      // ربط سبب الزيارة بالمسارات تلقائياً
      if (window.DOMAINS_TRACKS.some(function (t) { return t.id === vid; })) toggleTrack(vid, i < 0);
      return;
    }
    if ((b = e.target.closest("[data-track]"))) { toggleTrack(b.dataset.track, !state.tracks[b.dataset.track]); return; }
    if ((b = e.target.closest("[data-nps]"))) {
      state.nps = Number(b.dataset.nps);
      $$("#nps button").forEach(function (x) {
        var n = Number(x.dataset.nps);
        x.setAttribute("aria-checked", String(x === b)); x.classList.toggle("on", n < state.nps);
      });
      $("#npsVal").textContent = state.nps >= 9 ? "سأنصح به بالتأكيد" : state.nps >= 7 ? "غالباً سأنصح به" : state.nps >= 4 ? "ربما" : "مستبعد";
      $("#npsCard").classList.add("done"); $("#npsCard").classList.remove("missing");
    }
  });

  document.addEventListener("input", function (e) {
    var id = e.target.dataset && e.target.dataset.trackName;
    if (id && state.tracks[id]) state.tracks[id].name = e.target.value;
  });
  document.addEventListener("change", function (e) {
    var id = e.target.dataset && e.target.dataset.trackPick;
    if (!id || !state.tracks[id]) return;
    var v = e.target.value, tr = state.tracks[id], inp = $('[data-track-name="' + id + '"]');
    tr.pick = v;
    if (v === "__other") { inp.hidden = false; inp.value = ""; tr.name = ""; inp.focus(); }
    else { inp.hidden = true; tr.name = v; }
  });

  function toggleTrack(id, on) {
    if (on) state.tracks[id] = state.tracks[id] || { score: null, name: "" };
    else delete state.tracks[id];
    var btn = $('[data-track="' + id + '"]'); if (btn) btn.setAttribute("aria-pressed", String(!!on));
    renderTrackQuestions();
  }

  function autoScroll(card) {
    var next = card.nextElementSibling;
    while (next && !next.classList.contains("q")) next = next.nextElementSibling;
    if (next && !next.classList.contains("done")) {
      setTimeout(function () { next.scrollIntoView({ behavior: "smooth", block: "center" }); }, 220);
    }
  }

  /* ---------- التنقل ---------- */
  function missingIn(step) {
    var miss = [];
    if (step >= 1 && step <= GROUPS.length) {
      GROUPS[step - 1].items.forEach(function (it) {
        if (!state.scores[it.id] && !state.skipped[it.id]) miss.push($("#q-" + it.id));
      });
    } else if (step === 4) {
      Object.keys(state.tracks).forEach(function (id) { if (!state.tracks[id].score) miss.push($("#q-track-" + id)); });
    } else if (step === 5) {
      if (state.nps === null) miss.push($("#npsCard"));
    }
    return miss;
  }

  function go(step) {
    state.step = step;
    $$(".step").forEach(function (s) { s.classList.toggle("active", Number(s.dataset.step) === step); });
    $("#steps").hidden = !(step >= 1 && step <= LAST_STEP);
    $$("#progress i").forEach(function (el, i) { el.classList.toggle("on", i < step); });
    $("#stepsMeta").textContent = "الخطوة " + AR_NUM[Math.min(step, LAST_STEP)] + " من " + AR_NUM[LAST_STEP];
    $("#backBtn").classList.toggle("hidden", step === 0 || step === THANKS);
    $(".navbar").style.display = step === THANKS ? "none" : "";
    $("#nextBtn").textContent = step === 0 ? "لنبدأ" : step === LAST_STEP ? "إرسال التقييم" : "التالي";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("#nextBtn").addEventListener("click", function () {
    var miss = missingIn(state.step);
    if (miss.length) {
      miss.forEach(function (m) { if (m) m.classList.add("missing"); });
      if (miss[0]) miss[0].scrollIntoView({ behavior: "smooth", block: "center" });
      toast(state.step === 5 ? "اختر رقماً من 0 إلى 10" : miss.length === 1 ? "بقي سؤال واحد بدون تقييم" : "بقيت " + miss.length + " أسئلة بدون تقييم");
      return;
    }
    if (state.step === LAST_STEP) return submit();
    go(state.step + 1);
  });
  $("#backBtn").addEventListener("click", function () { if (state.step > 0) go(state.step - 1); });

  function submit() {
    if ($("#website").value) { go(THANKS); return; } // حماية من الروبوتات
    var btn = $("#nextBtn"); btn.disabled = true; btn.textContent = "جارٍ الإرسال…";
    var tracks = {};
    Object.keys(state.tracks).forEach(function (id) { tracks[id] = { score: state.tracks[id].score, name: (state.tracks[id].name || "").trim() }; });
    var response = {
      id: Store.uid(), ts: new Date().toISOString(),
      visit: state.visit.slice(), scores: state.scores, tracks: tracks, nps: state.nps,
      good: $("#good").value.trim(), improve: $("#improve").value.trim(), contact: $("#contact").value.trim()
    };
    Store.submit(response).then(function () {
      var vals = Object.keys(state.scores).map(function (k) { return state.scores[k]; })
        .concat(Object.keys(tracks).map(function (k) { return tracks[k].score; }));
      var avg = vals.reduce(function (a, b) { return a + b; }, 0) / (vals.length || 1);
      $("#myAvg").textContent = avg.toFixed(1);
      var links = "";
      if (CFG.LINKS && CFG.LINKS.instagram) links += '<a class="btn ghost small" href="' + CFG.LINKS.instagram + '" target="_blank" rel="noopener">تابعنا على إنستغرام</a>';
      if (CFG.LINKS && CFG.LINKS.app) links += '<a class="btn small" href="' + CFG.LINKS.app + '" target="_blank" rel="noopener">افتح تطبيق دومينز</a>';
      $("#thanksLinks").innerHTML = links;
      go(THANKS);
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "إرسال التقييم";
      toast(err && err.status === 429 ? err.message : "تعذّر الإرسال — تحقّق من الاتصال وحاول مجدداً");
    });
  }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- البدء ---------- */
  buildVisit(); buildGroups(); buildTracks(); buildNps(); go(0);
  Store.init().then(function () {
    Store.activities().then(function (list) {
      ACTS = {};
      list.forEach(function (a) { (ACTS[a.track] = ACTS[a.track] || []).push(a.name); });
      renderTrackQuestions();
    });
    if (Store.isDemo()) $("#demoBanner").hidden = false;
    var cd = Number(CFG.RATE_COOLDOWN_HOURS || 0), since = Store.hoursSinceLast();
    if (!Store.isDemo() && cd && since < cd) {
      var n = $("#cooldownNote");
      n.hidden = false;
      n.textContent = "سبق أن أرسلت تقييماً قبل قليل — شكراً لك! يمكنك إرسال تقييم جديد بعد " + Math.ceil(cd - since) + " ساعة.";
      $("#nextBtn").disabled = true;
    }
  });
})();
