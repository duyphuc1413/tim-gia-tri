"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const Core = require("../assets/js/data.js");
const Growth = require("../assets/js/growth-core.js");

describe("TimGiaTriGrowth: 2-person comparison & retention tools", () => {
  it("encodes and decodes Vietnamese comparison profiles losslessly", () => {
    const encoded = Growth.encodeCompareProfile({
      name: "Minh Anh",
      ranking: ["Gia đình", "Tự do", "Chính trực", "Sức khỏe", "Học hỏi"],
      antis: ["Giả dối", "Bị kiểm soát"]
    });
    assert.equal(typeof encoded, "string");
    assert.ok(encoded.length > 10);

    const decoded = Growth.decodeCompareProfile(encoded);
    assert.equal(decoded.name, "Minh Anh");
    assert.deepEqual(decoded.ranking, ["Gia đình", "Tự do", "Chính trực", "Sức khỏe", "Học hỏi"]);
    assert.deepEqual(decoded.antis, ["Giả dối", "Bị kiểm soát"]);

    assert.equal(Growth.decodeCompareProfile("not-valid-base64!!!"), null);
    assert.equal(Growth.decodeCompareProfile(""), null);
  });

  it("computes alignment score, shared values, tensions, and prompts for two profiles", () => {
    const res = Growth.compareTwoProfiles(
      { name: "An", ranking: ["Tự do", "Gia đình", "Chính trực", "Sức khỏe", "Sáng tạo"], antis: ["Giả dối"] },
      { name: "Bình", ranking: ["Gia đình", "An toàn", "Tự do", "Sức khỏe", "Bình an"], antis: ["Bị kiểm soát"] },
      Core.ANTI_MAP
    );

    assert.ok(res.alignmentScore >= 40 && res.alignmentScore <= 100);
    assert.equal(res.shared.length, 3);
    assert.equal(res.onlyA.length, 2);
    assert.equal(res.onlyB.length, 2);
    assert.ok(res.tensions.length >= 1);
    assert.equal(res.prompts.length, 3);
  });

  it("computes weekly check-in alignment percentage accurately", () => {
    const rank = ["Gia đình", "Tự do", "Chính trực", "Sức khỏe", "Học hỏi"];
    assert.equal(
      Growth.computeCheckinScore({ "Gia đình": 5, "Tự do": 5, "Chính trực": 5, "Sức khỏe": 5, "Học hỏi": 5 }, rank),
      100
    );
    assert.equal(
      Growth.computeCheckinScore({ "Gia đình": 3, "Tự do": 3, "Chính trực": 3, "Sức khỏe": 3, "Học hỏi": 3 }, rank),
      60
    );
  });

  it("ranks decision options using Top 5 weights (#1=5..#5=1)", () => {
    const rank = ["Tự do", "Gia đình", "Sức khỏe"];
    const ranked = Growth.scoreDecisionOptions(
      [
        { name: "Ở lại công ty cũ", scores: { "Tự do": 2, "Gia đình": 3, "Sức khỏe": 3 } },
        { name: "Chuyển sang remote", scores: { "Tự do": 5, "Gia đình": 5, "Sức khỏe": 4 } }
      ],
      rank
    );
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].name, "Chuyển sang remote");
    assert.ok(ranked[0].pct > ranked[1].pct);
  });

  it("preserves sanitized checkins, decision, and aiReport inside sanitizeSavedState", () => {
    const clean = Core.sanitizeSavedState({
      version: 2,
      selected: ["Gia đình", "Tự do"],
      extras: {
        checkins: [{ date: "2026-11-24T00:00:00Z", scores: { "Gia đình": 5 }, note: "Tuần tốt", pct: 100 }],
        decision: { question: "Đổi việc?", options: [{ name: "Có", scores: { "Tự do": 5 } }] },
        aiReport: { mode: "gemini", headline: "Trục định vị", sections: [{ title: "1. Bản sắc", body: "Chi tiết" }] }
      }
    });
    assert.equal(clean.extras.checkins.length, 1);
    assert.equal(clean.extras.checkins[0].pct, 100);
    assert.equal(clean.extras.decision.question, "Đổi việc?");
    assert.equal(clean.extras.aiReport.sections.length, 1);
  });
});
