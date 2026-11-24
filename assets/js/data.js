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

  /**
   * "Đọc ngược": mỗi điều không chịu nổi thường chỉ về những giá trị này.
   * Mọi giá trị đích đều phải có trong VALUES (có unit test kiểm tra).
   */
  var ANTI_MAP = {
    "Bị kiểm soát": ["Tự do", "Tự chủ", "Độc lập"],
    "Bất công": ["Công bằng", "Chính trực"],
    "Giả dối": ["Trung thực", "Chân thành", "Minh bạch"],
    "Bị phản bội": ["Tin cậy", "Trung thực"],
    "Nhàm chán": ["Phiêu lưu", "Khám phá", "Tò mò", "Sáng tạo"],
    "Bị coi thường": ["Tôn trọng", "Tự tin"],
    "Hỗn loạn": ["Bình an", "Cân bằng", "An toàn", "Kỷ luật"],
    "Bị bỏ rơi": ["Gia đình", "Kết nối", "Gắn kết"],
    "Phải tuân thủ mù quáng": ["Tự do", "Tự chủ", "Trí tuệ"],
    "Bị phán xét": ["Tôn trọng", "Lòng trắc ẩn", "Tự do"],
    "Cô lập": ["Kết nối", "Cộng đồng", "Gắn kết"],
    "Bất lực": ["Tự chủ", "Thành tựu", "Ảnh hưởng"],
    "Lãng phí thời gian": ["Thành tựu", "Kỷ luật", "Cống hiến"],
    "Bị lợi dụng": ["Tôn trọng", "Công bằng", "Tin cậy"],
    "Thiển cận": ["Trí tuệ", "Sâu sắc", "Học hỏi"],
    "Bị ép buộc": ["Tự do", "Tự chủ"],
    "Thiếu tôn trọng": ["Tôn trọng", "Tử tế"],
    "Bị lãng quên": ["Kết nối", "Ảnh hưởng", "Gắn kết"]
  };

  var HISTORY_MAX = 10;
  var HISTORY_TOP = 8;

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
   * Đọc ngược các điều không chịu nổi so với nhóm giá trị "đã sống".
   * rows: mỗi anti có trong ANTI_MAP kèm giá trị nó chỉ tới và giá trị đã khớp.
   * missed: giá trị gợi ý cho những anti không khớp giá trị "đã sống" nào.
   */
  function readAntis(antis, lived) {
    var livedList = Array.isArray(lived) ? lived : [];
    var rows = [];
    var missed = [];
    (Array.isArray(antis) ? antis : []).forEach(function (a) {
      var implied = ANTI_MAP[a];
      if (!implied) return;
      var hit = implied.filter(function (v) { return livedList.indexOf(v) >= 0; });
      rows.push({ anti: a, implied: implied.slice(), hit: hit });
      if (!hit.length) {
        implied.forEach(function (v) { if (missed.indexOf(v) < 0) missed.push(v); });
      }
    });
    return { rows: rows, missed: missed };
  }

  /**
   * Find words from the value bank that the user already wrote in Step 1
   * (accent-sensitive, whole-word match to avoid false hints).
   */
  function findMentionedValues(texts, values) {
    function words(s) {
      return " " + String(s).normalize("NFC").toLowerCase()
        .replace(/[\s.,;:!?"“”‘’'()\[\]\-–—…\/]+/g, " ") + " ";
    }
    var all = words((Array.isArray(texts) ? texts : []).join(" "));
    return (Array.isArray(values) ? values : []).filter(function (v) {
      return all.indexOf(words(v)) >= 0;
    });
  }

  /**
   * Compare the current ranking with a previous one.
   * kept: [{value, delta}] where delta > 0 means moved up.
   */
  function compareRankings(prev, now) {
    var p = Array.isArray(prev) ? prev : [];
    var n = Array.isArray(now) ? now : [];
    return {
      kept: n.filter(function (v) { return p.indexOf(v) >= 0; }).map(function (v) {
        return { value: v, delta: p.indexOf(v) - n.indexOf(v) };
      }),
      added: n.filter(function (v) { return p.indexOf(v) < 0; }),
      dropped: p.filter(function (v) { return n.indexOf(v) < 0; })
    };
  }

  /**
   * Validate a history list (from localStorage or a backup file).
   */
  function sanitizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    var seen = {};
    raw.forEach(function (h) {
      if (!h || typeof h !== "object" || typeof h.id !== "string" || !h.id) return;
      if (typeof h.date !== "string" || isNaN(new Date(h.date).getTime())) return;
      var ranking = uniqueStrings(h.ranking).slice(0, HISTORY_TOP);
      if (!ranking.length || seen[h.id]) return;
      seen[h.id] = true;
      out.push({ id: h.id, date: h.date, ranking: ranking, antis: uniqueStrings(h.antis) });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out.slice(-HISTORY_MAX);
  }

  /**
   * Insert or replace this journey's entry, keeping the newest HISTORY_MAX entries.
   */
  function upsertHistory(history, entry) {
    var list = sanitizeHistory(history).filter(function (h) { return h.id !== entry.id; });
    list.push(entry);
    return sanitizeHistory(list);
  }

  /* --- Lịch nhắc .ics (RFC 5545) --- */
  function icsEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  function utf8Length(ch) {
    var c = ch.codePointAt(0);
    return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  function icsFold(line) {
    // Mỗi dòng tối đa 75 byte UTF-8; dòng nối tiếp bắt đầu bằng 1 dấu cách
    var out = [];
    var cur = "";
    var len = 0;
    Array.from(line).forEach(function (ch) {
      var n = utf8Length(ch);
      if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; len = 0; }
      cur += ch;
      len += n;
    });
    out.push(cur);
    return out.join("\r\n ");
  }
  function icsLocal(d) {
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "T" + p(d.getHours()) + p(d.getMinutes()) + "00";
  }

  /**
   * Build a calendar file with 3 reminders at 20:00 local time:
   * 24h review, monthly review (12 times), and redo the journey after 1 year.
   */
  function buildIcs(opts) {
    var now = opts.now instanceof Date ? opts.now : new Date();
    var uid = opts.uid || String(now.getTime());
    var top = (Array.isArray(opts.ranking) ? opts.ranking : []).slice(0, LIMITS.topDefineCount)
      .map(function (v, i) { return (i + 1) + ". " + v; }).join("\n");
    function at(days, months) {
      return new Date(now.getFullYear(), now.getMonth() + (months || 0), now.getDate() + (days || 0), 20, 0, 0);
    }
    var events = [
      { start: at(1), mins: 20, title: "Soi lại bản đồ giá trị (quy tắc 24 giờ)",
        desc: "Đọc lại danh sách khi đầu óc đã nghỉ. Câu nào vẫn “đúng” khi bạn không cố nghĩ về nó?\n\nTop 5 hôm qua:\n" + top },
      { start: at(0, 1), mins: 60, title: "Soi lại giá trị hằng tháng (1 giờ)", rrule: "FREQ=MONTHLY;COUNT=12",
        desc: "Tháng qua mình đã sống giá trị nào, bằng việc gì cụ thể? Vi phạm ở đâu, vì sao? Có xung đột mới nào không?\n\nTop 5:\n" + top },
      { start: at(0, 12), mins: 60, title: "Làm lại hành trình tìm giá trị (hằng năm)",
        desc: "Làm lại từ Bước 1, không nhìn bảng cũ trước. Trang sẽ tự so bảng mới với bảng cũ." + (opts.url ? "\n\n" + opts.url : "") }
    ];
    var stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tim Gia Tri//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    events.forEach(function (ev, i) {
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + uid + "-" + i + "@tim-gia-tri");
      lines.push("DTSTAMP:" + stamp);
      lines.push("DTSTART:" + icsLocal(ev.start));
      lines.push("DTEND:" + icsLocal(new Date(ev.start.getTime() + ev.mins * 60000)));
      if (ev.rrule) lines.push("RRULE:" + ev.rrule);
      lines.push("SUMMARY:" + icsEscape(ev.title));
      lines.push("DESCRIPTION:" + icsEscape(ev.desc));
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape(ev.title), "TRIGGER:-PT10M", "END:VALARM");
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.map(icsFold).join("\r\n") + "\r\n";
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
    var missed = Array.isArray(payload.missed) ? payload.missed : [];

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

    if (missed.length) {
      lines.push("");
      lines.push("CÓ THỂ ĐÃ BỎ SÓT (đọc ngược từ điều không chịu nổi):");
      lines.push("  " + missed.join(" · "));
    }

    if (experiences.length) {
      lines.push("");
      lines.push("BẰNG CHỨNG SỐNG CỦA TÔI:");
      experiences.forEach(function (e) {
        lines.push("- " + e.label + ": " + e.text);
      });
    }

    if (rank.length >= 2) {
      lines.push("");
      lines.push("BA CÂU TỰ SOI XUNG ĐỘT:");
      conflictQuestions(rank).forEach(function (q) { lines.push("- " + q); });
    }

    lines.push("");
    lines.push("----------------------------------------");
    lines.push("Nhắc mình: soi lại sau 24 giờ, rồi hằng tháng và làm lại hằng năm.");
    lines.push("Đừng hỏi “mình muốn trở thành người thế nào?” — hãy hỏi “đời mình đã chứng minh mình là người thế nào?”");
    return lines.join("\n");
  }

  /**
   * Three conflict questions personalised with the user's own ranking.
   */
  function conflictQuestions(rank) {
    if (!Array.isArray(rank) || rank.length < 2) return [];
    var last = rank[Math.min(rank.length, LIMITS.topDefineCount) - 1];
    return [
      "Việc gì bạn đang làm mỗi tuần đang vi phạm “" + rank[0] + "” hoặc “" + rank[1] + "”?",
      "“" + rank[0] + "” và “" + rank[1] + "” có đang triệt tiêu nhau trong cách bạn sống hiện tại không?",
      "Nếu chỉ nhượng bộ một chút ở “" + last + "” để cứu “" + rank[0] + "”, nhượng bộ đó trông thế nào?"
    ];
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

    var extras = {};
    if (raw.extras && typeof raw.extras === "object") {
      if (Array.isArray(raw.extras.goals)) {
        extras.goals = raw.extras.goals.slice(0, 21).reduce(function (acc, g) {
          if (!g || typeof g !== "object") return acc;
          acc.push({
            domain: typeof g.domain === "string" ? g.domain.slice(0, 40) : "career",
            be: typeof g.be === "string" ? g.be.slice(0, 300) : "",
            doText: typeof g.doText === "string" ? g.doText.slice(0, 300) : "",
            have: typeof g.have === "string" ? g.have.slice(0, 300) : "",
            linkedValue: typeof g.linkedValue === "string" ? g.linkedValue.slice(0, 80) : "",
            reverseCheck: typeof g.reverseCheck === "string" ? g.reverseCheck.slice(0, 300) : ""
          });
          return acc;
        }, []);
      }
      if (Array.isArray(raw.extras.checkins)) {
        extras.checkins = raw.extras.checkins.slice(0, 52).reduce(function (acc, c) {
          if (!c || typeof c !== "object" || typeof c.date !== "string") return acc;
          var sc = {};
          if (c.scores && typeof c.scores === "object") {
            Object.keys(c.scores).slice(0, 8).forEach(function (k) {
              var n = Number(c.scores[k]);
              if (n >= 1 && n <= 5) sc[String(k).slice(0, 80)] = Math.round(n);
            });
          }
          acc.push({
            date: c.date.slice(0, 32),
            scores: sc,
            note: typeof c.note === "string" ? c.note.slice(0, 300) : "",
            pct: Math.max(0, Math.min(100, Math.round(Number(c.pct) || 0)))
          });
          return acc;
        }, []);
      }
      if (raw.extras.decision && typeof raw.extras.decision === "object") {
        var dec = raw.extras.decision;
        extras.decision = {
          question: typeof dec.question === "string" ? dec.question.slice(0, 200) : "",
          options: Array.isArray(dec.options)
            ? dec.options.slice(0, 4).reduce(function (acc, o) {
                if (!o || typeof o !== "object") return acc;
                var os = {};
                if (o.scores && typeof o.scores === "object") {
                  Object.keys(o.scores).slice(0, 8).forEach(function (k) {
                    var n = Number(o.scores[k]);
                    if (n >= 1 && n <= 5) os[String(k).slice(0, 80)] = Math.round(n);
                  });
                }
                acc.push({
                  name: typeof o.name === "string" ? o.name.slice(0, 120) : "",
                  scores: os
                });
                return acc;
              }, [])
            : []
        };
      }
      if (raw.extras.aiReport && typeof raw.extras.aiReport === "object" && Array.isArray(raw.extras.aiReport.sections)) {
        extras.aiReport = {
          mode: typeof raw.extras.aiReport.mode === "string" ? raw.extras.aiReport.mode.slice(0, 20) : "structured",
          generatedAt: typeof raw.extras.aiReport.generatedAt === "string" ? raw.extras.aiReport.generatedAt.slice(0, 40) : "",
          headline: typeof raw.extras.aiReport.headline === "string" ? raw.extras.aiReport.headline.slice(0, 220) : "",
          sections: raw.extras.aiReport.sections.slice(0, 6).map(function (s) {
            return {
              title: s && typeof s.title === "string" ? s.title.slice(0, 140) : "",
              body: s && typeof s.body === "string" ? s.body.slice(0, 1600) : ""
            };
          })
        };
      }
    }

    return {
      version: 2,
      journeyId: typeof raw.journeyId === "string" && /^[a-z0-9]{6,40}$/.test(raw.journeyId) ? raw.journeyId : "",
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
      definitions: definitions,
      extras: extras
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
    ANTI_MAP: ANTI_MAP,
    readAntis: readAntis,
    findMentionedValues: findMentionedValues,
    compareRankings: compareRankings,
    sanitizeHistory: sanitizeHistory,
    upsertHistory: upsertHistory,
    buildIcs: buildIcs,
    conflictQuestions: conflictQuestions,
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
