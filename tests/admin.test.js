"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const AdminCore = require("../assets/js/admin-core.js");

describe("TimGiaTriAdminCore", () => {
  it("computes conversion and completion rates safely", () => {
    assert.equal(AdminCore.conversionRate(0, 0), 0);
    assert.equal(AdminCore.conversionRate(3, 20), 15);
    assert.equal(AdminCore.conversionRate(1, 3), 33.3);
    assert.equal(AdminCore.completionRate(7, 10), 70);
  });

  it("escapes CSV cells and neutralizes formula injection", () => {
    assert.equal(AdminCore.csvCell("hello"), "hello");
    assert.equal(AdminCore.csvCell('a, "b"'), '"a, ""b"""');
    assert.equal(AdminCore.csvCell("=CMD|' /C calc'!A0"), "'=CMD|' /C calc'!A0");
    assert.equal(AdminCore.csvCell("+1234"), "'+1234");
    assert.equal(AdminCore.csvCell("-1234"), "'-1234");
    assert.equal(AdminCore.csvCell("@SUM(A1:A2)"), "'@SUM(A1:A2)");

    const csv = AdminCore.buildCsv(["Tên", "Ghi chú"], [["Minh", "a, b"]]);
    assert.equal(csv.startsWith("\uFEFF"), true);
    assert.equal(csv.includes('"a, b"'), true);
  });

  it("formats short dates, compact VND, and summarizes chart series", () => {
    assert.equal(AdminCore.formatShortDate("2026-11-24"), "24/11");
    assert.equal(AdminCore.formatCompactVnd(790000), "790k");
    assert.equal(AdminCore.formatCompactVnd(2500000), "2,5tr");
    const sum = AdminCore.summarizeSeries(
      [{ revenue: 99000 }, { revenue: 790000 }, { revenue: 0 }],
      "revenue"
    );
    assert.deepEqual(sum, { max: 790000, total: 889000, count: 3 });
    assert.equal(AdminCore.actionLabel("grant_pro"), "Cộng ngày Pro");
  });
});
