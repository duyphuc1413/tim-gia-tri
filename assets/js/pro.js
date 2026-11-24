(function () {
  "use strict";

  var CLOUD_ID_KEY = "tim-gia-tri-cloud-id";
  var PENDING_COMPARE_KEY = "tgt-pending-compare";
  var syncTimer = null;
  var syncing = false;
  var lastSyncedText = "";
  var activeProTab = "ai";

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
    var extras = snap.extras || {};
    var goals = Array.isArray(extras.goals) ? extras.goals : [];
    var aiReport = extras.aiReport && Array.isArray(extras.aiReport.sections) ? extras.aiReport : null;
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

    var aiHtml = aiReport
      ? "<section><h2>Luận giải chuyên sâu cá nhân hóa</h2>" +
        (aiReport.headline ? "<p class='headline'>" + escapeHtml(aiReport.headline) + "</p>" : "") +
        aiReport.sections.map(function (s) {
          return "<div class='card'><h3>" + escapeHtml(s.title) + "</h3><p>" + escapeHtml(s.body) + "</p></div>";
        }).join("") +
        "</section>"
      : "";

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
      ".headline{font-size:16px;font-style:italic;color:#a93226;margin:0 0 12px}" +
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
      aiHtml + goalsHtml + antiHtml + expHtml +
      "<footer>Nhắc mình: soi lại sau 24 giờ, hằng tháng và làm lại hằng năm. Đừng hỏi “tôi muốn trở thành người thế nào?” — hãy hỏi “đời tôi đã chứng minh tôi là người thế nào?”.</footer>" +
      "</body></html>";

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  /* ---------- Khối Viral miễn phí: Tải ảnh chia sẻ & Mời so sánh 2 người ---------- */
  function buildShareAndCompareBox(App, Core, accState) {
    var snap = App.getState();
    var rank = App.getRanking();
    if (!rank.length) return null;

    var box = el("div", { className: "growth-share-box" });

    // Nếu người dùng đến từ link mời so sánh, hiện lời nhắc quay lại xem ngay
    var pendingHash = "";
    try { pendingHash = window.sessionStorage.getItem(PENDING_COMPARE_KEY) || ""; } catch (e) {}
    if (pendingHash) {
      var banner = el("div", { className: "compare-return-banner" });
      banner.appendChild(el("span", null, "Bạn đang có lời mời so sánh giá trị từ một người bạn."));
      banner.appendChild(el("a", {
        className: "btn btn-primary btn-small",
        href: "compare.html#p=" + encodeURIComponent(pendingHash)
      }, "Xem Bản đồ giao thoa ngay →"));
      box.appendChild(banner);
    }

    var head = el("div", { className: "growth-share-head" });
    head.appendChild(el("p", { className: "sec-tag" }, "Chia sẻ & So sánh · Miễn phí"));
    head.appendChild(el("h4", null, "Lưu ảnh Bản đồ Giá trị hoặc mời người thương / đồng sáng lập so sánh"));
    head.appendChild(el("p", null,
      "Xuất thẻ ảnh thẩm mỹ để đăng Story / Facebook, hoặc tạo đường dẫn so sánh riêng tư (chỉ chứa tên ngắn và Top 5 giá trị, không gửi dữ liệu lên máy chủ)."));
    box.appendChild(head);

    var nameRow = el("div", { className: "growth-name-row" });
    var defaultName = (accState && accState.profile && accState.profile.display_name) ? accState.profile.display_name : "";
    var nameInput = el("input", {
      type: "text",
      maxlength: "40",
      placeholder: "Tên hiển thị trên ảnh / link so sánh (tùy chọn)",
      "aria-label": "Tên hiển thị trên ảnh hoặc link so sánh"
    });
    nameInput.value = defaultName;
    nameRow.appendChild(nameInput);
    box.appendChild(nameRow);

    var actions = el("div", { className: "growth-share-actions" });
    var msg = el("p", { className: "growth-share-msg", role: "status", "aria-live": "polite" });

    var storyBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Tải ảnh Story (9:16)");
    storyBtn.addEventListener("click", function () {
      if (!window.TGTShareCard) return;
      window.TGTShareCard.download("story", {
        name: nameInput.value.trim(),
        ranking: rank,
        antis: snap.antis || [],
        definitions: snap.definitions || {},
        dateStr: Core.formatVietnameseDate(new Date())
      });
      msg.textContent = "Đã tải ảnh Story (1080×1920) về máy.";
    });

    var fbBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Tải ảnh Facebook / LinkedIn (16:9)");
    fbBtn.addEventListener("click", function () {
      if (!window.TGTShareCard) return;
      window.TGTShareCard.download("landscape", {
        name: nameInput.value.trim(),
        ranking: rank,
        antis: snap.antis || [],
        definitions: snap.definitions || {},
        dateStr: Core.formatVietnameseDate(new Date())
      });
      msg.textContent = "Đã tải ảnh ngang (1200×630) về máy.";
    });

    var cmpBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Sao chép link mời so sánh 2 người");
    cmpBtn.addEventListener("click", function () {
      var Growth = window.TimGiaTriGrowth;
      if (!Growth) return;
      var encoded = Growth.encodeCompareProfile({
        name: nameInput.value.trim(),
        ranking: rank.slice(0, 5),
        antis: (snap.antis || []).slice(0, 3)
      });
      if (!encoded) return;
      var base = window.location.href.replace(/[#?].*$/, "").replace(/\/[^/]*$/, "/");
      var url = base + "compare.html#p=" + encoded;

      if (window.TGTAnalytics) {
        window.TGTAnalytics.track("compare_invite_copy", 8, {});
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(url).then(function () {
          msg.textContent = "Đã sao chép link mời so sánh! Gửi link này cho người thương, bạn thân hoặc co-founder để xem Bản đồ giao thoa.";
        }).catch(function () {
          msg.textContent = "Link so sánh: " + url;
        });
      } else {
        msg.textContent = "Link so sánh: " + url;
      }
    });

    var openCmpLink = el("a", { className: "btn btn-ghost btn-small", href: "compare.html" }, "Mở trang So sánh →");

    actions.appendChild(storyBtn);
    actions.appendChild(fbBtn);
    actions.appendChild(cmpBtn);
    actions.appendChild(openCmpLink);
    box.appendChild(actions);
    box.appendChild(msg);

    return box;
  }

  /* ---------- Soft Paywall với Blurred Preview cho người dùng miễn phí ---------- */
  function buildProUpsell(App, Billing, accState) {
    var rank = App.getRanking();
    var top1 = rank[0] || "giá trị #1";
    var top2 = rank[1] || "giá trị #2";

    var box = el("div", { className: "pro-upsell" });
    var head = el("div", { className: "pro-upsell-head" });
    head.appendChild(el("p", { className: "sec-tag" }, "Mở khóa bản đầy đủ · Tìm Giá Trị Pro"));
    head.appendChild(el("h4", null, "Báo cáo luận giải chuyên sâu cho “" + top1 + "” & “" + top2 + "” + Công cụ sống đúng giá trị"));
    head.appendChild(el("p", null,
      "Hành trình 7 bước và thẻ ảnh chia sẻ luôn miễn phí. Nâng cấp Pro (hoặc kích hoạt 3 ngày dùng thử miễn phí) để mở khóa bản phân tích sâu viết riêng cho bạn, kế hoạch BE–DO–HAVE, check-in hằng tuần và ma trận ra quyết định."));
    box.appendChild(head);

    // Preview mờ cá nhân hóa từ chính Top 2 của người dùng
    var preview = el("div", { className: "pro-preview-card" });
    preview.appendChild(el("p", { className: "pro-preview-kicker" }, "XEM TRƯỚC BÁO CÁO CÁ NHÂN HÓA CỦA BẠN"));
    preview.appendChild(el("p", { className: "pro-preview-headline" }, "Trục định vị: “" + top1 + "” dẫn đường, “" + top2 + "” làm nền"));
    var blurGrid = el("div", { className: "pro-preview-blur", "aria-hidden": "true" });
    [
      "1. Bản sắc cốt lõi từ 6 khoảnh khắc sống của bạn cho thấy cơ chế ra quyết định tiềm ẩn và lý do bạn thấy tràn đầy năng lượng khi…",
      "2. Điểm căng nội tâm giữa " + top1 + " và " + top2 + ": tình huống cụ thể dễ khiến bạn cảm thấy tội lỗi hoặc bứt rứt…",
      "3. Bẫy kiệt sức & môi trường công việc cần tránh dựa trên ranh giới đỏ của bạn…",
      "4. Lộ trình thực hành 30 ngày + Ma trận chấm điểm quyết định theo trọng số Top 5…"
    ].forEach(function (line) {
      blurGrid.appendChild(el("p", null, line));
    });
    preview.appendChild(blurGrid);
    box.appendChild(preview);

    var list = el("ul", { className: "pro-feature-list" });
    [
      "Báo cáo luận giải chuyên sâu (AI) đọc trực tiếp bằng chứng sống & Top 5 của bạn.",
      "Bước 8 tương tác: đặt mục tiêu BE–DO–HAVE cho 7 lĩnh vực đời sống.",
      "Check-in sống đúng giá trị hằng tuần & Ma trận ra quyết định có trọng số Top 5.",
      "Lưu đám mây, đồng bộ nhiều thiết bị, lịch sử nhiều năm & Xuất báo cáo PDF A4."
    ].forEach(function (t) {
      list.appendChild(el("li", null, t));
    });
    box.appendChild(list);

    var foot = el("div", { className: "pro-upsell-foot" });
    var ctaLabel = accState.user ? "Mở khóa Tìm Giá Trị Pro →" : "Mở khóa miễn phí 3 ngày dùng thử →";
    var ctaLink = el("a", { className: "btn btn-primary", href: "account.html" }, ctaLabel);
    ctaLink.addEventListener("click", function () {
      if (window.TGTAnalytics) {
        window.TGTAnalytics.track("pro_cta_click", 8, { loggedIn: !!accState.user });
      }
    });
    foot.appendChild(ctaLink);
    foot.appendChild(el("span", { className: "pro-price-hint" },
      "Chỉ " + Billing.formatVnd(Billing.PLANS.yearly.price) + "/năm (tiết kiệm " + Billing.yearlySavingsPercent() + "%) · hoặc " +
      Billing.formatVnd(Billing.PLANS.lifetime.price) + " trọn đời (trả 1 lần)"));
    box.appendChild(foot);
    return box;
  }

  /* ---------- Tab 1: Báo cáo luận giải chuyên sâu (AI) ---------- */
  function renderAiTab(container, App, Account) {
    var extras = App.getExtras();
    var report = extras.aiReport && Array.isArray(extras.aiReport.sections) ? extras.aiReport : null;

    var head = el("div", { className: "pro-tab-head" });
    head.appendChild(el("h4", null, "Báo cáo luận giải chuyên sâu cá nhân hóa"));
    head.appendChild(el("p", { className: "intro" },
      "Hệ thống đọc trực tiếp 6 khoảnh khắc Bước 1, Top 5 giá trị và những điều bạn không chịu nổi để chỉ ra trục định vị, điểm căng nội tâm và bẫy kiệt sức của riêng bạn."));
    container.appendChild(head);

    var statusMsg = el("p", { className: "pro-status-note", role: "status", "aria-live": "polite" });
    var genBtn = el("button", { type: "button", className: "btn btn-primary btn-small" },
      report ? "Tạo lại bản luận giải mới" : "Tạo bản luận giải cá nhân hóa");
    var bodyWrap = el("div", { className: "ai-report-body" });

    function drawReport(rep) {
      bodyWrap.textContent = "";
      if (!rep) {
        bodyWrap.appendChild(el("p", { className: "empty-note" },
          "Bấm nút phía trên để sinh bản luận giải 4 phần cho bảng giá trị của bạn. Kết quả sẽ tự động lưu vào đám mây và đưa vào bản xuất PDF A4."));
        return;
      }
      if (rep.headline) {
        bodyWrap.appendChild(el("p", { className: "ai-headline" }, rep.headline));
      }
      rep.sections.forEach(function (sec) {
        var card = el("div", { className: "ai-section-card" });
        card.appendChild(el("h5", null, sec.title));
        card.appendChild(el("p", null, sec.body));
        bodyWrap.appendChild(card);
      });
      if (rep.generatedAt) {
        bodyWrap.appendChild(el("p", { className: "pro-status-note" },
          "Tạo lúc " + formatDateVi(rep.generatedAt) + (rep.mode === "structured" ? " · Chế độ phân tích cấu trúc." : " · Phân tích AI chuyên sâu.")));
      }
    }

    genBtn.addEventListener("click", function () {
      var snap = App.getState();
      var rank = App.getRanking();
      if (rank.length < 3) {
        statusMsg.textContent = "Cần hoàn thành ít nhất 3 giá trị xếp hạng trước khi phân tích.";
        return;
      }
      genBtn.disabled = true;
      statusMsg.textContent = "Đang phân tích bảng giá trị & bằng chứng sống của bạn…";
      if (window.TGTAnalytics) {
        window.TGTAnalytics.track("ai_report_generate", 8, {});
      }
      Account.requestAiAnalysis({
        ranking: rank.slice(0, 5),
        antis: snap.antis || [],
        definitions: snap.definitions || {},
        experiences: App.getExperiences()
      }).then(function (res) {
        if (res && res.report) {
          var cur = App.getExtras();
          cur.aiReport = res.report;
          App.setExtras(cur);
          drawReport(res.report);
          statusMsg.textContent = "Đã hoàn tất bản luận giải và lưu vào hành trình.";
        } else {
          statusMsg.textContent = "Chưa nhận được kết quả phân tích. Vui lòng thử lại.";
        }
      }).catch(function (err) {
        statusMsg.textContent = (err && err.message) ? err.message : "Không thể kết nối máy chủ phân tích.";
      }).finally(function () {
        genBtn.disabled = false;
      });
    });

    container.appendChild(genBtn);
    container.appendChild(statusMsg);
    drawReport(report);
    container.appendChild(bodyWrap);
  }

  /* ---------- Tab 2: Bước 8 BE-DO-HAVE ---------- */
  function renderBdhTab(container, App, Billing) {
    container.appendChild(el("h4", null, "Bước 8 · Đặt mục tiêu theo mô hình BE – DO – HAVE"));
    container.appendChild(el("p", { className: "intro" },
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
    container.appendChild(listWrap);

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
    container.appendChild(addBtn);
  }

  /* ---------- Tab 3: Check-in sống đúng giá trị hằng tuần ---------- */
  function renderCheckinTab(container, App) {
    var Growth = window.TimGiaTriGrowth;
    var rank = App.getRanking().slice(0, 5);
    var extras = App.getExtras();
    var checkins = Array.isArray(extras.checkins) ? extras.checkins.slice() : [];

    container.appendChild(el("h4", null, "Check-in sống đúng giá trị (2 phút cuối tuần)"));
    container.appendChild(el("p", { className: "intro" },
      "Tuần vừa qua bạn đã sống đúng với từng giá trị trong Top 5 ở mức nào (1 = trượt xa, 5 = sống trọn vẹn)? Lưu lại đều đặn để theo dõi chỉ số đồng điệu theo thời gian."));

    var draftScores = {};
    rank.forEach(function (v) { draftScores[v] = 3; });

    var form = el("div", { className: "checkin-form" });
    var liveScore = el("p", { className: "checkin-live-score" }, "Chỉ số đồng điệu tuần này: 60%");

    function updateLive() {
      var pct = Growth ? Growth.computeCheckinScore(draftScores, rank) : 60;
      liveScore.textContent = "Chỉ số đồng điệu tuần này: " + pct + "%";
    }

    rank.forEach(function (v, idx) {
      var row = el("div", { className: "checkin-row" });
      row.appendChild(el("span", { className: "checkin-label" }, "#" + (idx + 1) + " " + v));
      var pills = el("div", { className: "checkin-pills" });
      [1, 2, 3, 4, 5].forEach(function (num) {
        var btn = el("button", {
          type: "button",
          className: "checkin-pill" + (num === 3 ? " active" : "")
        }, String(num));
        btn.addEventListener("click", function () {
          draftScores[v] = num;
          Array.prototype.forEach.call(pills.children, function (c) { c.classList.remove("active"); });
          btn.classList.add("active");
          updateLive();
        });
        pills.appendChild(btn);
      });
      row.appendChild(pills);
      form.appendChild(row);
    });

    var noteInp = el("input", {
      type: "text",
      maxlength: "250",
      placeholder: "Ghi chú 1 dòng: tuần này điều gì giúp bạn sống đúng (hoặc làm bạn lệch) giá trị?"
    });
    form.appendChild(noteInp);
    form.appendChild(liveScore);

    var saveBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Lưu Check-in tuần này");
    var histWrap = el("div", { className: "checkin-history" });

    function drawHistory() {
      histWrap.textContent = "";
      if (!checkins.length) {
        histWrap.appendChild(el("p", { className: "empty-note" }, "Chưa có lịch sử check-in nào."));
        return;
      }
      histWrap.appendChild(el("h5", null, "Lịch sử Check-in (" + checkins.length + " lần)"));
      checkins.slice(0, 10).forEach(function (c) {
        var item = el("div", { className: "checkin-hist-item" });
        var meta = el("div", { className: "checkin-hist-meta" });
        meta.appendChild(el("strong", null, c.pct + "%"));
        meta.appendChild(el("span", null, formatDateVi(c.date)));
        item.appendChild(meta);
        var barTrack = el("div", { className: "checkin-bar-track" });
        var barFill = el("div", { className: "checkin-bar-fill" });
        barFill.style.width = Math.max(4, Math.min(100, c.pct || 0)) + "%";
        barTrack.appendChild(barFill);
        item.appendChild(barTrack);
        if (c.note) item.appendChild(el("p", { className: "checkin-hist-note" }, c.note));
        histWrap.appendChild(item);
      });
    }

    saveBtn.addEventListener("click", function () {
      var pct = Growth ? Growth.computeCheckinScore(draftScores, rank) : 60;
      checkins.unshift({
        date: new Date().toISOString(),
        scores: Object.assign({}, draftScores),
        note: noteInp.value.trim(),
        pct: pct
      });
      checkins = checkins.slice(0, 52);
      var cur = App.getExtras();
      cur.checkins = checkins;
      App.setExtras(cur);
      noteInp.value = "";
      drawHistory();
    });

    form.appendChild(saveBtn);
    container.appendChild(form);
    drawHistory();
    container.appendChild(histWrap);
  }

  /* ---------- Tab 4: Ma trận ra quyết định có trọng số Top 5 ---------- */
  function renderDecisionTab(container, App) {
    var Growth = window.TimGiaTriGrowth;
    var rank = App.getRanking().slice(0, 5);
    var extras = App.getExtras();
    var dec = (extras.decision && typeof extras.decision === "object")
      ? extras.decision
      : {
          question: "",
          options: [
            { name: "Phương án A", scores: {} },
            { name: "Phương án B", scores: {} }
          ]
        };
    if (!Array.isArray(dec.options) || dec.options.length < 2) {
      dec.options = [
        { name: "Phương án A", scores: {} },
        { name: "Phương án B", scores: {} }
      ];
    }

    function persist() {
      var cur = App.getExtras();
      cur.decision = dec;
      App.setExtras(cur);
    }

    container.appendChild(el("h4", null, "Ma trận ra quyết định theo trọng số Top 5"));
    container.appendChild(el("p", { className: "intro" },
      "Đang phân vân đổi việc, nhận dự án hay chọn hướng đi? Chấm từng phương án từ 1–5 theo Top 5 giá trị — hệ thống tự nhân trọng số (#1 = 5x, #2 = 4x, ..., #5 = 1x) để chỉ ra lựa chọn đồng điệu nhất."));

    var qInp = el("input", {
      type: "text",
      maxlength: "200",
      placeholder: "Ví dụ: Nên nhận lời mời công ty mới hay ở lại xây team hiện tại?"
    });
    qInp.value = dec.question || "";
    qInp.addEventListener("input", function () {
      dec.question = qInp.value;
      persist();
    });
    container.appendChild(qInp);

    var optWrap = el("div", { className: "decision-options" });
    var resultWrap = el("div", { className: "decision-results" });

    function drawResults() {
      resultWrap.textContent = "";
      if (!Growth) return;
      var ranked = Growth.scoreDecisionOptions(dec.options, rank);
      if (!ranked.length) return;
      resultWrap.appendChild(el("h5", null, "Kết quả xếp hạng độ phù hợp giá trị"));
      ranked.forEach(function (r, idx) {
        var row = el("div", { className: "decision-res-row" + (idx === 0 ? " top" : "") });
        row.appendChild(el("strong", null, (idx === 0 ? "★ " : "") + r.name));
        row.appendChild(el("span", null, r.pct + "% phù hợp (" + r.weighted + "/" + r.maxWeight + " điểm trọng số)"));
        resultWrap.appendChild(row);
      });
    }

    function drawOptions() {
      optWrap.textContent = "";
      dec.options.forEach(function (opt, oIdx) {
        var card = el("div", { className: "decision-card" });
        var head = el("div", { className: "decision-card-head" });
        var nameInp = el("input", { type: "text", maxlength: "120", placeholder: "Tên phương án" });
        nameInp.value = opt.name || "";
        nameInp.addEventListener("input", function () {
          dec.options[oIdx].name = nameInp.value;
          persist();
          drawResults();
        });
        head.appendChild(nameInp);
        if (dec.options.length > 2) {
          var rm = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Xóa");
          rm.addEventListener("click", function () {
            dec.options.splice(oIdx, 1);
            persist();
            drawOptions();
            drawResults();
          });
          head.appendChild(rm);
        }
        card.appendChild(head);

        rank.forEach(function (v, vIdx) {
          var row = el("div", { className: "decision-val-row" });
          row.appendChild(el("span", null, "#" + (vIdx + 1) + " " + v + " (×" + (5 - vIdx) + ")"));
          var sel = el("select", { "aria-label": v });
          var curVal = (opt.scores && opt.scores[v]) ? Number(opt.scores[v]) : 3;
          [1, 2, 3, 4, 5].forEach(function (n) {
            var o = el("option", { value: String(n) }, n + " / 5");
            if (n === curVal) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener("change", function () {
            if (!dec.options[oIdx].scores) dec.options[oIdx].scores = {};
            dec.options[oIdx].scores[v] = Number(sel.value);
            persist();
            drawResults();
          });
          row.appendChild(sel);
          card.appendChild(row);
        });

        optWrap.appendChild(card);
      });
    }

    drawOptions();
    drawResults();
    container.appendChild(optWrap);

    if (dec.options.length < 4) {
      var addOptBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "+ Thêm phương án");
      addOptBtn.addEventListener("click", function () {
        if (dec.options.length >= 4) return;
        dec.options.push({ name: "Phương án " + String.fromCharCode(65 + dec.options.length), scores: {} });
        persist();
        drawOptions();
        drawResults();
      });
      container.appendChild(addOptBtn);
    }
    container.appendChild(resultWrap);
  }

  /* ---------- Render Bước 8: Viral Box + Pro Workspace ---------- */
  function renderProSection() {
    var mount = document.getElementById("proResultMount");
    var Account = window.TGTAccount;
    var App = window.TimGiaTriApp;
    var Billing = window.TimGiaTriBilling;
    var Core = window.TimGiaTriCore;
    if (!mount || !Account || !App || !Billing || !Core) return;

    mount.textContent = "";
    var accState = Account.getState();

    // 1. Luôn hiển thị khối Chia sẻ ảnh & Mời so sánh 2 người (miễn phí cho mọi user)
    var shareBox = buildShareAndCompareBox(App, Core, accState);
    if (shareBox) mount.appendChild(shareBox);

    // 2. Chưa Pro hoặc chưa đăng nhập -> hiện Soft Paywall kèm preview mờ cá nhân hóa
    if (!accState.configured || !accState.user || !accState.entitlement.isPro) {
      mount.appendChild(buildProUpsell(App, Billing, accState));
      return;
    }

    // 3. Đang trong 3 ngày dùng thử / gói Pro / Trọn đời -> Pro Workspace 4 tab
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

    var tabs = el("div", { className: "pro-tabs", role: "tablist" });
    var tabBody = el("div", { className: "pro-tab-panel" });

    var tabDefs = [
      { id: "ai", label: "Luận giải AI" },
      { id: "bdh", label: "Bước 8 · BE–DO–HAVE" },
      { id: "checkin", label: "Check-in tuần" },
      { id: "decision", label: "Ma trận quyết định" }
    ];

    function renderActiveTab() {
      tabBody.textContent = "";
      Array.prototype.forEach.call(tabs.children, function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === activeProTab);
      });
      if (activeProTab === "ai") renderAiTab(tabBody, App, Account);
      else if (activeProTab === "bdh") renderBdhTab(tabBody, App, Billing);
      else if (activeProTab === "checkin") renderCheckinTab(tabBody, App);
      else if (activeProTab === "decision") renderDecisionTab(tabBody, App);
    }

    tabDefs.forEach(function (t) {
      var btn = el("button", {
        type: "button",
        className: "pro-tab-btn" + (t.id === activeProTab ? " active" : ""),
        "data-tab": t.id,
        role: "tab"
      }, t.label);
      btn.addEventListener("click", function () {
        activeProTab = t.id;
        renderActiveTab();
      });
      tabs.appendChild(btn);
    });

    wrap.appendChild(tabs);
    wrap.appendChild(tabBody);
    renderActiveTab();
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
