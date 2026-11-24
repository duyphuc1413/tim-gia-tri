(function () {
  "use strict";

  function init() {
    var form = document.getElementById("workshopLeadForm");
    var btn = document.getElementById("wlSubmitBtn");
    var msg = document.getElementById("wlMsg");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("wlName").value || "").trim();
      var email = (document.getElementById("wlEmail").value || "").trim();
      var org = (document.getElementById("wlOrg").value || "").trim();
      var size = (document.getElementById("wlSize").value || "").trim();
      var note = (document.getElementById("wlNote").value || "").trim();

      if (!name || !email) {
        msg.textContent = "Vui lòng nhập đầy đủ họ tên và email.";
        return;
      }

      var cfg = window.TGT_CONFIG || {};
      var url = (cfg.supabaseUrl || "").replace(/\/+$/, "");
      var key = cfg.supabaseAnonKey || "";
      if (!url || !key) {
        msg.textContent = "Hệ thống chưa cấu hình máy chủ. Vui lòng liên hệ trực tiếp qua email quản trị.";
        return;
      }

      btn.disabled = true;
      msg.textContent = "Đang gửi yêu cầu…";

      window.fetch(url + "/rest/v1/rpc/submit_workshop_lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: "Bearer " + key
        },
        body: JSON.stringify({
          p_name: name,
          p_email: email,
          p_org: org,
          p_team_size: size,
          p_note: note
        })
      }).then(function (res) {
        if (!res.ok) throw new Error("Không gửi được yêu cầu. Vui lòng kiểm tra lại email.");
        form.reset();
        msg.textContent = "Đã nhận yêu cầu của bạn! Chúng tôi sẽ phản hồi qua email " + email + " trong vòng 24 giờ.";
        if (window.TGTAnalytics) {
          window.TGTAnalytics.track("workshop_lead_submit", null, { teamSize: size });
        }
      }).catch(function (err) {
        msg.textContent = (err && err.message) ? err.message : "Có lỗi xảy ra, vui lòng thử lại.";
      }).finally(function () {
        btn.disabled = false;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
