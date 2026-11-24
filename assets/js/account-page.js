(function () {
  "use strict";

  var THEME_KEY = "tim-gia-tri-theme";
  var $ = function (id) { return document.getElementById(id); };

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

  /* ---------- Theme toggle (đồng bộ với trang chính) ---------- */
  (function initTheme() {
    var btn = $("themeToggle");
    var root = document.documentElement;
    var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function sys() { return mql && mql.matches ? "dark" : "light"; }
    function apply(pref) {
      var eff = pref === "dark" || pref === "light" ? pref : sys();
      if (pref === "dark" || pref === "light") root.setAttribute("data-theme", pref);
      else root.removeAttribute("data-theme");
      if (btn) {
        btn.setAttribute("aria-pressed", eff === "dark" ? "true" : "false");
        btn.textContent = eff === "dark" ? "Chế độ sáng" : "Chế độ tối";
      }
    }
    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) {}
    apply(saved);
    if (btn) {
      btn.addEventListener("click", function () {
        var cur = root.getAttribute("data-theme") || sys();
        var next = cur === "dark" ? "light" : "dark";
        try { window.localStorage.setItem(THEME_KEY, next); } catch (e) {}
        apply(next);
      });
    }
  })();

  function setMsg(id, text, ok) {
    var node = $(id);
    if (!node) return;
    node.textContent = text || "";
    node.classList.toggle("ok", !!ok);
  }

  function formatDateVi(d) {
    if (!d) return "";
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatDateTimeVi(d) {
    if (!d) return "";
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  /* ---------- Auth UI state ---------- */
  var emailMode = "login"; // 'login' | 'signup' | 'forgot'
  var pendingZaloPhone = "";

  function setEmailMode(mode) {
    emailMode = mode;
    $("modeLoginBtn").classList.toggle("active", mode === "login");
    $("modeSignupBtn").classList.toggle("active", mode === "signup");
    $("modeForgotBtn").classList.toggle("active", mode === "forgot");
    $("displayNameField").hidden = mode !== "signup";
    $("passwordField").hidden = mode === "forgot";
    $("authPassword").required = mode !== "forgot";
    $("authPassword").setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password");
    $("emailSubmitBtn").textContent =
      mode === "signup" ? "Đăng ký & bắt đầu dùng thử 3 ngày"
      : (mode === "forgot" ? "Gửi email đặt lại mật khẩu" : "Đăng nhập");
    setMsg("authMsg", "");
  }

  function initAuthTabs() {
    document.querySelectorAll("[data-auth-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-auth-tab");
        document.querySelectorAll("[data-auth-tab]").forEach(function (t) {
          var active = t === tab;
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        $("tabEmail").hidden = target !== "email";
        $("tabZalo").hidden = target !== "zalo";
        setMsg("authMsg", "");
      });
    });

    $("modeLoginBtn").addEventListener("click", function () { setEmailMode("login"); });
    $("modeSignupBtn").addEventListener("click", function () { setEmailMode("signup"); });
    $("modeForgotBtn").addEventListener("click", function () { setEmailMode("forgot"); });
  }

  function renderDashboard(accState) {
    var Billing = window.TimGiaTriBilling;
    var Account = window.TGTAccount;
    var ent = accState.entitlement;
    var p = accState.profile || {};
    var user = accState.user;

    var ident = p.display_name || p.email || p.phone || (user && (user.email || user.phone)) || "bạn";

    if (ent.status === "paid") {
      $("planTag").textContent = "Đang dùng Tìm Giá Trị Pro";
      $("planHeadline").textContent = "Xin chào " + ident + " — Gói Pro còn " + ent.daysLeft + " ngày";
      $("planSubline").textContent = "Hạn sử dụng đến ngày " + formatDateVi(ent.expiresAt) + ". Toàn bộ tính năng lưu đám mây, lịch sử nhiều năm, Bước 8 BE–DO–HAVE và xuất PDF A4 đang mở.";
    } else if (ent.status === "trial") {
      $("planTag").textContent = "Đang dùng thử miễn phí 3 ngày";
      $("planHeadline").textContent = "Xin chào " + ident + " — Còn " + ent.daysLeft + " ngày dùng thử Pro";
      $("planSubline").textContent = "Dùng thử kết thúc ngày " + formatDateVi(ent.expiresAt) + ". Bạn có thể trải nghiệm toàn bộ tính năng Pro ngay lúc này; hệ thống không tự trừ tiền khi hết hạn.";
    } else {
      $("planTag").textContent = "Tài khoản miễn phí";
      $("planHeadline").textContent = "Xin chào " + ident + " — Gói Pro đã hết hạn";
      $("planSubline").textContent = "Hành trình 7 bước và dữ liệu đã lưu vẫn xem được bình thường. Chọn gói Tháng hoặc Năm bên dưới để tiếp tục đồng bộ đám mây và dùng Bước 8 BE–DO–HAVE.";
    }

    $("profileName").value = p.display_name || "";
    $("profileReminderEmail").value = p.reminder_email || p.email || "";
    $("profileReminderOptIn").checked = p.reminder_opt_in !== false;

    var statusActions = document.querySelector(".status-actions");
    var existingAdminLink = $("adminPanelLink");
    if (p.role === "admin" && statusActions && !existingAdminLink) {
      var a = el("a", { id: "adminPanelLink", className: "btn btn-ghost", href: "admin.html" }, "Bảng quản trị");
      statusActions.insertBefore(a, $("signOutBtn"));
    } else if (p.role !== "admin" && existingAdminLink) {
      existingAdminLink.remove();
    }

    // Tải lịch sử hành trình đám mây
    Account.listJourneys().then(function (list) {
      var wrap = $("journeysList");
      wrap.textContent = "";
      if (!list.length) {
        wrap.appendChild(el("p", { className: "empty-note" },
          "Chưa có hành trình nào được đồng bộ lên đám mây. Hãy mở workbook và làm hành trình — hệ thống sẽ tự lưu khi bạn đang trong hạn dùng thử hoặc gói Pro."));
        return;
      }
      list.forEach(function (item) {
        var row = el("div", { className: "cloud-item" });
        var info = el("div");
        info.appendChild(el("strong", null, item.title || "Hành trình tìm giá trị"));
        var rank = item.data && Array.isArray(item.data.ranking) ? item.data.ranking.slice(0, 5) : [];
        var metaText = "Cập nhật: " + formatDateTimeVi(item.updated_at) +
          (rank.length ? " · Top: " + rank.join(", ") : "");
        info.appendChild(el("p", { className: "cloud-meta" }, metaText));
        row.appendChild(info);

        var acts = el("div", { className: "cloud-actions" });
        acts.appendChild(el("a", {
          className: "btn btn-ghost btn-small",
          href: "index.html?loadJourney=" + encodeURIComponent(item.id)
        }, "Mở trong workbook"));
        var delBtn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Xóa");
        delBtn.addEventListener("click", function () {
          if (!window.confirm("Xóa bản lưu này khỏi đám mây?")) return;
          Account.deleteJourneyCloud(item.id).then(function () {
            row.remove();
          }).catch(function (err) {
            window.alert(err && err.message ? err.message : "Không xóa được.");
          });
        });
        acts.appendChild(delBtn);
        row.appendChild(acts);
        wrap.appendChild(row);
      });
    }).catch(function () {});

    // Tải lịch sử giao dịch PayOS
    Account.listOrders().then(function (orders) {
      var wrap = $("ordersList");
      wrap.textContent = "";
      if (!orders.length) {
        wrap.appendChild(el("p", { className: "empty-note" }, "Chưa có giao dịch nào."));
        return;
      }
      var statusMap = {
        paid: "Đã thanh toán",
        pending: "Chờ thanh toán",
        cancelled: "Đã hủy",
        expired: "Hết hạn"
      };
      orders.forEach(function (o) {
        var row = el("div", { className: "order-row" });
        var left = el("div");
        left.appendChild(el("strong", null, (o.plan === "yearly" ? "Gói Năm" : "Gói Tháng") + " · " + Billing.formatVnd(o.amount)));
        left.appendChild(el("p", { className: "cloud-meta" },
          "Mã #" + o.order_code + " · " + formatDateTimeVi(o.paid_at || o.created_at)));
        row.appendChild(left);
        row.appendChild(el("span", { className: "order-status status-" + o.status }, statusMap[o.status] || o.status));
        wrap.appendChild(row);
      });
    }).catch(function () {});
  }

  function handlePaymentReturnBanner(Account) {
    var params = new URLSearchParams(window.location.search);
    var status = params.get("payment");
    var banner = $("paymentBanner");
    if (!status || !banner) return;

    banner.hidden = false;
    if (status === "success") {
      banner.classList.add("ok");
      banner.textContent = "Đã nhận thông tin chuyển khoản từ PayOS. Hệ thống đang cập nhật hạn Pro của bạn (thường mất 2–5 giây)…";
      setTimeout(function () { Account.refreshProfile(); }, 2500);
      setTimeout(function () { Account.refreshProfile(); }, 6000);
    } else if (status === "cancel") {
      banner.textContent = "Bạn đã hủy phiên thanh toán VietQR. Bạn có thể chọn lại gói bất cứ lúc nào.";
    }
  }

  function init() {
    initAuthTabs();
    var Account = window.TGTAccount;
    var cfg = window.TGT_CONFIG || {};
    if (!Account) return;

    if (!cfg.enableGoogleLogin && $("googleSignInBtn")) $("googleSignInBtn").hidden = true;
    if (!cfg.enablePhoneZaloLogin) {
      var zaloTab = document.querySelector("[data-auth-tab='zalo']");
      if (zaloTab) zaloTab.hidden = true;
    }

    if (!Account.isConfigured()) {
      $("setupNotice").hidden = false;
      ["emailSubmitBtn", "sendOtpBtn", "googleSignInBtn"].forEach(function (id) {
        var b = $(id);
        if (b) b.disabled = true;
      });
      return;
    }

    // Kiểm tra link đặt lại mật khẩu
    if (window.location.hash && window.location.hash.indexOf("type=recovery") >= 0) {
      $("recoveryBox").hidden = false;
    }

    handlePaymentReturnBanner(Account);

    function syncView(accState) {
      var loggedIn = Boolean(accState.user);
      $("authSection").hidden = loggedIn;
      $("dashboardSection").hidden = !loggedIn;
      if (loggedIn) renderDashboard(accState);
    }

    Account.onChange(syncView);
    Account.ready().then(syncView);

    // Email login / signup / forgot
    $("emailAuthForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("authEmail").value.trim();
      var password = $("authPassword").value;
      var name = $("authName").value.trim();
      if (!email) { setMsg("authMsg", "Vui lòng nhập email."); return; }

      setMsg("authMsg", "Đang xử lý…");
      var req;
      if (emailMode === "forgot") {
        req = Account.resetPassword(email).then(function () {
          setMsg("authMsg", "Đã gửi email đặt lại mật khẩu. Hãy kiểm tra hộp thư (kể cả mục Spam).", true);
        });
      } else if (emailMode === "signup") {
        if (password.length < 6) { setMsg("authMsg", "Mật khẩu cần tối thiểu 6 ký tự."); return; }
        req = Account.signUpWithEmail(email, password, name).then(function (data) {
          if (data && data.session) {
            setMsg("authMsg", "Đăng ký thành công! Bạn đã có 3 ngày dùng thử Pro.", true);
          } else {
            setMsg("authMsg", "Đăng ký thành công! Hãy mở email để xác nhận tài khoản rồi đăng nhập.", true);
          }
        });
      } else {
        req = Account.signInWithEmail(email, password).then(function () {
          setMsg("authMsg", "Đăng nhập thành công.", true);
        });
      }

      req.catch(function (err) {
        setMsg("authMsg", err && err.message ? err.message : "Không thể thực hiện yêu cầu lúc này.");
      });
    });

    // Google OAuth
    $("googleSignInBtn").addEventListener("click", function () {
      setMsg("authMsg", "Đang chuyển sang trang đăng nhập Google…");
      Account.signInWithGoogle().catch(function (err) {
        setMsg("authMsg", err && err.message ? err.message : "Không kết nối được Google.");
      });
    });

    // Phone + OTP qua Zalo ZNS
    $("zaloPhoneForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = $("zaloPhone").value.trim();
      setMsg("authMsg", "Đang gửi mã OTP tới Zalo của bạn…");
      Account.sendPhoneOtp(phone).then(function (normalized) {
        pendingZaloPhone = normalized;
        $("zaloVerifyForm").hidden = false;
        setMsg("authMsg", "Đã gửi mã OTP tới Zalo của số " + phone + ". Hãy nhập mã 6 chữ số bên dưới.", true);
        $("zaloOtp").focus();
      }).catch(function (err) {
        setMsg("authMsg", err && err.message ? err.message : "Không gửi được mã OTP qua Zalo.");
      });
    });

    $("resendOtpBtn").addEventListener("click", function () {
      if (!pendingZaloPhone) return;
      setMsg("authMsg", "Đang gửi lại mã OTP…");
      Account.sendPhoneOtp(pendingZaloPhone).then(function () {
        setMsg("authMsg", "Đã gửi lại mã OTP qua Zalo.", true);
      }).catch(function (err) {
        setMsg("authMsg", err && err.message ? err.message : "Không gửi lại được lúc này.");
      });
    });

    $("zaloVerifyForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var token = $("zaloOtp").value.trim();
      if (!token) { setMsg("authMsg", "Vui lòng nhập mã OTP từ Zalo."); return; }
      setMsg("authMsg", "Đang xác thực mã OTP…");
      Account.verifyPhoneOtp(pendingZaloPhone, token).then(function () {
        setMsg("authMsg", "Đăng nhập thành công!", true);
      }).catch(function (err) {
        setMsg("authMsg", err && err.message ? err.message : "Mã OTP không đúng hoặc đã hết hạn.");
      });
    });

    // Đăng xuất
    $("signOutBtn").addEventListener("click", function () {
      Account.signOut().catch(function () {});
    });

    // Thanh toán PayOS
    document.querySelectorAll("[data-buy-plan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var plan = btn.getAttribute("data-buy-plan");
        btn.disabled = true;
        setMsg("billingMsg", "Đang tạo mã VietQR trên PayOS…");
        Account.createPayment(plan).then(function (data) {
          if (data && data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
          } else {
            throw new Error("Không nhận được liên kết thanh toán.");
          }
        }).catch(function (err) {
          btn.disabled = false;
          setMsg("billingMsg", err && err.message ? err.message : "Không tạo được giao dịch PayOS.");
        });
      });
    });

    // Lưu cài đặt hồ sơ & nhắc nhở
    $("profileForm").addEventListener("submit", function (e) {
      e.preventDefault();
      setMsg("profileMsg", "Đang lưu…");
      Account.updateProfile({
        display_name: $("profileName").value,
        reminder_email: $("profileReminderEmail").value,
        reminder_opt_in: $("profileReminderOptIn").checked
      }).then(function () {
        setMsg("profileMsg", "Đã lưu cài đặt hồ sơ.", true);
      }).catch(function (err) {
        setMsg("profileMsg", err && err.message ? err.message : "Không lưu được cài đặt.");
      });
    });

    // Đặt mật khẩu mới sau recovery
    $("recoveryForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = $("newPasswordInput").value;
      if (pw.length < 6) { setMsg("recoveryMsg", "Mật khẩu cần tối thiểu 6 ký tự."); return; }
      Account.updatePassword(pw).then(function () {
        setMsg("recoveryMsg", "Đã cập nhật mật khẩu mới.", true);
        $("recoveryBox").hidden = true;
      }).catch(function (err) {
        setMsg("recoveryMsg", err && err.message ? err.message : "Không đổi được mật khẩu.");
      });
    });

    // Xóa tài khoản
    $("deleteAccountBtn").addEventListener("click", function () {
      if (!window.confirm("Bạn chắc chắn muốn xóa vĩnh viễn tài khoản và toàn bộ dữ liệu đã lưu trên đám mây? Thao tác này không thể hoàn tác.")) return;
      setMsg("dangerMsg", "Đang xóa tài khoản…");
      Account.deleteAccount().then(function () {
        window.location.href = "index.html";
      }).catch(function (err) {
        setMsg("dangerMsg", err && err.message ? err.message : "Không xóa được tài khoản lúc này.");
      });
    });
  }

  init();
})();
