/* ==========================================================
   Domains Rating — طبقة التخزين
   - الوضع الحقيقي: خادم Render + قاعدة بيانات Neon عبر /api
   - الوضع التجريبي: localStorage على نفس الجهاز (عند غياب الخادم)
   ========================================================== */
(function () {
  var CFG = window.DOMAINS_CONFIG || {};
  var API = (CFG.API_BASE || "/api").replace(/\/$/, "");
  var LOCAL_KEY = "domains_rating_responses_v1";
  var LAST_KEY = "domains_rating_last_submit";
  var TOKEN_KEY = "domains_admin_token";
  var demo = true, ready = null;

  function safeGet(k, s) { try { return (s || localStorage).getItem(k); } catch (e) { return null; } }
  function safeSet(k, v, s) { try { (s || localStorage).setItem(k, v); } catch (e) {} }
  function safeDel(k, s) { try { (s || localStorage).removeItem(k); } catch (e) {} }
  function readLocal() { try { return JSON.parse(safeGet(LOCAL_KEY) || "[]"); } catch (e) { return []; } }

  function api(path, opts) {
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || d.ok === false) { var err = new Error(d.error || "خطأ في الاتصال (" + r.status + ")"); err.status = r.status; throw err; }
        return d;
      });
    });
  }

  function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error("افتح الصفحة عبر رابط https"));
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }

  var Store = {
    /* يحدد الوضع مرة واحدة: هل يوجد خادم؟ */
    init: function () {
      if (!ready) {
        ready = (location.protocol === "file:" ? Promise.reject() : api("/health"))
          .then(function () { demo = false; }, function () { demo = true; })
          .then(function () { return Store; });
      }
      return ready;
    },
    isDemo: function () { return demo; },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); },

    submit: function (response) {
      var done = function (x) { safeSet(LAST_KEY, String(Date.now())); return x; };
      if (demo) {
        var all = readLocal(); all.push(response);
        safeSet(LOCAL_KEY, JSON.stringify(all));
        return Promise.resolve({ ok: true, demo: true }).then(done);
      }
      return api("/ratings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response)
      }).then(done);
    },

    /* الإدارة */
    login: function (password) {
      if (demo) {
        return sha256(password).then(function (h) {
          if (h !== CFG.DEMO_PASSWORD_HASH) throw new Error("كلمة السر غير صحيحة");
          safeSet(TOKEN_KEY, "demo", sessionStorage);
        });
      }
      return api("/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password })
      }).then(function (d) { safeSet(TOKEN_KEY, d.token, sessionStorage); });
    },
    hasSession: function () {
      var t = safeGet(TOKEN_KEY, sessionStorage);
      return !!t && (demo ? t === "demo" : t !== "demo");
    },
    logout: function () { safeDel(TOKEN_KEY, sessionStorage); },

    list: function () {
      if (demo) return Promise.resolve(readLocal());
      return api("/ratings", { headers: { Authorization: "Bearer " + safeGet(TOKEN_KEY, sessionStorage) } })
        .then(function (d) { return d.responses || []; });
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
        var scores = {};
        items.forEach(function (it) {
          if (it.optional && Math.random() < 0.12) return;
          scores[it.id] = clamp((bias[it.id] || 4) + (Math.random() - 0.5) * 2.6);
        });
        var tr = {};
        tracks.forEach(function (t) {
          if (Math.random() < 0.35) tr[t.id] = { score: clamp(3.9 + (Math.random() - 0.5) * 2.4), name: rnd(names[t.id]) };
        });
        all.push({
          id: Store.uid(), ts: new Date(Date.now() - Math.random() * 60 * 864e5).toISOString(),
          visit: [rnd(visits).id], scores: scores, tracks: tr,
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
