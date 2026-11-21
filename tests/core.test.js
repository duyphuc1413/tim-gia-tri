"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../assets/js/data.js");

describe("TimGiaTriCore data integrity", () => {
  it("contains 48 unique core values and 18 unique anti-values", () => {
    assert.equal(Core.VALUES.length, 48);
    assert.equal(Core.uniqueStrings(Core.VALUES).length, 48);
    assert.equal(Core.ANTIS.length, 18);
    assert.equal(Core.uniqueStrings(Core.ANTIS).length, 18);
  });

  it("contains 5 verification questions, 6 experience prompts, and 8 wizard steps", () => {
    assert.equal(Core.VERIFY_QUESTIONS.length, 5);
    assert.equal(Core.EXPERIENCE_FIELDS.length, 6);
    assert.equal(Core.STEP_NAMES.length, 8);
  });
});

describe("normalizeText & cleanLabel", () => {
  it("normalizes Vietnamese accents and đ/Đ for accent-insensitive search", () => {
    assert.equal(Core.normalizeText("Tự do"), "tu do");
    assert.equal(Core.normalizeText("Độc lập"), "doc lap");
    assert.equal(Core.normalizeText("  Sức   khỏe  "), "suc khoe");
    assert.equal(Core.normalizeText("Gia đình"), Core.normalizeText("gia dinh"));
  });

  it("cleans, capitalizes, and truncates custom labels safely", () => {
    assert.equal(Core.cleanLabel("   sự   tử   tế  "), "Sự tử tế");
    assert.equal(Core.cleanLabel("   "), "");
    assert.equal(Core.cleanLabel("a".repeat(60)).length, Core.LIMITS.maxCustomLength);
  });
});

describe("buildShuffledPairs & computeRanking", () => {
  it("builds all unique unordered pairs with no self-pairs or duplicates", () => {
    const vals = ["A", "B", "C", "D", "E"];
    const pairs = Core.buildShuffledPairs(vals, () => 0.3);
    assert.equal(pairs.length, 10); // C(5,2) = 10
    const seen = new Set();
    for (const [x, y] of pairs) {
      assert.notEqual(x, y);
      const key = [x, y].sort().join("|");
      assert.equal(seen.has(key), false, "Duplicate pair found: " + key);
      seen.add(key);
    }
  });

  it("ranks by win count and uses direct head-to-head winner as tiebreaker", () => {
    const vals = ["Gia đình", "Tự do", "Sức khỏe", "Chính trực"];
    // Suppose Tự do and Gia đình both have 2 wins, and Tự do beat Gia đình directly
    const scores = { "Gia đình": 2, "Tự do": 2, "Sức khỏe": 1, "Chính trực": 1 };
    const history = [
      { pair: ["Gia đình", "Tự do"], winner: "Tự do" },
      { pair: ["Sức khỏe", "Chính trực"], winner: "Chính trực" }
    ];
    const ranking = Core.computeRanking(vals, scores, history);
    assert.deepEqual(ranking, ["Tự do", "Gia đình", "Chính trực", "Sức khỏe"]);
  });

  it("produces order-independent value signatures", () => {
    assert.equal(
      Core.valuesSignature(["Tự do", "Gia đình", "Sức khỏe"]),
      Core.valuesSignature(["Sức khỏe", "Tự do", "Gia đình"])
    );
    assert.notEqual(
      Core.valuesSignature(["Tự do", "Gia đình"]),
      Core.valuesSignature(["Tự do", "Sức khỏe"])
    );
  });
});

describe("sanitizeSavedState", () => {
  it("migrates v1 saved payloads cleanly and strips invalid fields", () => {
    const v1 = {
      version: 1,
      savedAt: "2026-10-01T10:00:00.000Z",
      step: 5,
      exps: { "exp-happy": "Đà Lạt cùng gia đình", "unknown-id": "ignored" },
      selected: ["Tự do", "Tự do", "", 123, "Gia đình", "Sức khỏe", "Tử tế riêng"],
      customValues: ["Tử tế riêng", "Tự do"],
      classify: { "Tự do": "song", "Gia đình": "invalid-class", "Sức khỏe": "khat-vong" },
      antis: ["Giả dối", "Giả dối"],
      pairs: [["Tự do", "Gia đình"], ["bad"]],
      pairIdx: 1,
      scores: { "Tự do": 1, "Gia đình": -5 },
      ranking: ["Tự do"],
      verify: { 0: true, 99: true, 1: "not-bool" },
      definitions: { "Tự do": { def: "Làm chủ thời gian", act: "Chặn 2h sáng" } }
    };

    const clean = Core.sanitizeSavedState(v1);
    assert.ok(clean);
    assert.equal(clean.version, 2);
    assert.equal(clean.step, 5);
    assert.equal(clean.maxStepReached, 5);
    assert.deepEqual(clean.exps, { "exp-happy": "Đà Lạt cùng gia đình" });
    assert.deepEqual(clean.selected, ["Tự do", "Gia đình", "Sức khỏe", "Tử tế riêng"]);
    assert.deepEqual(clean.customValues, ["Tử tế riêng"]);
    assert.deepEqual(clean.classify, { "Tự do": "song", "Sức khỏe": "khat-vong" });
    assert.deepEqual(clean.antis, ["Giả dối"]);
    assert.deepEqual(clean.pairs, [["Tự do", "Gia đình"]]);
    assert.equal(clean.pairIdx, 1);
    assert.deepEqual(clean.scores, { "Tự do": 1 });
    assert.deepEqual(clean.verify, { 0: true });
    assert.deepEqual(clean.definitions["Tự do"], { def: "Làm chủ thời gian", act: "Chặn 2h sáng" });
  });

  it("rejects corrupted or unsupported versions", () => {
    assert.equal(Core.sanitizeSavedState(null), null);
    assert.equal(Core.sanitizeSavedState({ version: 99, selected: [] }), null);
    assert.equal(Core.sanitizeSavedState({ version: 2, selected: "not-array" }), null);
  });
});

describe("buildSummaryText", () => {
  it("formats dated summary with rankings, definitions, actions, antis, and experiences", () => {
    const out = Core.buildSummaryText({
      ranking: ["Gia đình", "Tự do"],
      definitions: {
        "Gia đình": { def: "Có mặt trọn vẹn mỗi tối", act: "Không cầm điện thoại trong bữa cơm" }
      },
      aspirational: ["Sáng tạo"],
      antis: ["Giả dối"],
      experiences: [{ label: "Khoảnh khắc hạnh phúc", text: "Nấu ăn ở Đà Lạt" }],
      dateStr: "21/11/2026"
    });
    assert.match(out, /Ngày lập: 21\/11\/2026/);
    assert.match(out, /1\. GIA ĐÌNH/);
    assert.match(out, /Có mặt trọn vẹn mỗi tối/);
    assert.match(out, /Không cầm điện thoại trong bữa cơm/);
    assert.match(out, /GIÁ TRỊ KHÁT VỌNG/);
    assert.match(out, /Sáng tạo/);
    assert.match(out, /Giả dối/);
    assert.match(out, /Nấu ăn ở Đà Lạt/);
  });
});
