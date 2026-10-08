/* ==========================================================
   Domains Rating — طبقة التخزين
   - إذا كان API_URL معرّفاً: الإرسال والقراءة عبر Google Apps Script (Google Sheet)
   - وإلا: الوضع التجريبي (localStorage على نفس الجهاز)
   ========================================================== */
(function () {
  var CFG = window.DOMAINS_CONFIG || {};
  var LOCAL_KEY = "domains_rating_responses_v1";
  var LAST_KEY = "domains_rating_last_submit";

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function readLocal() {
    try { return JSON.parse(safeGet(LOCAL_KEY) || "[]"); } catch (e) { return []; }
  }

  var Store = {
    isDemo: function () { return !CFG.API_URL; },

    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    submit: function (response) {
      safeSet(LAST_KEY, String(Date.now()));
      if (Store.isDemo()) {
        var all = readLocal(); all.push(response);
        safeSet(LOCAL_KEY, JSON.stringify(all));
        return Promise.resolve({ ok: true, demo: true });
      }
      // text/plain يتجنب طلب CORS المسبق؛ Apps Script يقرأ الجسم كـ JSON
      return fetch(CFG.API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "submit", response: response })
      }).then(function () { return { ok: true }; });
    },

    list: function (password) {
      if (Store.isDemo()) return Promise.resolve(readLocal());
      var url = CFG.API_URL + "?action=list&key=" + encodeURIComponent(password) + "&t=" + Date.now();
      return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.ok === false) throw new Error((d && d.error) || "تعذر جلب البيانات");
        return d.responses || [];
      });
    },

    hoursSinceLast: function () {
      var t = Number(safeGet(LAST_KEY) || 0);
      return t ? (Date.now() - t) / 36e5 : Infinity;
    },

    /* أدوات الوضع التجريبي */
    seedDemo: function (n) {
      var items = window.domainsAllItems(), tracks = window.DOMAINS_TRACKS, visits = window.DOMAINS_VISIT;
      var bias = { clean: 4.3, quiet: 3.4, comfort: 3.1, light: 4.0, staff: 4.6, order: 3.9, app_install: 3.6, app_overall: 3.8, social: 4.1 };
      var names = { training: ["أساسيات التصميم", "مهارات العرض", "بايثون للمبتدئين"], event: ["أمسية ريادة الأعمال", "يوم المجتمع"], project: ["مكتبة الحي", "منصة الإرشاد"], volunteer: ["حملة الشتاء", "تنظيم الفعاليات"] };
      var goods = ["الفريق لطيف جداً ومتعاون", "أجواء الدراسة رائعة", "التدريبات مفيدة وعملية", "المكان نظيف ومرتب", "أحب فكرة المسارات", ""];
      var bads = ["التدفئة ضعيفة بالصباح", "يصير في ضجة أحياناً بالقاعة الكبيرة", "التطبيق بطيء وقت الحجز", "نحتاج مقابس كهرباء أكثر", "", ""];
      function clamp(x) { return Math.max(1, Math.min(5, Math.round(x))); }
      function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
      var all = readLocal();
      for (var i = 0; i < (n || 80); i++) {
        var ts = new Date(Date.now() - Math.random() * 60 * 864e5);
        var scores = {};
        items.forEach(function (it) {
          if (it.optional && Math.random() < 0.12) return;
          scores[it.id] = clamp(bias[it.id] + (Math.random() - 0.5) * 2.6);
        });
        var tr = {};
        tracks.forEach(function (t) {
          if (Math.random() < 0.35) tr[t.id] = { score: clamp(3.9 + (Math.random() - 0.5) * 2.4), name: rnd(names[t.id]) };
        });
        all.push({
          id: Store.uid(), ts: ts.toISOString(),
          visit: [rnd(visits).id],
          scores: scores, tracks: tr,
          nps: Math.max(0, Math.min(10, Math.round(7.6 + (Math.random() - 0.5) * 6))),
          good: rnd(goods), improve: rnd(bads), contact: ""
        });
      }
      safeSet(LOCAL_KEY, JSON.stringify(all));
      return Promise.resolve(all);
    },

    clearDemo: function () { safeSet(LOCAL_KEY, "[]"); }
  };

  window.DomainsStore = Store;
})();
