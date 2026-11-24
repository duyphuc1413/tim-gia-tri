(function () {
  "use strict";

  var SID_KEY = "tgt-funnel-sid";
  var SENT_ONCE = {};

  function getSessionId() {
    try {
      var sid = window.sessionStorage.getItem(SID_KEY);
      if (sid) return sid;
      sid = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      window.sessionStorage.setItem(SID_KEY, sid);
      return sid;
    } catch (e) {
      return "s_" + Date.now().toString(36);
    }
  }

  function track(eventName, step, meta, opts) {
    var cfg = window.TGT_CONFIG || {};
    var url = (cfg.supabaseUrl || "").replace(/\/+$/, "");
    var key = cfg.supabaseAnonKey || "";
    if (!url || !key || !eventName) return;

    if (opts && opts.once) {
      var k = eventName + ":" + (step || "");
      if (SENT_ONCE[k]) return;
      SENT_ONCE[k] = true;
    }

    var payload = {
      p_session_id: getSessionId(),
      p_event_name: String(eventName),
      p_step: typeof step === "number" ? step : null,
      p_meta: meta && typeof meta === "object" ? meta : {}
    };

    try {
      window.fetch(url + "/rest/v1/rpc/log_funnel_event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: "Bearer " + key
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  window.TGTAnalytics = {
    track: track
  };

  // Tự ghi nhận lượt xem trang và tiến độ bước hành trình
  function hookApp() {
    track("page_view", null, { path: window.location.pathname.slice(0, 80) }, { once: true });

    var App = window.TimGiaTriApp;
    if (App && typeof App.onStepChange === "function") {
      App.onStepChange(function (step) {
        if (step === 1) track("step_1_start", 1, {}, { once: true });
        else if (step === 3) track("step_3_filter", 3, {}, { once: true });
        else if (step === 5) track("step_5_rank", 5, {}, { once: true });
        else if (step === 8) track("step_8_result", 8, {}, { once: true });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hookApp);
  } else {
    hookApp();
  }
})();
