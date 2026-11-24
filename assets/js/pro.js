(function () {
  "use strict";

  var CLOUD_ID_KEY = "tim-gia-tri-cloud-id";
  var syncTimer = null;
  var syncing = false;
  var lastSyncedText = "";

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "textContent") node.textContent = attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function getCloudId() {
    try { return window.localStorage.getItem(CLOUD_ID_KEY) || ""; } catch (e) { return ""; }
  }
  function setCloudId(id) {
    try {
      if (id) window.localStorage.setItem(CLOUD_ID_KEY, id);
      else window.localStorage.removeItem(CLOUD_ID_KEY);
    } catch (e) {}
  }

  function formatDateVi(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function buildJourneyTitle(snapshot) {
    var rank = Array.isArray(snapshot.ranking) ? snapshot.ranking : [];
    var d = new Date();
    var monthYear = (d.getMonth() + 1) + "/" + d.getFullYear();
    if (rank.length >= 2) {
      return "Bản đồ " + monthYear + " · " + rank.slice(0, 3).join(", ");
    }
    return "Hành trình " + monthYear;
  }

  function updateCloudStatusText(msg) {
    lastSyncedText = msg;
    var bar = document.getElementById("cloudSyncNote");
    if (bar) bar.textContent = msg;
    var proStatus = document.getElementById("proCloudStatus");
    if (proStatus) proStatus.textContent = msg;
  }

  function syncNow(manual) {
    var Account = window.TGTAccount;
    var App = window.TimGiaTriApp;
    if (!Account || !App) return Promise.resolve();
    var accState = Account.getState();
    if (!accState.configured || !accState.user || !accState.entitlement.isPro) {
      return Promise.resolve();
    }
    if (syncing) return Promise.resolve();

    var snap = App.getState();
    var hasData =
      Object.keys(snap.exps || {}).length > 0 ||
      (snap.selected && snap.selected.length > 0);
    if (!hasData && !manual) return Promise.resolve();

    syncing = true;
    updateCloudStatusText("Đang đồng bộ lên đám mây…");

    return Account.saveJourneyCloud(
      getCloudId() || null,
      buildJourneyTitle(snap),
      snap,
      snap.step === 8
    ).then(function (row) {
      if (row && row.id) setCloudId(row.id);
      var t = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      updateCloudStatusText("Đã đồng bộ đám mây lúc " + t + ".");
    }).catch(function (err) {
      if (manual) {
        updateCloudStatusText("Chưa đồng bộ được: " + (err && err.message ? err.message : "lỗi kết nối."));
      } else {
        updateCloudStatusText("Đang lưu cục bộ (chưa đồng bộ đám mây).");
      }
    }).finally(function () {
      syncing = false;
    });
  }

  function scheduleCloudSync() {
    var Account = window.TGTAccount;
    if (!Account) return;
    var accState = Account.getState();
    if (!accState.configured || !accState.user || !accState.entitlement.isPro) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncNow(false);
    }, 1800);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Xuất báo cáo PDF A4 trình bày sẵn (Pro) ---------- */
  function openDesignedPdfReport() {
    var App = window.TimGiaTriApp;
    var Core = window.TimGiaTriCore;
    var Billing = window.TimGiaTriBilling;
    if (!App || !Core) return;

    var snap = App.getState();
    var rank = App.getRanking();
    var exps = App.getExperiences();
    var defs = snap.definitions || {};
    var goals = (snap.extras && Array.isArray(snap.extras.goals)) ? snap.extras.goals : [];
    var dateStr = Core.formatVietnameseDate(new Date());
    var domainMap = {};
    if (Billing && Billing.LIFE_DOMAINS) {
      Billing.LIFE_DOMAINS.forEach(function (d) { domainMap[d.id] = d.label; });
    }

    var win = window.open("", "_blank");
    if (!win) {
      window.alert("Trình duyệt đang chặn cửa sổ bật lên (pop-up). Hãy cho phép mở cửa sổ mới để xem bản in PDF.");
      return;
    }

    var rankRows = rank.map(function (v, i) {
      var d = defs[v] || { def: "", act: "" };
      return (
        "<div class='card'>" +
          "<div class='row-head'><span class='num'>#" + (i + 1) + "</span><h3>" + escapeHtml(v) + "</h3></div>" +
          (d.def ? "<p><strong>Với tôi nghĩa là:</strong> " + escapeHtml(d.def) + "</p>" : "") +
          (d.act ? "<p><strong>Hành động tuần này:</strong> " + escapeHtml(d.act) + "</p>" : "") +
        "</div>"
      );
    }).join("");

    var goalsHtml = goals.length
      ? "<section><h2>Kế hoạch BE–DO–HAVE theo giá trị</h2>" +
        goals.map(function (g) {
          return (
            "<div class='card'>" +
              "<div class='row-head'><h3>" + escapeHtml(domainMap[g.domain] || g.domain) + "</h3>" +
              (g.linkedValue ? "<span class='tag'>Giá trị: " + escapeHtml(g.linkedValue) + "</span>" : "") +
              "</div>" +
              (g.be ? "<p><strong>BE (Trở thành):</strong> " + escapeHtml(g.be) + "</p>" : "") +
              (g.doText ? "<p><strong>DO (Làm đều đặn):</strong> " + escapeHtml(g.doText) + "</p>" : "") +
              (g.have ? "<p><strong>HAVE (Kết quả):</strong> " + escapeHtml(g.have) + "</p>" : "") +
              (g.reverseCheck ? "<p class='muted'><strong>Kiểm tra ngược:</strong> " + escapeHtml(g.reverseCheck) + "</p>" : "") +
            "</div>"
          );
        }).join("") +
        "</section>"
      : "";

    var antiHtml = snap.antis && snap.antis.length
      ? "<section><h2>Những điều tôi không chịu nổi</h2><p>" + escapeHtml(snap.antis.join(" · ")) + "</p></section>"
      : "";

    var expHtml = exps.length
      ? "<section><h2>Bằng chứng sống</h2>" +
        exps.map(function (e) {
          return "<p><strong>" + escapeHtml(e.label) + ":</strong> " + escapeHtml(e.text) + "</p>";
        }).join("") +
        "</section>"
      : "";

    var html =
      "<!doctype html><html lang='vi'><head><meta charset='utf-8' />" +
      "<title>Bản đồ giá trị cốt lõi — " + escapeHtml(dateStr) + "</title>" +
      "<style>" +
      "@page{size:A4;margin:18mm 18mm 20mm}" +
      "body{font-family:Georgia,'Times New Roman',serif;color:#1d1b18;line-height:1.65;max-width:740px;margin:0 auto;padding:24px}" +
      "header{border-bottom:2px solid #a93226;padding-bottom:14px;margin-bottom:22px}" +
      ".kicker{font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a93226;margin:0 0 6px}" +
      "h1{font-size:28px;margin:0 0 6px}" +
      ".meta{font-family:system-ui,sans-serif;font-size:13px;color:#666;margin:0}" +
      "h2{font-size:17px;border-bottom:1px solid #ddd6ca;padding-bottom:6px;margin:24px 0 12px;color:#1d1b18}" +
      ".card{border:1px solid #e3ddd2;border-left:3px solid #a93226;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid}" +
      ".row-head{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}" +
      ".num{font-family:system-ui,sans-serif;font-weight:700;color:#a93226;font-size:13px}" +
      "h3{margin:0;font-size:16px}" +
      ".tag{font-family:system-ui,sans-serif;font-size:12px;color:#6b5c4d;margin-left:auto}" +
      "p{margin:4px 0;font-size:14px}" +
      ".muted{color:#5c564f}" +
      ".print-bar{font-family:system-ui,sans-serif;background:#f7f4ee;border:1px solid #ddd6ca;padding:12px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:12px}" +
      ".print-bar button{background:#a93226;color:#fff;border:none;padding:8px 16px;font-weight:600;cursor:pointer;border-radius:4px}" +
      "footer{margin-top:28px;padding-top:12px;border-top:1px solid #ddd6ca;font-size:12px;color:#666;font-style:italic}" +
      "@media print{.print-bar{display:none}body{padding:0}}" +
      "</style></head><body>" +
      "<div class='print-bar'><span>Chọn <strong>Lưu dưới dạng PDF (Save as PDF)</strong> trong hộp thoại in để tải file A4 đẹp.</span>" +
      "<button type='button' onclick='window.print()'>In / Lưu PDF</button></div>" +
      "<header><p class='kicker'>Tìm Giá Trị · Bản báo cáo cá nhân</p>" +
      "<h1>Bản đồ giá trị cốt lõi của tôi</h1>" +
      "<p class='meta'>Ngày lập: " + escapeHtml(dateStr) + "</p></header>" +
      "<section><h2>Thứ tự giá trị cốt lõi</h2>" + rankRows + "</section>" +
      goalsHtml + antiHtml + expHtml +
      "<footer>Nhắc mình: soi lại sau 24 giờ, hằng tháng và làm lại hằng năm. Đừng hỏi “tôi muốn trở thành người thế nào?” — hãy hỏi “đời tôi đã chứng minh tôi là người thế nào?”.</footer>" +
      "</body></html>";

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  /* ---------- Render Bước 8 Pro panel (BE–DO–HAVE + Cloud + PDF) ---------- */
  function renderProSection() {
    var mount = document.getElementById("proResultMount");
    var Account = window.TGTAccount;
    var App = window.TimGiaTriApp;
    var Billing = window.TimGiaTriBilling;
    if (!mount || !Account || !App || !Billing) return;

    mount.textContent = "";
    var accState = Account.getState();

    // Chưa Pro hoặc chưa đăng nhập -> hiện thẻ mời dùng thử 3 ngày / nâng cấp
    if (!accState.configured || !accState.user || !accState.entitlement.isPro) {
      var box = el("div", { className: "pro-upsell" });
      var head = el("div", { className: "pro-upsell-head" });
      head.appendChild(el("p", { className: "sec-tag" }, "Bước 8 mở rộng · Tìm Giá Trị Pro"));
      head.appendChild(el("h4", null, "Biến bảng giá trị thành kế hoạch sống & lưu lại qua từng năm"));
      head.appendChild(el("p", null,
        "Hành trình 7 bước và tải file cục bộ luôn miễn phí. Nếu bạn muốn đồng bộ nhiều thiết bị, theo dõi hành trình qua các năm và đặt mục tiêu theo mô hình BE–DO–HAVE, hãy kích hoạt bản dùng thử 3 ngày miễn phí."));
      box.appendChild(head);

      var list = el("ul", { className: "pro-feature-list" });
      [
        "Lưu đám mây & tự động đồng bộ giữa điện thoại và máy tính.",
        "Lưu lịch sử các lần làm qua nhiều năm để đối chiếu sự thay đổi.",
        "Bước 8 tương tác: đặt mục tiêu BE–DO–HAVE cho 7 lĩnh vực gắn thẳng với top giá trị.",
        "Email nhắc soi lại hằng tháng và nhắc trước ngày làm lại hằng năm.",
        "Xuất báo cáo PDF A4 dàn trang sẵn để in hoặc lưu lâu dài."
      ].forEach(function (t) {
        list.appendChild(el("li", null, t));
      });
      box.appendChild(list);

      var foot = el("div", { className: "pro-upsell-foot" });
      var ctaLabel = accState.user ? "Nâng cấp gói Pro →" : "Đăng ký dùng thử 3 ngày miễn phí →";
      foot.appendChild(el("a", { className: "btn btn-primary", href: "account.html" }, ctaLabel));
      foot.appendChild(el("span", { className: "pro-price-hint" },
        Billing.formatVnd(Billing.PLANS.monthly.price) + "/tháng · hoặc " +
        Billing.formatVnd(Billing.PLANS.yearly.price) + "/năm (tiết kiệm " + Billing.yearlySavingsPercent() + "%)"));
      box.appendChild(foot);
      mount.appendChild(box);
      return;
    }

    // Đang trong 3 ngày dùng thử hoặc gói Pro
    var wrap = el("div", { className: "pro-workspace" });

    var bar = el("div", { className: "pro-toolbar" });
    var info = el("div");
    info.appendChild(el("strong", null, "Tìm Giá Trị Pro · " + accState.entitlement.label));
    var statusP = el("p", { id: "proCloudStatus", className: "pro-status-note" },
      lastSyncedText || "Tự động đồng bộ lên đám mây khi bạn chỉnh sửa.");
    info.appendChild(statusP);
    bar.appendChild(info);

    var btns = el("div", { className: "pro-toolbar-actions" });
    var syncBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Lưu đám mây ngay");
    syncBtn.addEventListener("click", function () { syncNow(true); });
    var pdfBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Xuất báo cáo PDF A4");
    pdfBtn.addEventListener("click", openDesignedPdfReport);
    var accLink = el("a", { className: "btn btn-ghost btn-small", href: "account.html" }, "Lịch sử & Tài khoản");
    btns.appendChild(syncBtn);
    btns.appendChild(pdfBtn);
    btns.appendChild(accLink);
    bar.appendChild(btns);
    wrap.appendChild(bar);

    // Bước 8: BE-DO-HAVE Builder
    var bdh = el("div", { className: "bdh-section" });
    bdh.appendChild(el("h4", null, "Bước 8 · Đặt mục tiêu theo mô hình BE – DO – HAVE"));
    bdh.appendChild(el("p", { className: "intro" },
      "Chọn một lĩnh vực đời sống, neo vào một giá trị trong top của bạn, rồi trả lời ngược: để có điều mình muốn (HAVE), tôi cần làm gì đều đặn (DO), và trở thành người thế nào (BE)?"));

    var extras = App.getExtras();
    var goals = Billing.sanitizeGoals(extras.goals || []);
    var rank = App.getRanking();

    var listWrap = el("div", { className: "bdh-list" });

    function saveGoals(nextGoals) {
      goals = nextGoals;
      var cur = App.getExtras();
      cur.goals = goals;
      App.setExtras(cur);
    }

    function renderGoalCards() {
      listWrap.textContent = "";
      if (!goals.length) {
        listWrap.appendChild(el("p", { className: "empty-note" },
          "Chưa có mục tiêu nào. Bấm “+ Thêm mục tiêu lĩnh vực” bên dưới để bắt đầu với 1 lĩnh vực quan trọng nhất hiện nay."));
        return;
      }

      goals.forEach(function (g, idx) {
        var card = el("div", { className: "bdh-card" });

        var topRow = el("div", { className: "bdh-row-top" });
        var domSel = el("select", { "aria-label": "Lĩnh vực đời sống" });
        Billing.LIFE_DOMAINS.forEach(function (d) {
          var opt = el("option", { value: d.id }, d.label);
          if (d.id === g.domain) opt.selected = true;
          domSel.appendChild(opt);
        });
        domSel.addEventListener("change", function () {
          goals[idx].domain = domSel.value;
          saveGoals(goals);
        });

        var valSel = el("select", { "aria-label": "Giá trị dẫn dắt" });
        valSel.appendChild(el("option", { value: "" }, "— Gắn với giá trị cốt lõi —"));
        rank.forEach(function (v, ri) {
          var opt = el("option", { value: v }, "#" + (ri + 1) + " " + v);
          if (v === g.linkedValue) opt.selected = true;
          valSel.appendChild(opt);
        });
        valSel.addEventListener("change", function () {
          goals[idx].linkedValue = valSel.value;
          saveGoals(goals);
        });

        var rmBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Xóa");
        rmBtn.addEventListener("click", function () {
          goals.splice(idx, 1);
          saveGoals(goals);
          renderGoalCards();
        });

        topRow.appendChild(domSel);
        topRow.appendChild(valSel);
        topRow.appendChild(rmBtn);
        card.appendChild(topRow);

        var grid = el("div", { className: "bdh-grid" });
        [
          ["be", "BE — Tôi cần trở thành người thế nào?", "Ví dụ: người giữ lời hứa với chính mình về giờ ngủ và vận động"],
          ["doText", "DO — Việc cụ thể tôi làm đều đặn?", "Ví dụ: tập 30 phút vào 6h30 sáng thứ 2–4–6, không nhận họp sau 19h"],
          ["have", "HAVE — Kết quả nhìn thấy được?", "Ví dụ: đủ sức bền chơi với con cuối tuần và giảm kiệt sức"]
        ].forEach(function (f) {
          var col = el("div", { className: "bdh-field" });
          col.appendChild(el("label", null, f[1]));
          var ta = el("textarea", { rows: "2", placeholder: f[2] });
          ta.value = g[f[0]] || "";
          ta.addEventListener("input", function () {
            goals[idx][f[0]] = ta.value;
            saveGoals(goals);
          });
          col.appendChild(ta);
          grid.appendChild(col);
        });
        card.appendChild(grid);

        var revWrap = el("div", { className: "bdh-field bdh-reverse" });
        revWrap.appendChild(el("label", null, "Kiểm tra ngược — Mục tiêu này có vô tình vi phạm giá trị đứng cao hơn không?"));
        var revInp = el("input", {
          type: "text",
          placeholder: "Ví dụ: không — vẫn giữ trọn bữa tối với gia đình"
        });
        revInp.value = g.reverseCheck || "";
        revInp.addEventListener("input", function () {
          goals[idx].reverseCheck = revInp.value;
          saveGoals(goals);
        });
        revWrap.appendChild(revInp);
        card.appendChild(revWrap);

        listWrap.appendChild(card);
      });
    }

    renderGoalCards();
    bdh.appendChild(listWrap);

    var addBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "+ Thêm mục tiêu lĩnh vực");
    addBtn.addEventListener("click", function () {
      var used = {};
      goals.forEach(function (g) { used[g.domain] = true; });
      var nextDom = Billing.LIFE_DOMAINS[0].id;
      for (var i = 0; i < Billing.LIFE_DOMAINS.length; i++) {
        if (!used[Billing.LIFE_DOMAINS[i].id]) { nextDom = Billing.LIFE_DOMAINS[i].id; break; }
      }
      goals.push({
        domain: nextDom,
        be: "",
        doText: "",
        have: "",
        linkedValue: rank[0] || "",
        reverseCheck: ""
      });
      saveGoals(goals);
      renderGoalCards();
    });
    bdh.appendChild(addBtn);

    wrap.appendChild(bdh);
    mount.appendChild(wrap);
  }

  /* ---------- Khôi phục từ đám mây (?loadJourney= hoặc banner thiết bị mới) ---------- */
  function checkCloudRestore() {
    var Account = window.TGTAccount;
    var App = window.TimGiaTriApp;
    if (!Account || !App) return;
    var accState = Account.getState();
    if (!accState.configured || !accState.user) return;

    var params = new URLSearchParams(window.location.search);
    var requestedId = params.get("loadJourney");

    Account.listJourneys().then(function (list) {
      if (!list || !list.length) return;

      if (requestedId) {
        var found = list.find(function (j) { return j.id === requestedId; });
        if (found && found.data) {
          setCloudId(found.id);
          App.loadState(found.data, { noScroll: false });
          updateCloudStatusText("Đã mở bản lưu đám mây: " + (found.title || "") + ".");
          var wiz = document.getElementById("hanh-trinh");
          if (wiz && typeof wiz.scrollIntoView === "function") {
            wiz.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", window.location.pathname + "#hanh-trinh");
          }
          return;
        }
      }

      // Nếu thiết bị này chưa có dữ liệu nhưng đám mây đã có -> hiện banner gợi ý khôi phục
      var snap = App.getState();
      var localEmpty =
        Object.keys(snap.exps || {}).length === 0 &&
        (!snap.selected || snap.selected.length === 0);

      var banner = document.getElementById("cloudRestoreBanner");
      if (!banner) return;
      banner.textContent = "";

      if (localEmpty) {
        var latest = list[0];
        banner.hidden = false;
        banner.appendChild(el("span", null,
          "Bạn có bản lưu trên đám mây (“" + (latest.title || "Hành trình trước") + "”, cập nhật " + formatDateVi(latest.updated_at) + ")."));
        var restoreBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Khôi phục về máy này");
        restoreBtn.addEventListener("click", function () {
          setCloudId(latest.id);
          App.loadState(latest.data, { noScroll: true });
          banner.hidden = true;
          updateCloudStatusText("Đã khôi phục từ đám mây.");
        });
        banner.appendChild(restoreBtn);
      } else {
        banner.hidden = true;
      }
    }).catch(function () {});
  }

  function init() {
    var Account = window.TGTAccount;
    var App = window.TimGiaTriApp;
    if (!Account || !App) return;

    App.onSave(function () { scheduleCloudSync(); });
    App.onStepChange(function (step) {
      if (step === 8) renderProSection();
    });

    Account.onChange(function () {
      if (App.getStep() === 8) renderProSection();
    });

    Account.ready().then(function () {
      checkCloudRestore();
      if (App.getStep() === 8) renderProSection();
    });
  }

  init();
})();
