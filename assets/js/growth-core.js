(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TimGiaTriGrowth = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function utf8ToBase64Url(str) {
    var bytes;
    if (typeof TextEncoder !== "undefined") {
      bytes = new TextEncoder().encode(str);
    } else if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(str, "utf8");
    } else {
      bytes = [];
    }
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    var b64 = typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToUtf8(b64url) {
    var b64 = String(b64url || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    if (typeof atob === "function") {
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      if (typeof TextDecoder !== "undefined") {
        return new TextDecoder().decode(bytes);
      }
      return binary;
    }
    return Buffer.from(b64, "base64").toString("utf8");
  }

  /**
   * Mã hóa gọn hồ sơ giá trị (chỉ tên ngắn + top 5 giá trị + top 3 anti-values)
   * thành chuỗi URL-safe để tạo link mời so sánh 2 người không cần lưu máy chủ.
   */
  function encodeCompareProfile(profile) {
    if (!profile || !Array.isArray(profile.ranking) || !profile.ranking.length) {
      return "";
    }
    var payload = {
      n: typeof profile.name === "string" ? profile.name.trim().slice(0, 40) : "",
      v: profile.ranking
        .filter(function (x) { return typeof x === "string" && x.trim(); })
        .slice(0, 5)
        .map(function (x) { return x.trim().slice(0, 40); }),
      a: Array.isArray(profile.antis)
        ? profile.antis
            .filter(function (x) { return typeof x === "string" && x.trim(); })
            .slice(0, 3)
            .map(function (x) { return x.trim().slice(0, 40); })
        : []
    };
    if (!payload.v.length) return "";
    return utf8ToBase64Url(JSON.stringify(payload));
  }

  function decodeCompareProfile(encoded) {
    if (typeof encoded !== "string" || !encoded.trim() || encoded.length > 1500) {
      return null;
    }
    try {
      var raw = JSON.parse(base64UrlToUtf8(encoded.trim()));
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.v) || !raw.v.length) {
        return null;
      }
      var ranking = raw.v
        .filter(function (x) { return typeof x === "string" && x.trim(); })
        .slice(0, 5)
        .map(function (x) { return x.trim().slice(0, 40); });
      if (!ranking.length) return null;
      var antis = Array.isArray(raw.a)
        ? raw.a
            .filter(function (x) { return typeof x === "string" && x.trim(); })
            .slice(0, 3)
            .map(function (x) { return x.trim().slice(0, 40); })
        : [];
      return {
        name: typeof raw.n === "string" ? raw.n.trim().slice(0, 40) : "",
        ranking: ranking,
        antis: antis
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * So sánh 2 hồ sơ giá trị (Cặp đôi / Đồng sáng lập / Bạn thân).
   * Trả về alignmentScore (0-100), shared, onlyA, onlyB, tensions, prompts.
   */
  function compareTwoProfiles(profileA, profileB, antiMap) {
    var aRank = (profileA && Array.isArray(profileA.ranking) ? profileA.ranking : []).slice(0, 5);
    var bRank = (profileB && Array.isArray(profileB.ranking) ? profileB.ranking : []).slice(0, 5);
    var aAntis = (profileA && Array.isArray(profileA.antis) ? profileA.antis : []).slice(0, 5);
    var bAntis = (profileB && Array.isArray(profileB.antis) ? profileB.antis : []).slice(0, 5);
    var map = antiMap && typeof antiMap === "object" ? antiMap : {};

    var nameA = (profileA && profileA.name) ? profileA.name : "Người A";
    var nameB = (profileB && profileB.name) ? profileB.name : "Bạn";

    var bPos = {};
    bRank.forEach(function (v, idx) { bPos[v] = idx + 1; });
    var aPos = {};
    aRank.forEach(function (v, idx) { aPos[v] = idx + 1; });

    var shared = [];
    var onlyA = [];
    var onlyB = [];

    aRank.forEach(function (v, idx) {
      if (bPos[v]) {
        shared.push({ value: v, rankA: idx + 1, rankB: bPos[v] });
      } else {
        onlyA.push({ value: v, rank: idx + 1 });
      }
    });
    bRank.forEach(function (v, idx) {
      if (!aPos[v]) {
        onlyB.push({ value: v, rank: idx + 1 });
      }
    });

    // Tính chỉ số đồng điệu (0-100): kết hợp tỷ lệ trùng lặp có trọng số thứ hạng + độ gần thứ hạng
    var maxPossible = 0;
    var earned = 0;
    for (var i = 0; i < Math.max(aRank.length, bRank.length); i++) {
      maxPossible += (5 - i) * 2;
    }
    shared.forEach(function (s) {
      var wA = Math.max(1, 6 - s.rankA);
      var wB = Math.max(1, 6 - s.rankB);
      earned += wA + wB;
    });
    // Cộng điểm nhẹ nếu anti-values trùng nhau (cùng ranh giới đỏ)
    var sharedAntis = aAntis.filter(function (x) { return bAntis.indexOf(x) !== -1; });
    var basePct = maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : 0;
    var alignmentScore = Math.min(100, basePct + sharedAntis.length * 6);

    // Phát hiện điểm cần lưu ý (ranh giới đỏ của người này vs bảng giá trị người kia)
    var tensions = [];
    aAntis.forEach(function (anti) {
      var related = map[anti] || [];
      var coveredByB = related.some(function (rv) { return !!bPos[rv]; });
      if (related.length && !coveredByB) {
        tensions.push(
          nameA + " đặc biệt không chịu nổi “" + anti + "” (gắn với " + related.slice(0, 2).join(" / ") +
          "), nhưng nhóm giá trị này chưa nằm trong Top 5 của " + nameB + " — nên thống nhất rõ ranh giới này."
        );
      }
    });
    bAntis.forEach(function (anti) {
      var related = map[anti] || [];
      var coveredByA = related.some(function (rv) { return !!aPos[rv]; });
      if (related.length && !coveredByA) {
        tensions.push(
          nameB + " đặc biệt không chịu nổi “" + anti + "” (gắn với " + related.slice(0, 2).join(" / ") +
          "), nhưng nhóm giá trị này chưa nằm trong Top 5 của " + nameA + " — nên trao đổi trước khi hợp tác sâu."
        );
      }
    });
    if (aRank[0] && bRank[0] && aRank[0] !== bRank[0]) {
      tensions.unshift(
        "Ưu tiên số 1 khác nhau: " + nameA + " đặt “" + aRank[0] + "” lên đầu, còn " + nameB + " đặt “" + bRank[0] + "” lên đầu. Khi quyết định gấp, mỗi người sẽ kéo về hướng ưu tiên số 1 của mình."
      );
    }

    var prompts = [
      shared.length
        ? "Cả hai cùng coi trọng “" + shared[0].value + "” — nhưng định nghĩa của mỗi người về từ này có thật sự giống nhau không?"
        : "Top 5 của hai người khá bổ trợ nhau — đâu là điểm mạnh khi kết hợp “" + (aRank[0] || "giá trị của A") + "” và “" + (bRank[0] || "giá trị của bạn") + "”?",
      "Khi xảy ra bất đồng giữa “" + (aRank[0] || "ưu tiên A") + "” của " + nameA + " và “" + (bRank[0] || "ưu tiên B") + "” của " + nameB + ", nguyên tắc chung nào giúp cả hai không thấy bị chà đạp?",
      "Một hành động nhỏ trong tuần này mà mỗi người có thể làm để tôn trọng giá trị số 1 của đối phương là gì?"
    ];

    return {
      alignmentScore: alignmentScore,
      shared: shared,
      sharedAntis: sharedAntis,
      onlyA: onlyA,
      onlyB: onlyB,
      tensions: tensions.slice(0, 4),
      prompts: prompts
    };
  }

  /**
   * Tính điểm Check-in sống đúng giá trị (0-100%) từ điểm 1-5 cho Top 5.
   */
  function computeCheckinScore(scores, ranking) {
    var top = (Array.isArray(ranking) ? ranking : []).slice(0, 5);
    if (!top.length || !scores || typeof scores !== "object") return 0;
    var sum = 0;
    var count = 0;
    top.forEach(function (v) {
      var n = Number(scores[v]);
      if (n >= 1 && n <= 5) {
        sum += n;
        count += 1;
      }
    });
    if (!count) return 0;
    return Math.round((sum / (count * 5)) * 100);
  }

  /**
   * Chấm điểm các phương án trong Ma trận ra quyết định theo trọng số Top 5 (#1=5..#5=1).
   */
  function scoreDecisionOptions(options, ranking) {
    var top = (Array.isArray(ranking) ? ranking : []).slice(0, 5);
    if (!top.length || !Array.isArray(options)) return [];
    var maxWeight = 0;
    for (var i = 0; i < top.length; i++) {
      maxWeight += (5 - i) * 5;
    }
    return options
      .map(function (opt, idx) {
        var weighted = 0;
        var sc = (opt && opt.scores && typeof opt.scores === "object") ? opt.scores : {};
        top.forEach(function (v, vi) {
          var n = Math.max(1, Math.min(5, Math.round(Number(sc[v]) || 3)));
          weighted += n * (5 - vi);
        });
        var pct = maxWeight > 0 ? Math.round((weighted / maxWeight) * 100) : 0;
        return {
          index: idx,
          name: (opt && opt.name ? String(opt.name).trim() : "") || ("Phương án " + (idx + 1)),
          weighted: weighted,
          maxWeight: maxWeight,
          pct: pct
        };
      })
      .sort(function (a, b) { return b.pct - a.pct; });
  }

  return {
    encodeCompareProfile: encodeCompareProfile,
    decodeCompareProfile: decodeCompareProfile,
    compareTwoProfiles: compareTwoProfiles,
    computeCheckinScore: computeCheckinScore,
    scoreDecisionOptions: scoreDecisionOptions
  };
});
