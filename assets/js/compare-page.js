(function () {
  "use strict";

  var STORAGE_KEY = "tim-gia-tri-v1";
  var PENDING_COMPARE_KEY = "tgt-pending-compare";

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function loadLocalProfile() {
    var Core = window.TimGiaTriCore;
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var clean = Core ? Core.sanitizeSavedState(parsed) : parsed;
      if (!clean || !Array.isArray(clean.ranking) || clean.ranking.length < 3) return null;
      return {
        name: "Bạn",
        ranking: clean.ranking.slice(0, 5),
        antis: Array.isArray(clean.antis) ? clean.antis.slice(0, 5) : []
      };
    } catch (e) {
      return null;
    }
  }

  function extractEncodedFromHash(str) {
    var s = String(str || "").trim();
    if (!s) return "";
    var idx = s.indexOf("#p=");
    if (idx !== -1) return decodeURIComponent(s.slice(idx + 3).split("&")[0]);
    var qIdx = s.indexOf("p=");
    if (qIdx !== -1) return decodeURIComponent(s.slice(qIdx + 2).split("&")[0]);
    return s;
  }

  function render() {
    var root = document.getElementById("compareRoot");
    var Growth = window.TimGiaTriGrowth;
    var Core = window.TimGiaTriCore;
    if (!root || !Growth || !Core) return;
    root.textContent = "";

    var encoded = extractEncodedFromHash(window.location.hash || window.location.search);
    var partner = encoded ? Growth.decodeCompareProfile(encoded) : null;
    var mine = loadLocalProfile();

    // Trường hợp 1: Có link đối phương nhưng người xem chưa làm workbook
    if (partner && !mine) {
      try { window.sessionStorage.setItem(PENDING_COMPARE_KEY, encoded); } catch (e) {}
      var inv = el("div", { className: "panel compare-invite-card" });
      inv.appendChild(el("p", { className: "sec-tag" }, "Lời mời so sánh từ " + (partner.name || "một người bạn")));
      inv.appendChild(el("h2", null, (partner.name || "Người gửi") + " đã gửi Bản đồ giá trị để so sánh với bạn"));
      inv.appendChild(el("p", { className: "intro" },
        "Để kết quả trung thực và không bị ảnh hưởng trước, Top 5 giá trị của " + (partner.name || "đối phương") +
        " đang được giữ kín. Hãy dành 10 phút hoàn thành 7 bước tự khám phá — ngay khi xong, hệ thống sẽ tự mở Bản đồ giao thoa giữa hai người."));
      inv.appendChild(el("a", { className: "btn btn-primary", href: "index.html#hanh-trinh" },
        "Bắt đầu hành trình 7 bước (Miễn phí) →"));
      root.appendChild(inv);
      return;
    }

    // Trường hợp 2: Chưa có link đối phương
    if (!partner) {
      var box = el("div", { className: "panel compare-invite-card" });
      if (mine) {
        box.appendChild(el("p", { className: "sec-tag" }, "Bạn đã có Top 5 giá trị"));
        box.appendChild(el("h2", null, "Tạo link mời người thương, bạn thân hoặc co-founder"));
        box.appendChild(el("p", { className: "intro" },
          "Top 5 hiện tại của bạn: " + mine.ranking.join(" · ") + ". Nhập tên ngắn rồi bấm sao chép link mời bên dưới để gửi cho người kia."));

        var form = el("div", { className: "account-form inline-form" });
        var nameInp = el("input", { type: "text", maxlength: "40", placeholder: "Tên của bạn (ví dụ: Minh)" });
        var copyBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Sao chép link mời");
        var msg = el("p", { className: "account-msg", role: "status" });

        copyBtn.addEventListener("click", function () {
          var code = Growth.encodeCompareProfile({
            name: nameInp.value.trim(),
            ranking: mine.ranking,
            antis: mine.antis
          });
          var url = window.location.href.replace(/[#?].*$/, "") + "#p=" + code;
          if (window.TGTAnalytics) window.TGTAnalytics.track("compare_invite_copy", null, { from: "compare_page" });
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
              msg.textContent = "Đã sao chép link mời! Gửi cho người kia để mở Bản đồ giao thoa.";
            }).catch(function () {
              msg.textContent = "Link mời của bạn: " + url;
            });
          } else {
            msg.textContent = "Link mời của bạn: " + url;
          }
        });

        form.appendChild(nameInp);
        form.appendChild(copyBtn);
        box.appendChild(form);
        box.appendChild(msg);
      } else {
        box.appendChild(el("p", { className: "sec-tag" }, "Bắt đầu so sánh"));
        box.appendChild(el("h2", null, "Hãy hoàn thành Bản đồ giá trị của bạn trước"));
        box.appendChild(el("p", { className: "intro" },
          "Chỉ mất khoảng 10 phút với 7 bước hoàn toàn miễn phí và không cần tạo tài khoản. Sau đó bạn có thể tạo link mời bất kỳ ai so sánh."));
        box.appendChild(el("a", { className: "btn btn-primary", href: "index.html#hanh-trinh" }, "Bắt đầu hành trình 7 bước →"));
      }
      root.appendChild(box);
      return;
    }

    // Trường hợp 3: Đủ cả 2 hồ sơ -> Hiển thị Bản đồ giao thoa đầy đủ!
    try { window.sessionStorage.removeItem(PENDING_COMPARE_KEY); } catch (e) {}
    if (window.TGTAnalytics) window.TGTAnalytics.track("compare_view", null, {}, { once: true });

    var res = Growth.compareTwoProfiles(partner, mine, Core.ANTI_MAP);
    var partnerLabel = partner.name || "Người mời";

    // Header điểm đồng điệu
    var hero = el("div", { className: "panel compare-score-card" });
    hero.appendChild(el("p", { className: "sec-tag" }, partnerLabel + "  ×  Bạn"));
    hero.appendChild(el("div", { className: "compare-score-num" }, res.alignmentScore + "%"));
    hero.appendChild(el("h2", null,
      res.alignmentScore >= 65
        ? "Độ đồng điệu giá trị cao — nền tảng chung rất rõ"
        : res.alignmentScore >= 35
          ? "Vừa có điểm chung vừa có vùng bổ trợ thú vị"
          : "Hai hệ giá trị bổ trợ mạnh — cần tôn trọng ưu tiên khác nhau"
    ));
    hero.appendChild(el("p", { className: "intro" },
      "Chỉ số này đo mức độ trùng khớp có trọng số thứ hạng trong Top 5 và ranh giới đỏ của hai người. Khác nhau không có nghĩa là không hợp — quan trọng là gọi tên được sự khác biệt."));
    root.appendChild(hero);

    // 3 cột: Điểm chung / Chỉ có ở A / Chỉ có ở Bạn
    var grid = el("div", { className: "compare-grid" });

    var sharedCard = el("div", { className: "panel compare-col shared" });
    sharedCard.appendChild(el("h3", null, "Giá trị đồng điệu (" + res.shared.length + ")"));
    if (res.shared.length) {
      var ulS = el("ul", { className: "compare-list" });
      res.shared.forEach(function (s) {
        ulS.appendChild(el("li", null, s.value + " (" + partnerLabel + " #" + s.rankA + " · Bạn #" + s.rankB + ")"));
      });
      sharedCard.appendChild(ulS);
    } else {
      sharedCard.appendChild(el("p", { className: "empty-note" }, "Không trùng từ khóa trực tiếp trong Top 5 — hai bạn nhìn đời qua hai lăng kính bổ trợ."));
    }
    grid.appendChild(sharedCard);

    var aCard = el("div", { className: "panel compare-col" });
    aCard.appendChild(el("h3", null, "Ưu tiên riêng của " + partnerLabel));
    var ulA = el("ul", { className: "compare-list" });
    res.onlyA.forEach(function (x) { ulA.appendChild(el("li", null, "#" + x.rank + " " + x.value)); });
    aCard.appendChild(ulA);
    grid.appendChild(aCard);

    var bCard = el("div", { className: "panel compare-col" });
    bCard.appendChild(el("h3", null, "Ưu tiên riêng của Bạn"));
    var ulB = el("ul", { className: "compare-list" });
    res.onlyB.forEach(function (x) { ulB.appendChild(el("li", null, "#" + x.rank + " " + x.value)); });
    bCard.appendChild(ulB);
    grid.appendChild(bCard);

    root.appendChild(grid);

    // Điểm dễ va chạm
    if (res.tensions.length) {
      var tenBox = el("div", { className: "panel compare-tensions" });
      tenBox.appendChild(el("p", { className: "sec-tag" }, "Cần trò chuyện rõ"));
      tenBox.appendChild(el("h3", null, "Điểm dễ va chạm & ranh giới đỏ"));
      var ulT = el("ul");
      res.tensions.forEach(function (t) { ulT.appendChild(el("li", null, t)); });
      tenBox.appendChild(ulT);
      root.appendChild(tenBox);
    }

    // 3 câu hỏi đối thoại cho 2 người
    var promptBox = el("div", { className: "panel compare-prompts" });
    promptBox.appendChild(el("p", { className: "sec-tag" }, "Gợi ý đối thoại 15 phút"));
    promptBox.appendChild(el("h3", null, "3 câu hỏi đáng ngồi xuống nói cùng nhau"));
    var olP = el("ol");
    res.prompts.forEach(function (p) { olP.appendChild(el("li", null, p)); });
    promptBox.appendChild(olP);
    root.appendChild(promptBox);

    // Upsell nhẹ sang gói Pro / Workshop
    var ctaBox = el("div", { className: "pro-upsell" });
    ctaBox.appendChild(el("p", { className: "sec-tag" }, "Đi sâu hơn"));
    ctaBox.appendChild(el("h4", null, "Muốn lưu lịch sử qua các năm, nhận luận giải AI hoặc làm cho cả đội ngũ?"));
    var foot = el("div", { className: "pro-upsell-foot" });
    foot.appendChild(el("a", { className: "btn btn-primary btn-small", href: "account.html" }, "Khám phá Tìm Giá Trị Pro →"));
    foot.appendChild(el("a", { className: "btn btn-ghost btn-small", href: "workshop.html" }, "Gói Workshop / Team →"));
    ctaBox.appendChild(foot);
    root.appendChild(ctaBox);
  }

  function init() {
    var form = document.getElementById("pasteCompareForm");
    var inp = document.getElementById("pasteCompareInput");
    var msg = document.getElementById("pasteCompareMsg");
    if (form && inp) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = extractEncodedFromHash(inp.value);
        var Growth = window.TimGiaTriGrowth;
        if (!code || !Growth || !Growth.decodeCompareProfile(code)) {
          if (msg) msg.textContent = "Đường dẫn hoặc mã so sánh không hợp lệ. Vui lòng kiểm tra lại.";
          return;
        }
        window.location.hash = "#p=" + encodeURIComponent(code);
        if (msg) msg.textContent = "";
        render();
      });
    }

    window.addEventListener("hashchange", render);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
