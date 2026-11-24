(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TimGiaTriAdminCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function conversionRate(everPaidUsers, totalUsers) {
    var total = Number(totalUsers) || 0;
    var paid = Number(everPaidUsers) || 0;
    if (total <= 0) return 0;
    return Math.round((paid / total) * 1000) / 10; // 1 chữ số thập phân
  }

  function completionRate(completed, total) {
    var t = Number(total) || 0;
    var c = Number(completed) || 0;
    if (t <= 0) return 0;
    return Math.round((c / t) * 1000) / 10;
  }

  /**
   * Chuẩn hóa ô CSV và chống CSV formula injection (=, +, -, @, tab, CR).
   */
  function csvCell(value) {
    var s = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(s)) {
      s = "'" + s;
    }
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /**
   * Tạo chuỗi CSV có UTF-8 BOM để mở tiếng Việt đẹp ngay trong Excel.
   */
  function buildCsv(headers, rows) {
    var lines = [];
    lines.push(headers.map(csvCell).join(","));
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      lines.push((Array.isArray(row) ? row : []).map(csvCell).join(","));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  function formatShortDate(isoDate) {
    if (typeof isoDate !== "string") return "";
    var parts = isoDate.slice(0, 10).split("-");
    if (parts.length !== 3) return isoDate;
    return parts[2] + "/" + parts[1];
  }

  function formatCompactVnd(amount) {
    var n = Number(amount) || 0;
    if (n >= 1000000) {
      return (Math.round((n / 1000000) * 10) / 10).toString().replace(".", ",") + "tr";
    }
    if (n >= 1000) {
      return Math.round(n / 1000) + "k";
    }
    return String(Math.round(n));
  }

  function summarizeSeries(series, key) {
    var arr = Array.isArray(series) ? series : [];
    var max = 0;
    var total = 0;
    arr.forEach(function (item) {
      var v = Number(item && item[key]) || 0;
      if (v > max) max = v;
      total += v;
    });
    return { max: max, total: total, count: arr.length };
  }

  var ACTION_LABELS = {
    grant_pro: "Cộng ngày Pro",
    revoke_pro: "Thu hồi Pro",
    mark_order_paid: "Duyệt đơn thủ công"
  };

  function actionLabel(action) {
    return ACTION_LABELS[action] || String(action || "");
  }

  return {
    conversionRate: conversionRate,
    completionRate: completionRate,
    csvCell: csvCell,
    buildCsv: buildCsv,
    formatShortDate: formatShortDate,
    formatCompactVnd: formatCompactVnd,
    summarizeSeries: summarizeSeries,
    actionLabel: actionLabel
  };
});
