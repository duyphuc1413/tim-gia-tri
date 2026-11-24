(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TimGiaTriBilling = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TRIAL_DAYS = 3;

  var PLANS = {
    monthly: {
      id: "monthly",
      name: "Gói Tháng",
      price: 99000,
      periodLabel: "/ tháng",
      months: 1,
      note: "Thanh toán VietQR từng kỳ, không tự trừ tiền ngân hàng."
    },
    yearly: {
      id: "yearly",
      name: "Gói Năm",
      price: 790000,
      periodLabel: "/ năm",
      months: 12,
      note: "Tương đương ~66.000đ/tháng — phù hợp vòng lặp soi hằng tháng & làm lại hằng năm."
    }
  };

  var LIFE_DOMAINS = [
    { id: "career", label: "Sự nghiệp & Công việc" },
    { id: "family", label: "Gia đình & Quan hệ" },
    { id: "health", label: "Sức khỏe & Năng lượng" },
    { id: "finance", label: "Tài chính" },
    { id: "growth", label: "Học hỏi & Phát triển" },
    { id: "joy", label: "Giải trí & Niềm vui" },
    { id: "contribution", label: "Đóng góp & Cộng đồng" }
  ];

  function formatVnd(amount) {
    var n = Math.round(Number(amount) || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
  }

  function yearlySavingsPercent() {
    var full = PLANS.monthly.price * 12;
    if (full <= 0) return 0;
    return Math.floor(((full - PLANS.yearly.price) / full) * 100);
  }

  function normalizeVnPhoneClient(input) {
    if (typeof input !== "string" && typeof input !== "number") return null;
    var digits = String(input).replace(/[^\d+]/g, "");
    if (!digits) return null;
    if (digits.indexOf("+84") === 0) {
      digits = digits.slice(3);
    } else if (digits.indexOf("84") === 0 && digits.length === 11) {
      digits = digits.slice(2);
    } else if (digits.indexOf("0") === 0 && digits.length === 10) {
      digits = digits.slice(1);
    } else if (digits.indexOf("+") === 0) {
      return null;
    }
    if (!/^(3|5|7|8|9)\d{8}$/.test(digits)) return null;
    return "+84" + digits;
  }

  /**
   * Tính trạng thái quyền Pro từ hồ sơ `profiles`.
   * Trả về { status: 'anonymous'|'trial'|'paid'|'expired', isPro, daysLeft, expiresAt, label }.
   */
  function computeEntitlement(profile, now) {
    var current = now instanceof Date ? now : new Date();
    var nowMs = current.getTime();

    if (!profile || typeof profile !== "object") {
      return {
        status: "anonymous",
        isPro: false,
        daysLeft: 0,
        expiresAt: null,
        label: "Miễn phí (chưa đăng nhập)"
      };
    }

    var paidAt = profile.paid_until ? new Date(profile.paid_until) : null;
    var trialAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    var paidMs = paidAt && !isNaN(paidAt.getTime()) ? paidAt.getTime() : -Infinity;
    var trialMs = trialAt && !isNaN(trialAt.getTime()) ? trialAt.getTime() : -Infinity;

    if (paidMs > nowMs) {
      var paidDays = Math.max(1, Math.ceil((paidMs - nowMs) / 86400000));
      return {
        status: "paid",
        isPro: true,
        daysLeft: paidDays,
        expiresAt: paidAt,
        label: "Pro · còn " + paidDays + " ngày"
      };
    }

    if (trialMs > nowMs) {
      var trialDays = Math.max(1, Math.ceil((trialMs - nowMs) / 86400000));
      return {
        status: "trial",
        isPro: true,
        daysLeft: trialDays,
        expiresAt: trialAt,
        label: "Dùng thử · còn " + trialDays + " ngày"
      };
    }

    return {
      status: "expired",
      isPro: false,
      daysLeft: 0,
      expiresAt: paidMs > trialMs && paidAt ? paidAt : trialAt,
      label: "Miễn phí (đã hết hạn Pro)"
    };
  }

  function sanitizeGoals(raw) {
    if (!Array.isArray(raw)) return [];
    var domainIds = {};
    LIFE_DOMAINS.forEach(function (d) { domainIds[d.id] = true; });
    var out = [];
    raw.slice(0, 21).forEach(function (g) {
      if (!g || typeof g !== "object") return;
      var domain = typeof g.domain === "string" && domainIds[g.domain] ? g.domain : LIFE_DOMAINS[0].id;
      out.push({
        domain: domain,
        be: typeof g.be === "string" ? g.be.slice(0, 300) : "",
        doText: typeof g.doText === "string" ? g.doText.slice(0, 300) : "",
        have: typeof g.have === "string" ? g.have.slice(0, 300) : "",
        linkedValue: typeof g.linkedValue === "string" ? g.linkedValue.slice(0, 80) : "",
        reverseCheck: typeof g.reverseCheck === "string" ? g.reverseCheck.slice(0, 300) : ""
      });
    });
    return out;
  }

  return {
    TRIAL_DAYS: TRIAL_DAYS,
    PLANS: PLANS,
    LIFE_DOMAINS: LIFE_DOMAINS,
    formatVnd: formatVnd,
    yearlySavingsPercent: yearlySavingsPercent,
    normalizeVnPhoneClient: normalizeVnPhoneClient,
    computeEntitlement: computeEntitlement,
    sanitizeGoals: sanitizeGoals
  };
});
