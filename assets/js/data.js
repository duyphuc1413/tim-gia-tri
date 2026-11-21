(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TimGiaTriCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VALUES = [
    "Tự do", "Gia đình", "Sức khỏe", "Trung thực", "Chính trực", "Chân thành",
    "Sáng tạo", "Học hỏi", "Bình an", "Yêu thương", "Tôn trọng", "Công bằng",
    "Trách nhiệm", "Dũng cảm", "Kiên nhẫn", "Biết ơn", "Hài hước", "Phiêu lưu",
    "An toàn", "Thành tựu", "Cống hiến", "Cộng đồng", "Độc lập", "Lòng trắc ẩn",
    "Xuất sắc", "Giản dị", "Kết nối", "Tự chủ", "Trưởng thành", "Niềm vui",
    "Sâu sắc", "Tha thứ", "Tò mò", "Kỷ luật", "Linh hoạt", "Tin cậy",
    "Hào phóng", "Đam mê", "Cân bằng", "Trí tuệ", "Ảnh hưởng", "Tự tin",
    "Khiêm tốn", "Tử tế", "Minh bạch", "Thẳng thắn", "Gắn kết", "Khám phá"
  ];

  var ANTIS = [
    "Bị kiểm soát", "Bất công", "Giả dối", "Bị phản bội", "Nhàm chán",
    "Bị coi thường", "Hỗn loạn", "Bị bỏ rơi", "Phải tuân thủ mù quáng",
    "Bị phán xét", "Cô lập", "Bất lực", "Lãng phí thời gian", "Bị lợi dụng",
    "Thiển cận", "Bị ép buộc", "Thiếu tôn trọng", "Bị lãng quên"
  ];

  var CLASS_OPTIONS = [
    { key: "song", label: "✓ Đã sống — có bằng chứng" },
    { key: "khat-vong", label: "Khát vọng — muốn có, chưa sống" },
    { key: "nen-co", label: "“Nên có” — được dạy phải thế" }
  ];

  var VERIFY_QUESTIONS = [
    {
      q: "Những giá trị này có khiến bạn thấy tốt về bản thân không?",
      s: "Danh sách đúng thường đi kèm cảm giác nhẹ nhõm, “đúng là mình”.",
      hintStep: 3,
      hintLabel: "Xem lại Bước 3 (Lọc giá trị thật)"
    },
    {
      q: "Bạn có tự hào về top 3 của mình không?",
      s: "Nếu phải giấu top 3 đi, có thể chúng chưa phải giá trị thật — hoặc bạn đang sợ ánh nhìn của người khác hơn là sợ sống sai mình.",
      hintStep: 5,
      hintLabel: "So lại thứ tự ở Bước 5"
    },
    {
      q: "Bạn có thoải mái kể chúng cho một người bạn tôn trọng không?",
      s: "Không cần kể cho cả thế giới — chỉ cần không thấy xấu hổ khi nói ra trước người mình nể.",
      hintStep: 3,
      hintLabel: "Kiểm tra lại phân loại ở Bước 3"
    },
    {
      q: "Bạn có giữ chúng ngay cả khi mình là thiểu số không?",
      s: "Giá trị thật là thứ bạn vẫn giữ khi nó làm bạn khác biệt, thậm chí tốn kém.",
      hintStep: 3,
      hintLabel: "Tách giá trị “nên có” ở Bước 3"
    },
    {
      q: "Đọc lại danh sách, bạn có thấy hào hứng không?",
      s: "Nếu cảm giác là “nhạt”, phẳng lặng — đó là dấu hiệu nên quay lại bước 1 và 3.",
      hintStep: 1,
      hintLabel: "Viết cụ thể hơn ở Bước 1"
    }
  ];

  var EXPERIENCE_FIELDS = [
    { id: "exp-happy", label: "Khoảnh khắc hạnh phúc / tự hào nhất" },
    { id: "exp-regret", label: "Điều hối tiếc nhất" },
    { id: "exp-empty", label: "Lúc thất vọng / trống rỗng nhất" },
    { id: "exp-flow", label: "Hoạt động quên thời gian" },
    { id: "exp-admire", label: "Người tôi ngưỡng mộ" },
    { id: "exp-help", label: "Việc người khác hay nhờ tôi" }
  ];

  var STEP_NAMES = [
    "Trải nghiệm",
    "Đặt tên",
    "Lọc giá trị thật",
    "Không chịu nổi",
    "Xếp hạng",
    "Kiểm chứng",
    "Viết & hành động",
    "Bản đồ của bạn"
  ];

  var LIMITS = {
    minExpChars: 10,
    minFilledExps: 3,
    minSelected: 5,
    maxSelected: 15,
    minLived: 3,
    maxLived: 8,
    minDefChars: 5,
    topDefineCount: 5,
    maxCustomLength: 40
  };

  /**
   * Normalize Vietnamese text for accent-insensitive search and comparison.
   */
  function normalizeText(str) {
    if (typeof str !== "string") return "";
    return str
      .trim()
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * Clean and normalize a user-entered value label.
   */
  function cleanLabel(str) {
    if (typeof str !== "string") return "";
    var trimmed = str.trim().replace(/\s+/g, " ");
    if (!trimmed) return "";
    if (trimmed.length > LIMITS.maxCustomLength) {
      trimmed = trimmed.slice(0, LIMITS.maxCustomLength).trim();
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  /**
   * Deterministic signature of a value list (order-independent) to detect
   * whether lived values changed and invalidated pairwise comparisons.
   */
  function valuesSignature(list) {
    if (!Array.isArray(list)) return "";
    return list.slice().sort().join("\u001f");
  }

  /**
   * Build all unique pairs with Fisher-Yates shuffle and randomized left/right
   * sides to minimize anchoring and position bias.
   */
  function buildShuffledPairs(values, rng) {
    var rand = typeof rng === "function" ? rng : Math.random;
    var pairs = [];
    for (var i = 0; i < values.length; i++) {
      for (var j = i + 1; j < values.length; j++) {
        if (rand() < 0.5) {
          pairs.push([values[i], values[j]]);
        } else {
          pairs.push([values[j], values[i]]);
        }
      }
    }
    for (var k = pairs.length - 1; k > 0; k--) {
      var swapIdx = Math.floor(rand() * (k + 1));
      var tmp = pairs[k];
      pairs[k] = pairs[swapIdx];
      pairs[swapIdx] = tmp;
    }
    return pairs;
  }

  /**
   * Compute pairwise ranking from wins map and optional head-to-head history.
   * Uses Copeland win count first, direct head-to-head winner as tiebreaker,
   * then original selection order for cyclic ties.
   */
  function computeRanking(values, scores, history) {
    var headToHead = {};
    if (Array.isArray(history)) {
      history.forEach(function (entry) {
        if (!entry || !Array.isArray(entry.pair) || entry.pair.length !== 2) return;
        var a = entry.pair[0];
        var b = entry.pair[1];
        if (entry.winner === a) headToHead[a + "\u001f" + b] = 1;
        else if (entry.winner === b) headToHead[b + "\u001f" + a] = 1;
      });
    }

    var orderMap = {};
    values.forEach(function (v, idx) { orderMap[v] = idx; });

    return values.slice().sort(function (a, b) {
      var sa = (scores && scores[a]) || 0;
      var sb = (scores && scores[b]) || 0;
      if (sb !== sa) return sb - sa;
      if (headToHead[a + "\u001f" + b]) return -1;
      if (headToHead[b + "\u001f" + a]) return 1;
      return orderMap[a] - orderMap[b];
    });
  }

  /**
   * Format a Date as DD/MM/YYYY for Vietnamese display and exports.
   */
  function formatVietnameseDate(date) {
    var d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  }

  /**
   * Format a Date as YYYY-MM-DD for download filenames.
   */
  function formatIsoDate(date) {
    var d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    return yyyy + "-" + mm + "-" + dd;
  }

  /**
   * Build the plain-text export summary for copy and .txt download.
   */
  function buildSummaryText(payload) {
    var rank = Array.isArray(payload.ranking) ? payload.ranking : [];
    var definitions = payload.definitions || {};
    var aspirational = Array.isArray(payload.aspirational) ? payload.aspirational : [];
    var antis = Array.isArray(payload.antis) ? payload.antis : [];
    var experiences = Array.isArray(payload.experiences) ? payload.experiences : [];
    var dateStr = payload.dateStr || formatVietnameseDate(new Date());

    var lines = [];
    lines.push("BẢN ĐỒ GIÁ TRỊ CỐT LÕI CỦA TÔI");
    lines.push("Ngày lập: " + dateStr);
    lines.push("========================================");
    lines.push("");
    lines.push("GIÁ TRỊ XẾP HẠNG (theo trực giác, qua so từng cặp):");
    rank.forEach(function (v, i) {
      var d = definitions[v] || { def: "", act: "" };
      lines.push((i + 1) + ". " + v.toUpperCase());
      if (d.def && d.def.trim()) lines.push("   Với tôi nghĩa là: " + d.def.trim());
      if (d.act && d.act.trim()) lines.push("   Hành động tuần này: " + d.act.trim());
    });

    if (aspirational.length) {
      lines.push("");
      lines.push("GIÁ TRỊ KHÁT VỌNG (muốn hướng tới, chưa phải giá trị đang điều khiển tôi):");
      lines.push("  " + aspirational.join(" · "));
    }

    if (antis.length) {
      lines.push("");
      lines.push("NHỮNG ĐIỀU TÔI KHÔNG CHỊU NỔI (bản đồ ngược của giá trị):");
      lines.push("  " + antis.join(" · "));
    }

    if (experiences.length) {
      lines.push("");
      lines.push("BẰNG CHỨNG SỐNG CỦA TÔI:");
      experiences.forEach(function (e) {
        lines.push("- " + e.label + ": " + e.text);
      });
    }

    lines.push("");
    lines.push("----------------------------------------");
    lines.push("Nhắc mình: soi lại sau 24 giờ, rồi hằng tháng và làm lại hằng năm.");
    lines.push("Đừng hỏi “mình muốn trở thành người thế nào?” — hãy hỏi “đời mình đã chứng minh mình là người thế nào?”");
    return lines.join("\n");
  }

  /**
   * Deduplicate an array of non-empty strings while preserving first-seen order.
   */
  function uniqueStrings(arr) {
    if (!Array.isArray(arr)) return [];
    var seen = {};
    var out = [];
    arr.forEach(function (item) {
      if (typeof item !== "string") return;
      var s = item.trim();
      if (!s) return;
      var key = s.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        out.push(s);
      }
    });
    return out;
  }

  /**
   * Validate and sanitize data parsed from localStorage (supports v1 & v2).
   */
  function sanitizeSavedState(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.version !== 1 && raw.version !== 2) return null;
    if (!Array.isArray(raw.selected)) return null;

    var selected = uniqueStrings(raw.selected).slice(0, LIMITS.maxSelected);
    var antis = uniqueStrings(raw.antis);
    var customValues = uniqueStrings(raw.customValues).filter(function (v) {
      return VALUES.indexOf(v) < 0;
    });
    var customAntis = uniqueStrings(raw.customAntis).filter(function (v) {
      return ANTIS.indexOf(v) < 0;
    });

    var classify = {};
    var validClasses = { "song": true, "khat-vong": true, "nen-co": true };
    if (raw.classify && typeof raw.classify === "object") {
      Object.keys(raw.classify).forEach(function (k) {
        if (validClasses[raw.classify[k]]) classify[k] = raw.classify[k];
      });
    }

    var pairs = Array.isArray(raw.pairs)
      ? raw.pairs.filter(function (p) {
          return Array.isArray(p) && p.length === 2 && typeof p[0] === "string" && typeof p[1] === "string";
        })
      : [];

    var pairIdx = typeof raw.pairIdx === "number" && raw.pairIdx >= 0 && raw.pairIdx <= pairs.length
      ? Math.floor(raw.pairIdx)
      : 0;

    var pairHistory = Array.isArray(raw.pairHistory)
      ? raw.pairHistory.filter(function (h) {
          return h && Array.isArray(h.pair) && h.pair.length === 2 && typeof h.winner === "string";
        })
      : [];

    var scores = {};
    if (raw.scores && typeof raw.scores === "object") {
      Object.keys(raw.scores).forEach(function (k) {
        if (typeof raw.scores[k] === "number" && isFinite(raw.scores[k]) && raw.scores[k] >= 0) {
          scores[k] = raw.scores[k];
        }
      });
    }

    var ranking = uniqueStrings(raw.ranking);

    var verify = {};
    if (raw.verify && typeof raw.verify === "object") {
      Object.keys(raw.verify).forEach(function (k) {
        var idx = Number(k);
        if (idx >= 0 && idx < VERIFY_QUESTIONS.length && typeof raw.verify[k] === "boolean") {
          verify[idx] = raw.verify[k];
        }
      });
    }

    var definitions = {};
    if (raw.definitions && typeof raw.definitions === "object") {
      Object.keys(raw.definitions).forEach(function (k) {
        var entry = raw.definitions[k];
        if (entry && typeof entry === "object") {
          definitions[k] = {
            def: typeof entry.def === "string" ? entry.def : "",
            act: typeof entry.act === "string" ? entry.act : ""
          };
        }
      });
    }

    var exps = {};
    if (raw.exps && typeof raw.exps === "object") {
      EXPERIENCE_FIELDS.forEach(function (f) {
        if (typeof raw.exps[f.id] === "string") {
          exps[f.id] = raw.exps[f.id];
        }
      });
    }

    var step = typeof raw.step === "number" && raw.step >= 1 && raw.step <= 8
      ? Math.floor(raw.step)
      : 1;

    var maxStepReached = typeof raw.maxStepReached === "number" && raw.maxStepReached >= step && raw.maxStepReached <= 8
      ? Math.floor(raw.maxStepReached)
      : step;

    return {
      version: 2,
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
      step: step,
      maxStepReached: maxStepReached,
      exps: exps,
      selected: selected,
      customValues: customValues,
      classify: classify,
      antis: antis,
      customAntis: customAntis,
      pairs: pairs,
      pairIdx: pairIdx,
      pairHistory: pairHistory,
      pairsSig: typeof raw.pairsSig === "string" ? raw.pairsSig : "",
      scores: scores,
      ranking: ranking,
      verify: verify,
      definitions: definitions
    };
  }

  return {
    VALUES: VALUES,
    ANTIS: ANTIS,
    CLASS_OPTIONS: CLASS_OPTIONS,
    VERIFY_QUESTIONS: VERIFY_QUESTIONS,
    EXPERIENCE_FIELDS: EXPERIENCE_FIELDS,
    STEP_NAMES: STEP_NAMES,
    LIMITS: LIMITS,
    normalizeText: normalizeText,
    cleanLabel: cleanLabel,
    valuesSignature: valuesSignature,
    buildShuffledPairs: buildShuffledPairs,
    computeRanking: computeRanking,
    formatVietnameseDate: formatVietnameseDate,
    formatIsoDate: formatIsoDate,
    buildSummaryText: buildSummaryText,
    uniqueStrings: uniqueStrings,
    sanitizeSavedState: sanitizeSavedState
  };
});
