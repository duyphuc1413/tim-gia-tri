(function () {
  "use strict";

  var THEME_KEY = "tim-gia-tri-theme";
  var $ = function (id) { return document.getElementById(id); };
  var Billing = window.TimGiaTriBilling;
  var AdminCore = window.TimGiaTriAdminCore;

  var currentSection = "overview";
  var cachedUsers = [];
  var cachedOrders = [];
  var activeModalUser = null;
  var searchTimer = null;

  var SECTION_TITLES = {
    overview: "Tổng quan",
    users: "Quản lý người dùng",
    orders: "Đơn hàng & Doanh thu",
    audit: "Nhật ký quản trị",
    system: "Trạng thái hệ thống"
  };

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

  function svgEl(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, String(attrs[k]));
      });
    }
    return node;
  }

  /* ---------- Theme toggle ---------- */
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

  function showToast(msg, isErr) {
    var t = $("adminToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle("err", !!isErr);
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, 4500);
  }

  function formatDateVi(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatDateTimeVi(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function downloadCsv(filename, content) {
    var blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function rpc(fnName, params) {
    var sb = window.TGTAccount && window.TGTAccount.getClient();
    if (!sb) return Promise.reject(new Error("Chưa kết nối Supabase."));
    return sb.rpc(fnName, params || {}).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  /* ---------- SVG Bar Chart (30 ngày) ---------- */
  function renderBarChart(container, series, key, opts) {
    container.textContent = "";
    var data = Array.isArray(series) ? series : [];
    var summary = AdminCore.summarizeSeries(data, key);
    var w = 520;
    var h = 170;
    var padTop = 14;
    var padBottom = 24;
    var padLeft = 42;
    var padRight = 8;
    var plotW = w - padLeft - padRight;
    var plotH = h - padTop - padBottom;
    var maxVal = summary.max > 0 ? summary.max : 1;

    var svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": opts.ariaLabel });

    [0, 0.5, 1].forEach(function (ratio) {
      var y = padTop + plotH * (1 - ratio);
      svg.appendChild(svgEl("line", { x1: padLeft, y1: y, x2: w - padRight, y2: y, class: "chart-grid-line" }));
      var lbl = svgEl("text", { x: padLeft - 6, y: y + 3, "text-anchor": "end", class: "chart-axis-text" });
      var val = Math.round(maxVal * ratio);
      lbl.textContent = opts.currency ? AdminCore.formatCompactVnd(val) : String(val);
      svg.appendChild(lbl);
    });

    var step = data.length ? plotW / data.length : plotW;
    var barW = Math.max(4, step - 4);

    data.forEach(function (item, i) {
      var v = Number(item[key]) || 0;
      var bh = v > 0 ? Math.max(3, (v / maxVal) * plotH) : 1;
      var x = padLeft + i * step + 2;
      var y = padTop + plotH - bh;
      var rect = svgEl("rect", {
        x: x.toFixed(1),
        y: y.toFixed(1),
        width: barW.toFixed(1),
        height: bh.toFixed(1),
        rx: 1.5,
        class: opts.secondary ? "chart-bar secondary" : "chart-bar"
      });
      var tip = svgEl("title");
      tip.textContent =
        AdminCore.formatShortDate(item.date) + ": " +
        (opts.currency ? Billing.formatVnd(v) : v + " người");
      rect.appendChild(tip);
      svg.appendChild(rect);

      if (i === 0 || i === 14 || i === data.length - 1) {
        var tx = svgEl("text", { x: (x + barW / 2).toFixed(1), y: h - 6, "text-anchor": "middle", class: "chart-axis-text" });
        tx.textContent = AdminCore.formatShortDate(item.date);
        svg.appendChild(tx);
      }
    });

    container.appendChild(svg);
  }

  /* ---------- Load Overview ---------- */
  function loadOverview() {
    return Promise.all([
      rpc("admin_dashboard_stats"),
      rpc("admin_list_orders", { p_status: "all", p_search: "", p_limit: 6, p_offset: 0 }),
      rpc("admin_list_audit_logs", { p_limit: 6 })
    ]).then(function (res) {
      var stats = res[0] || {};
      var orders = (res[1] && res[1].items) || [];
      var logs = Array.isArray(res[2]) ? res[2] : [];

      var conv = AdminCore.conversionRate(stats.ever_paid_users, stats.total_users);
      var comp = AdminCore.completionRate(stats.completed_journeys, stats.total_journeys);

      var kpis = [
        {
          accent: true,
          label: "Doanh thu tổng",
          value: Billing.formatVnd(stats.total_revenue_vnd || 0),
          sub: "30 ngày qua: " + Billing.formatVnd(stats.revenue_30d_vnd || 0) + " (" + (stats.paid_orders_count || 0) + " đơn)"
        },
        {
          label: "Tổng người dùng",
          value: String(stats.total_users || 0),
          sub: "+" + (stats.new_users_7d || 0) + " tuần này · +" + (stats.new_users_30d || 0) + " trong 30 ngày"
        },
        {
          accent: true,
          label: "Đang dùng Pro trả phí",
          value: String(stats.active_paid_users || 0),
          sub: "Chuyển đổi trả phí: " + conv + "%"
        },
        {
          label: "Đang dùng thử (3 ngày)",
          value: String(stats.active_trial_users || 0),
          sub: "Đã hết hạn: " + (stats.expired_users || 0) + " tài khoản"
        },
        {
          label: "Đơn chờ thanh toán",
          value: String(stats.pending_orders_count || 0),
          sub: "Có thể duyệt tay nếu khách chuyển khoản nhầm nội dung"
        },
        {
          label: "Hành trình đám mây",
          value: String(stats.total_journeys || 0),
          sub: "Hoàn thành Bước 8: " + (stats.completed_journeys || 0) + " (" + comp + "%)"
        }
      ];

      var grid = $("kpiGrid");
      grid.textContent = "";
      kpis.forEach(function (k) {
        var card = el("div", { className: k.accent ? "kpi-card accent" : "kpi-card" });
        card.appendChild(el("div", { className: "kpi-label" }, k.label));
        card.appendChild(el("div", { className: "kpi-value" }, k.value));
        card.appendChild(el("div", { className: "kpi-sub" }, k.sub));
        grid.appendChild(card);
      });

      var series = Array.isArray(stats.series_30d) ? stats.series_30d : [];
      var revSum = AdminCore.summarizeSeries(series, "revenue");
      var sigSum = AdminCore.summarizeSeries(series, "signups");
      $("revChartSub").textContent = "Tổng 30 ngày: " + Billing.formatVnd(revSum.total);
      $("signupChartSub").textContent = "Tổng 30 ngày: " + sigSum.total + " tài khoản mới";

      renderBarChart($("revChart"), series, "revenue", { ariaLabel: "Biểu đồ doanh thu 30 ngày", currency: true });
      renderBarChart($("signupChart"), series, "signups", { ariaLabel: "Biểu đồ người đăng ký 30 ngày", secondary: true });

      // Đơn gần đây
      var ordBox = $("recentOrdersBox");
      ordBox.textContent = "";
      if (!orders.length) {
        ordBox.appendChild(el("p", { className: "empty-note" }, "Chưa có đơn hàng nào."));
      } else {
        orders.forEach(function (o) {
          var row = el("div", { className: "mini-row" });
          var left = el("div");
          left.appendChild(el("strong", null, (o.email || o.phone || "Người dùng") + " · " + (o.plan === "yearly" ? "Gói Năm" : "Gói Tháng")));
          left.appendChild(el("small", null, "#" + o.order_code + " · " + formatDateTimeVi(o.paid_at || o.created_at)));
          row.appendChild(left);
          row.appendChild(el("span", { className: "badge badge-" + o.status }, Billing.formatVnd(o.amount)));
          ordBox.appendChild(row);
        });
      }

      // Nhật ký gần đây
      var audBox = $("recentAuditBox");
      audBox.textContent = "";
      if (!logs.length) {
        audBox.appendChild(el("p", { className: "empty-note" }, "Chưa có thao tác quản trị nào."));
      } else {
        logs.forEach(function (l) {
          var row = el("div", { className: "mini-row" });
          var left = el("div");
          left.appendChild(el("strong", null, AdminCore.actionLabel(l.action) + " · " + l.target_id.slice(0, 12)));
          left.appendChild(el("small", null, (l.admin_email || "Admin") + " · " + formatDateTimeVi(l.created_at)));
          row.appendChild(left);
          row.appendChild(el("small", null, (l.details && l.details.note) || ""));
          audBox.appendChild(row);
        });
      }

      // Phễu chuyển đổi (30 ngày)
      var funnelBox = $("funnelStatsBox");
      if (funnelBox) {
        rpc("admin_funnel_stats", { p_days: 30 }).then(function (fData) {
          funnelBox.textContent = "";
          var evts = (fData && Array.isArray(fData.events)) ? fData.events : [];
          if (!evts.length) {
            funnelBox.appendChild(el("p", { className: "empty-note" }, "Chưa có dữ liệu phễu trong 30 ngày qua."));
            return;
          }
          var labels = {
            page_view: "Lượt xem trang",
            step_1_start: "Bắt đầu Bước 1",
            step_3_filter: "Đến Bước 3 (Lọc)",
            step_5_rank: "Đến Bước 5 (Xếp hạng)",
            step_8_result: "Hoàn thành Bản đồ (Bước 8)",
            share_card_download: "Tải ảnh chia sẻ",
            compare_invite_copy: "Tạo link so sánh 2 người",
            compare_view: "Xem Bản đồ giao thoa",
            ai_report_generate: "Tạo luận giải AI",
            pro_cta_click: "Bấm CTA nâng cấp Pro",
            checkout_start: "Khởi tạo thanh toán VietQR",
            workshop_lead_submit: "Gửi yêu cầu Workshop"
          };
          evts.forEach(function (ev) {
            var row = el("div", { className: "mini-row" });
            var left = el("div");
            left.appendChild(el("strong", null, labels[ev.event_name] || ev.event_name));
            left.appendChild(el("small", null, ev.total_events + " lượt sự kiện"));
            row.appendChild(left);
            row.appendChild(el("span", { className: "badge" }, ev.unique_sessions + " phiên"));
            funnelBox.appendChild(row);
          });
        }).catch(function () {});
      }

      // Danh sách yêu cầu Workshop / Team
      var leadsBox = $("workshopLeadsBox");
      if (leadsBox) {
        rpc("admin_list_workshop_leads", { p_limit: 10 }).then(function (leads) {
          leadsBox.textContent = "";
          var items = Array.isArray(leads) ? leads : [];
          if (!items.length) {
            leadsBox.appendChild(el("p", { className: "empty-note" }, "Chưa có yêu cầu tư vấn Workshop nào."));
            return;
          }
          items.forEach(function (ld) {
            var row = el("div", { className: "mini-row" });
            var left = el("div");
            left.appendChild(el("strong", null, ld.full_name + (ld.organization ? " · " + ld.organization : "")));
            left.appendChild(el("small", null, ld.email + " · " + (ld.team_size || "") + " · " + formatDateTimeVi(ld.created_at)));
            row.appendChild(left);
            row.appendChild(el("span", { className: "badge" }, ld.status || "new"));
            leadsBox.appendChild(row);
          });
        }).catch(function () {});
      }
    });
  }

  /* ---------- Load Users ---------- */
  function loadUsers() {
    var q = $("userSearch").value.trim();
    var st = $("userStatusFilter").value;
    return rpc("admin_list_users", { p_search: q, p_status: st, p_limit: 100, p_offset: 0 }).then(function (data) {
      var items = (data && data.items) || [];
      cachedUsers = items;
      $("usersSummary").textContent = "Hiển thị " + items.length + " / " + (data ? data.total : 0) + " tài khoản.";

      var tbody = $("usersTbody");
      tbody.textContent = "";
      if (!items.length) {
        var tr = el("tr");
        var td = el("td", { colspan: "6" }, "Không tìm thấy người dùng phù hợp.");
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      var statusText = { paid: "Pro", trial: "Dùng thử", expired: "Hết hạn" };

      items.forEach(function (u) {
        var tr = el("tr");

        var tdUser = el("td");
        var nameSpan = el("span", { className: "cell-primary" }, u.display_name || u.email || u.phone || "Chưa đặt tên");
        if (u.role === "admin") {
          nameSpan.appendChild(el("span", { className: "badge badge-admin" }, "ADMIN"));
        }
        tdUser.appendChild(nameSpan);
        tdUser.appendChild(el("span", { className: "cell-sub" }, u.email || u.phone || u.id));
        tr.appendChild(tdUser);

        var tdPlan = el("td");
        tdPlan.appendChild(el("span", { className: "badge badge-" + u.sub_status }, statusText[u.sub_status] || u.sub_status));
        var exp = u.sub_status === "paid" ? u.paid_until : u.trial_ends_at;
        tdPlan.appendChild(el("span", { className: "cell-sub" }, "Đến " + formatDateVi(exp)));
        tr.appendChild(tdPlan);

        tr.appendChild(el("td", null, String(u.journeys_count || 0)));
        tr.appendChild(el("td", null, Billing.formatVnd(u.total_spent || 0)));
        tr.appendChild(el("td", null, formatDateVi(u.created_at)));

        var tdAct = el("td", { className: "col-right" });
        var btn = el("button", { type: "button", className: "btn btn-ghost btn-small" }, "Quản lý gói");
        btn.addEventListener("click", function () { openUserModal(u); });
        tdAct.appendChild(btn);
        tr.appendChild(tdAct);

        tbody.appendChild(tr);
      });
    });
  }

  /* ---------- Load Orders ---------- */
  function loadOrders() {
    var q = $("orderSearch").value.trim();
    var st = $("orderStatusFilter").value;
    return rpc("admin_list_orders", { p_status: st, p_search: q, p_limit: 100, p_offset: 0 }).then(function (data) {
      var items = (data && data.items) || [];
      cachedOrders = items;
      $("ordersSummary").textContent = "Hiển thị " + items.length + " / " + (data ? data.total : 0) + " đơn hàng.";

      var tbody = $("ordersTbody");
      tbody.textContent = "";
      if (!items.length) {
        var tr = el("tr");
        tr.appendChild(el("td", { colspan: "7" }, "Chưa có đơn hàng nào khớp bộ lọc."));
        tbody.appendChild(tr);
        return;
      }

      var statusLabels = { paid: "Đã thanh toán", pending: "Chờ thanh toán", cancelled: "Đã hủy", expired: "Hết hạn" };

      items.forEach(function (o) {
        var tr = el("tr");
        tr.appendChild(el("td", null, "#" + o.order_code));

        var tdCust = el("td");
        tdCust.appendChild(el("span", { className: "cell-primary" }, o.display_name || o.email || o.phone || "—"));
        tdCust.appendChild(el("span", { className: "cell-sub" }, o.email || o.phone || ""));
        tr.appendChild(tdCust);

        tr.appendChild(el("td", null, o.plan === "yearly" ? "Gói Năm" : "Gói Tháng"));
        tr.appendChild(el("td", null, Billing.formatVnd(o.amount)));

        var tdSt = el("td");
        tdSt.appendChild(el("span", { className: "badge badge-" + o.status }, statusLabels[o.status] || o.status));
        tr.appendChild(tdSt);

        tr.appendChild(el("td", null, formatDateTimeVi(o.paid_at || o.created_at)));

        var tdAct = el("td", { className: "col-right" });
        if (o.status === "pending") {
          var appBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Duyệt đã TT");
          appBtn.addEventListener("click", function () {
            var note = window.prompt("Ghi chú xác nhận duyệt đơn #" + o.order_code + " (ví dụ: đã nhận chuyển khoản Vietcombank):", "Đã kiểm tra sao kê ngân hàng");
            if (note === null) return;
            appBtn.disabled = true;
            rpc("admin_mark_order_paid", { p_order_code: o.order_code, p_note: note }).then(function () {
              showToast("Đã duyệt đơn #" + o.order_code + " và cộng hạn Pro cho khách hàng.");
              loadOrders();
            }).catch(function (err) {
              appBtn.disabled = false;
              showToast(err && err.message ? err.message : "Không duyệt được đơn.", true);
            });
          });
          tdAct.appendChild(appBtn);
        } else {
          tdAct.appendChild(el("span", { className: "cell-sub" }, "—"));
        }
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
    });
  }

  /* ---------- Load Audit Logs ---------- */
  function loadAuditLogs() {
    return rpc("admin_list_audit_logs", { p_limit: 80 }).then(function (logs) {
      var list = Array.isArray(logs) ? logs : [];
      var tbody = $("auditTbody");
      tbody.textContent = "";
      if (!list.length) {
        var tr = el("tr");
        tr.appendChild(el("td", { colspan: "5" }, "Chưa có nhật ký quản trị nào."));
        tbody.appendChild(tr);
        return;
      }
      list.forEach(function (l) {
        var tr = el("tr");
        tr.appendChild(el("td", null, formatDateTimeVi(l.created_at)));
        tr.appendChild(el("td", null, l.admin_email || l.admin_name || "Admin"));
        tr.appendChild(el("td", null, AdminCore.actionLabel(l.action)));
        tr.appendChild(el("td", null, l.target_type + ": " + l.target_id));
        var detailStr = "";
        if (l.details) {
          var parts = [];
          if (l.details.days) parts.push("+" + l.details.days + " ngày");
          if (l.details.note) parts.push(l.details.note);
          detailStr = parts.join(" · ");
        }
        tr.appendChild(el("td", null, detailStr || "—"));
        tbody.appendChild(tr);
      });
    });
  }

  /* ---------- Load System Health ---------- */
  function loadSystemHealth() {
    return rpc("admin_system_health").then(function (h) {
      var cfg = window.TGT_CONFIG || {};
      var grid = $("systemGrid");
      grid.textContent = "";

      var cards = [
        {
          accent: true,
          label: "Supabase Project",
          value: "Đang kết nối",
          sub: (cfg.supabaseUrl || "").replace(/^https?:\/\//, "")
        },
        {
          label: "Quản trị viên",
          value: String((h && h.admins_count) || 1) + " tài khoản",
          sub: "Kiểm tra lúc " + formatDateTimeVi(h && h.checked_at)
        },
        {
          label: "Zalo ZNS Token",
          value: h && h.zalo_configured ? (h.zalo_token_valid ? "Còn hạn" : "Cần làm mới") : "Chưa nạp",
          sub: h && h.zalo_expires_at ? "Hết hạn: " + formatDateTimeVi(h.zalo_expires_at) : "Nạp dòng đầu tiên vào public.zalo_tokens khi bật OTP Zalo"
        }
      ];

      cards.forEach(function (c) {
        var card = el("div", { className: c.accent ? "kpi-card accent" : "kpi-card" });
        card.appendChild(el("div", { className: "kpi-label" }, c.label));
        card.appendChild(el("div", { className: "kpi-value" }, c.value));
        card.appendChild(el("div", { className: "kpi-sub" }, c.sub));
        grid.appendChild(card);
      });
    });
  }

  /* ---------- Modal ---------- */
  function openUserModal(u) {
    activeModalUser = u;
    $("modalTitle").textContent = "Quản lý gói: " + (u.display_name || u.email || u.phone || "Người dùng");
    $("modalUserInfo").textContent =
      (u.email || u.phone || u.id) + " · Trạng thái hiện tại: " + u.sub_status.toUpperCase() +
      (u.paid_until ? " · Pro đến " + formatDateVi(u.paid_until) : "");
    $("grantDaysInput").value = "30";
    $("grantNoteInput").value = "";
    $("modalMsg").textContent = "";
    $("userModal").hidden = false;
  }

  function closeUserModal() {
    $("userModal").hidden = true;
    activeModalUser = null;
  }

  /* ---------- Navigation ---------- */
  function switchSection(sec) {
    currentSection = sec;
    $("sectionTitle").textContent = SECTION_TITLES[sec] || "Quản trị";
    document.querySelectorAll(".admin-nav-btn").forEach(function (b) {
      var active = b.getAttribute("data-section") === sec;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".admin-section").forEach(function (p) {
      var match = p.getAttribute("data-panel") === sec;
      p.classList.toggle("active", match);
      p.hidden = !match;
    });
    refreshActiveSection();
  }

  function refreshActiveSection() {
    var p;
    if (currentSection === "overview") p = loadOverview();
    else if (currentSection === "users") p = loadUsers();
    else if (currentSection === "orders") p = loadOrders();
    else if (currentSection === "audit") p = loadAuditLogs();
    else p = loadSystemHealth();

    p.catch(function (err) {
      showToast(err && err.message ? err.message : "Không tải được dữ liệu quản trị.", true);
    });
  }

  function initBindings() {
    document.querySelectorAll(".admin-nav-btn").forEach(function (b) {
      b.addEventListener("click", function () { switchSection(b.getAttribute("data-section")); });
    });
    document.querySelectorAll("[data-jump]").forEach(function (b) {
      b.addEventListener("click", function () { switchSection(b.getAttribute("data-jump")); });
    });
    $("refreshBtn").addEventListener("click", function () {
      refreshActiveSection();
      showToast("Đã làm mới dữ liệu.");
    });
    $("adminSignOutBtn").addEventListener("click", function () {
      window.TGTAccount.signOut().then(function () { window.location.href = "account.html"; });
    });

    function debounced(fn) {
      return function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(fn, 260);
      };
    }

    $("userSearch").addEventListener("input", debounced(loadUsers));
    $("userStatusFilter").addEventListener("change", loadUsers);
    $("orderSearch").addEventListener("input", debounced(loadOrders));
    $("orderStatusFilter").addEventListener("change", loadOrders);

    $("exportUsersCsvBtn").addEventListener("click", function () {
      var headers = ["ID", "Tên hiển thị", "Email", "SĐT", "Vai trò", "Trạng thái", "Hết hạn dùng thử", "Pro đến", "Số hành trình", "Tổng chi tiêu (VND)", "Ngày tạo"];
      var rows = cachedUsers.map(function (u) {
        return [u.id, u.display_name, u.email, u.phone, u.role, u.sub_status, u.trial_ends_at, u.paid_until, u.journeys_count, u.total_spent, u.created_at];
      });
      downloadCsv("tim-gia-tri-users.csv", AdminCore.buildCsv(headers, rows));
    });

    $("exportOrdersCsvBtn").addEventListener("click", function () {
      var headers = ["Mã đơn", "Email", "SĐT", "Gói", "Số tiền (VND)", "Trạng thái", "Ngày tạo", "Ngày thanh toán"];
      var rows = cachedOrders.map(function (o) {
        return [o.order_code, o.email, o.phone, o.plan, o.amount, o.status, o.created_at, o.paid_at];
      });
      downloadCsv("tim-gia-tri-orders.csv", AdminCore.buildCsv(headers, rows));
    });

    // Modal bindings
    document.querySelectorAll("[data-close-modal]").forEach(function (x) {
      x.addEventListener("click", closeUserModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("userModal").hidden) closeUserModal();
    });
    document.querySelectorAll("[data-preset-days]").forEach(function (b) {
      b.addEventListener("click", function () {
        $("grantDaysInput").value = b.getAttribute("data-preset-days");
      });
    });

    $("grantProForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!activeModalUser) return;
      var days = parseInt($("grantDaysInput").value, 10);
      var note = $("grantNoteInput").value.trim();
      $("modalMsg").textContent = "Đang cập nhật…";
      rpc("admin_grant_pro", { p_target_user_id: activeModalUser.id, p_days: days, p_note: note }).then(function () {
        closeUserModal();
        showToast("Đã cộng +" + days + " ngày Pro thành công.");
        loadUsers();
      }).catch(function (err) {
        $("modalMsg").textContent = err && err.message ? err.message : "Không cập nhật được.";
      });
    });

    $("revokeProBtn").addEventListener("click", function () {
      if (!activeModalUser) return;
      if (!window.confirm("Thu hồi gói Pro của tài khoản này ngay lập tức?")) return;
      var note = $("grantNoteInput").value.trim();
      rpc("admin_revoke_pro", { p_target_user_id: activeModalUser.id, p_note: note }).then(function () {
        closeUserModal();
        showToast("Đã thu hồi gói Pro.");
        loadUsers();
      }).catch(function (err) {
        $("modalMsg").textContent = err && err.message ? err.message : "Không thu hồi được.";
      });
    });
  }

  /* ---------- Gate check ---------- */
  function checkGate() {
    var Account = window.TGTAccount;
    if (!Account || !Account.isConfigured()) {
      $("gateTitle").textContent = "Chưa cấu hình máy chủ Supabase";
      $("gateDesc").textContent = "Hãy điền supabaseUrl và supabaseAnonKey trong assets/js/config.js trước khi mở trang quản trị.";
      return;
    }

    Account.ready().then(function (accState) {
      if (!accState.user) {
        $("gateTitle").textContent = "Yêu cầu đăng nhập quản trị";
        $("gateDesc").textContent = "Bạn cần đăng nhập bằng tài khoản có quyền admin để truy cập bảng điều khiển.";
        $("gateLoginBtn").hidden = false;
        return;
      }

      if (!Account.isAdmin()) {
        $("gateTitle").textContent = "Tài khoản chưa có quyền quản trị";
        $("gateDesc").textContent = "Bạn đang đăng nhập với " + (accState.user.email || accState.user.phone || "tài khoản thường") + ", nhưng tài khoản này chưa được cấp quyền admin.";
        if (accState.user.email) {
          $("gateSqlCode").textContent = "update public.profiles set role = 'admin' where email = '" + accState.user.email + "';";
        }
        $("gateSqlHint").hidden = false;
        $("gateRetryBtn").hidden = false;
        return;
      }

      $("adminGate").hidden = true;
      $("adminShell").hidden = false;
      $("adminIdentity").textContent = "Đăng nhập: " + (accState.user.email || accState.user.phone || "Admin");
      switchSection("overview");
    });
  }

  $("gateRetryBtn").addEventListener("click", function () {
    window.TGTAccount.refreshProfile().then(checkGate);
  });

  initBindings();
  checkGate();
})();
