(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TimGiaTriDaily = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAILY_PROMPTS = [
    { category: "Sống đúng giá trị", question: "Hôm nay có một hành động nhỏ nào (dù chỉ 5 phút) giúp bạn sống đúng với «{top1}» hơn hôm qua không?", hint: "Không cần việc lớn — chỉ cần một việc cụ thể bạn làm thật hôm nay." },
    { category: "Ranh giới & Nói không", question: "Nếu hôm nay phải nói «không» với một việc để bảo vệ «{top2}», đó là việc gì?", hint: "Mỗi lời đồng ý thiếu cân nhắc đều lấy thời gian từ giá trị đứng cao hơn." },
    { category: "Năng lượng", question: "Khoảnh khắc nào trong ngày hôm nay khiến bạn thấy tràn đầy năng lượng nhất — nó chạm vào giá trị nào trong Top 5?", hint: "Năng lượng thật là bằng chứng trung thực nhất của giá trị cốt lõi." },
    { category: "Ranh giới đỏ", question: "Hôm nay có lúc nào bạn cảm thấy bứt rứt hay khó chịu vì dấu hiệu của «{anti1}» không? Bạn đã phản ứng thế nào?", hint: "Gọi tên được điều làm mình tụt năng lượng là bước đầu để giữ ranh giới." },
    { category: "Mối quan hệ", question: "Hôm nay bạn có thể làm một điều nhỏ nào cho người quan trọng với mình mà vẫn giữ trọn «{top1}»?", hint: "Giá trị thật không chỉ dành cho riêng mình mà còn định hình cách bạn đối xử với người khác." },
    { category: "Quyết định nhỏ", question: "Trong các quyết định hôm nay (từ cách dùng thời gian đến cách trả lời tin nhắn), quyết định nào phản ánh rõ nhất «{top3}»?", hint: "Bản sắc được xây từ hàng chục lựa chọn nhỏ mỗi ngày." },
    { category: "Soi lại buổi tối", question: "Nếu tua lại ngày hôm nay như một đoạn phim ngắn, cảnh nào khiến bạn tự hào nhất về con người mình?", hint: "Cảnh đó thường là lúc bạn sống khớp với giá trị số 1 của mình." },
    { category: "Sống đúng giá trị", question: "Điều gì hôm nay bạn đang làm chỉ vì «nên làm» hoặc sợ người khác đánh giá, thay vì vì «{top1}»?", hint: "Nhận ra một việc làm vì áp lực bên ngoài đã giúp bạn nhẹ đi một nửa." },
    { category: "Thời gian & Ưu tiên", question: "Nhìn vào lịch hôm nay: Top 2 giá trị («{top1}» và «{top2}») chiếm được bao nhiêu phút thật sự?", hint: "Lịch làm việc không biết nói dối — nó cho thấy giá trị thực tế của bạn." },
    { category: "Ranh giới & Nói không", question: "Có cuộc trò chuyện thẳng thắn nào bạn đang trì hoãn vì ngại mất lòng, dù nó liên quan trực tiếp đến «{top1}»?", hint: "Viết ra câu mở đầu ngắn nhất bạn có thể nói trong tuần này." },
    { category: "Năng lượng", question: "Hôm nay việc gì rút cạn năng lượng của bạn nhanh nhất — nó có đang kéo ngược lại «{top2}» không?", hint: "Kiệt sức thường đến từ lệch giá trị hơn là từ khối lượng công việc." },
    { category: "Bằng chứng sống", question: "Một người lạ chỉ quan sát hành động của bạn hôm nay sẽ đoán giá trị số 1 của bạn là gì?", hint: "Nếu câu trả lời khác «{top1}», đừng tự trách — chỉ cần điều chỉnh 1 việc ngày mai." },
    { category: "Học hỏi", question: "Hôm nay bạn vừa nhận ra điều gì mới về bản thân qua một tình huống không như ý?", hint: "Lúc kế hoạch vỡ là lúc giá trị thật lộ rõ nhất." },
    { category: "Mối quan hệ", question: "Ai là người hôm nay khiến bạn thấy được là chính mình nhất? Vì sao?", hint: "Những người tôn trọng hệ giá trị của bạn là tài sản quý nhất." },
    { category: "Sống đúng giá trị", question: "Nếu «{top2}» được sống trọn vẹn 100% trong ngày mai, sáng mai bạn sẽ bắt đầu ngày mới khác đi thế nào?", hint: "Thiết kế 15 phút đầu ngày theo đúng giá trị bạn chọn." },
    { category: "Quyết định nhỏ", question: "Khoản tiền hoặc khung giờ bạn vừa chi hôm nay có đang phục vụ Top 5 giá trị của bạn không?", hint: "Tiền bạc và sự chú ý là hai phiếu bầu mạnh nhất mỗi ngày." },
    { category: "Ranh giới đỏ", question: "Khi đối mặt với «{anti1}», phản ứng mặc định của bạn là im lặng chịu đựng hay đặt ranh giới bình tĩnh?", hint: "Đặt ranh giới sớm luôn nhẹ nhàng hơn bùng nổ muộn." },
    { category: "Bình an nội tâm", question: "Hôm nay có phút nào bạn thấy nhẹ nhõm vì đã trung thực với cảm xúc và lựa chọn của chính mình không?", hint: "Sự nhẹ nhõm đó là tín hiệu của sống đồng điệu." },
    { category: "Cân bằng", question: "Giữa «{top1}» và «{top3}», hôm nay bên nào đang bị bạn bỏ quên? Một việc 10 phút nào có thể bù đắp tối nay?", hint: "Đừng đợi cuối tuần mới chăm lại giá trị đang thiếu." },
    { category: "Mối quan hệ", question: "Hôm nay bạn có vô tình áp đặt giá trị số 1 của mình («{top1}») lên người khác không?", hint: "Mỗi người có một thứ tự ưu tiên khác nhau — hiểu điều này giúp giảm 80% xung đột." },
    { category: "Hành động", question: "Một thói quen nhỏ nào bạn duy trì được trong tuần này đang âm thầm nuôi dưỡng «{top1}»?", hint: "Ghi nhận những bước nhỏ giúp não bộ muốn lặp lại vào ngày mai." },
    { category: "Năng lượng", question: "Nếu chấm điểm mức độ «sống thật với chính mình» hôm nay từ 1 đến 5, bạn cho mấy điểm và vì sao?", hint: "Chỉ cần trung thực 1 dòng — không có điểm tốt hay xấu." },
    { category: "Ranh giới & Nói không", question: "Thông báo, nhóm chat hay việc vặt nào hôm nay đang cướp sự tập trung khỏi «{top2}» của bạn?", hint: "Tắt bớt 1 nguồn gây nhiễu ngay lúc này." },
    { category: "Bằng chứng sống", question: "Hôm nay bạn đã giữ lời hứa nào với chính mình — dù không ai kiểm tra?", hint: "Tự trọng được xây từ những lời hứa nhỏ bạn giữ khi chỉ có một mình." },
    { category: "Tầm nhìn", question: "Nếu lặp lại đúng ngày hôm nay trong 365 ngày tới, bạn có hài lòng với con người mình sẽ trở thành không?", hint: "Câu hỏi này giúp phát hiện sớm những lệch hướng nhỏ." },
    { category: "Sống đúng giá trị", question: "Điều gì bạn đã làm tốt hôm nay nhờ đi theo «{top3}»?", hint: "Đừng chỉ soi lỗi — hãy ghi lại bằng chứng bạn đang sống đúng." },
    { category: "Quyết định nhỏ", question: "Có việc gì đang treo lơ lửng trong đầu bạn suốt mấy ngày qua? Nếu dùng «{top1}» làm tiêu chuẩn, bạn sẽ chốt thế nào?", hint: "Khi có tiêu chuẩn rõ, quyết định trở nên nhẹ hơn rất nhiều." },
    { category: "Biết ơn", question: "Một khoảnh khắc bình dị nào hôm nay khiến bạn thấy biết ơn cuộc sống hiện tại?", hint: "Lòng biết ơn giúp bạn nhìn rõ những giá trị mình đang thật sự sở hữu." },
    { category: "Chuẩn bị ngày mai", question: "Ngày mai, chỉ chọn DUY NHẤT 1 việc quan trọng nhất gắn với «{top1}» — đó là việc gì?", hint: "Đặt lịch cụ thể cho việc đó trước khi đi ngủ." },
    { category: "Tổng kết chu kỳ", question: "Nhìn lại 30 ngày qua, giá trị nào trong Top 5 bạn sống tốt nhất và giá trị nào cần được ưu tiên hơn tháng tới?", hint: "Đây là lúc lý tưởng để mở lại Bản đồ giá trị và cập nhật Check-in." }
  ];

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toDateKey(date) {
    var d = date instanceof Date ? date : new Date(date || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dayOfYear(date) {
    var d = date instanceof Date ? date : new Date(date || Date.now());
    var start = new Date(d.getFullYear(), 0, 0);
    var diff = d - start;
    return Math.floor(diff / 86400000);
  }

  function interpolate(text, ranking, antis) {
    var top1 = (ranking && ranking[0]) || "giá trị số 1 của bạn";
    var top2 = (ranking && ranking[1]) || "giá trị số 2 của bạn";
    var top3 = (ranking && ranking[2]) || "giá trị cốt lõi của bạn";
    var anti1 = (antis && antis[0]) || "điều bạn không chịu nổi";
    return String(text || "")
      .replace(/\{top1\}/g, top1)
      .replace(/\{top2\}/g, top2)
      .replace(/\{top3\}/g, top3)
      .replace(/\{anti1\}/g, anti1);
  }

  /**
   * Lấy câu hỏi mỗi ngày theo chu kỳ 30 ngày, cá nhân hóa theo Top 5 & Anti-values.
   */
  function getDailyPrompt(date, ranking, antis, offset) {
    var d = date instanceof Date ? date : new Date(date || Date.now());
    var doy = dayOfYear(d);
    var shift = typeof offset === "number" ? Math.floor(offset) : 0;
    var len = DAILY_PROMPTS.length;
    var idx = ((doy - 1 + shift) % len + len) % len;
    var item = DAILY_PROMPTS[idx];
    return {
      index: idx,
      cycleDay: idx + 1,
      totalCycle: len,
      category: item.category,
      question: interpolate(item.question, ranking, antis),
      hint: interpolate(item.hint, ranking, antis)
    };
  }

  /**
   * Tính chuỗi ngày liên tiếp (streak) từ mảng nhật ký [{ dateKey: 'YYYY-MM-DD', ... }].
   */
  function computeStreak(logs, today) {
    var now = today instanceof Date ? today : new Date(today || Date.now());
    var map = {};
    if (Array.isArray(logs)) {
      logs.forEach(function (entry) {
        if (entry && typeof entry.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey)) {
          map[entry.dateKey] = true;
        }
      });
    }
    var keys = Object.keys(map).sort();
    var todayKey = toDateKey(now);
    var doneToday = !!map[todayKey];

    // Tính currentStreak (bắt đầu từ hôm nay nếu đã làm, hoặc hôm qua nếu hôm nay chưa làm)
    var cur = 0;
    var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!doneToday) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (map[toDateKey(cursor)]) {
      cur += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Tính longestStreak
    var longest = 0;
    var run = 0;
    var prevTs = null;
    keys.forEach(function (k) {
      var parts = k.split("-");
      var ts = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (prevTs !== null && ts - prevTs === 86400000) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
      prevTs = ts;
    });

    // 14 ngày gần nhất (cũ -> mới)
    var last14 = [];
    for (var i = 13; i >= 0; i--) {
      var d14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var k14 = toDateKey(d14);
      last14.push({
        dateKey: k14,
        dayNum: d14.getDate(),
        done: !!map[k14],
        isToday: k14 === todayKey
      });
    }

    return {
      currentStreak: cur,
      longestStreak: longest,
      totalDays: keys.length,
      doneToday: doneToday,
      last14Days: last14
    };
  }

  function escapeIcsText(s) {
    return String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  /**
   * Tạo file lịch .ics nhắc trả lời Câu hỏi mỗi ngày (lặp hằng ngày RRULE:FREQ=DAILY).
   */
  function buildDailyReminderIcs(opts) {
    var o = opts && typeof opts === "object" ? opts : {};
    var hour = Math.max(0, Math.min(23, Math.floor(Number(o.hour !== undefined ? o.hour : 20))));
    var minute = Math.max(0, Math.min(59, Math.floor(Number(o.minute !== undefined ? o.minute : 30))));
    var start = o.startDate instanceof Date ? o.startDate : new Date();
    var topValues = Array.isArray(o.topValues) ? o.topValues.slice(0, 3) : [];
    var siteUrl = (typeof o.siteUrl === "string" && o.siteUrl.trim())
      ? o.siteUrl.replace(/\/+$/, "") + "/daily.html"
      : "https://duyphuc1413.github.io/tim-gia-tri/daily.html";

    var dtStart =
      start.getFullYear() +
      pad2(start.getMonth() + 1) +
      pad2(start.getDate()) +
      "T" +
      pad2(hour) +
      pad2(minute) +
      "00";

    var endMinTotal = hour * 60 + minute + 10;
    var endH = Math.floor(endMinTotal / 60) % 24;
    var endM = endMinTotal % 60;
    var dtEnd =
      start.getFullYear() +
      pad2(start.getMonth() + 1) +
      pad2(start.getDate()) +
      "T" +
      pad2(endH) +
      pad2(endM) +
      "00";

    var stamp =
      start.getUTCFullYear() +
      pad2(start.getUTCMonth() + 1) +
      pad2(start.getUTCDate()) +
      "T" +
      pad2(start.getUTCHours()) +
      pad2(start.getUTCMinutes()) +
      pad2(start.getUTCSeconds()) +
      "Z";

    var summary = topValues.length
      ? "Tìm Giá Trị · 1 phút soi chiếu (" + topValues.join(" · ") + ")"
      : "Tìm Giá Trị · 1 phút câu hỏi mỗi ngày";

    var desc =
      "Dành 1 phút trả lời câu hỏi hôm nay để giữ la bàn giá trị cốt lõi luôn sáng.\nMở ngay: " + siteUrl;

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TimGiaTri//Daily Reflection//VI",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:tgt-daily-" + dtStart + "@timgiatri",
      "DTSTAMP:" + stamp,
      "DTSTART:" + dtStart,
      "DTEND:" + dtEnd,
      "RRULE:FREQ=DAILY",
      "SUMMARY:" + escapeIcsText(summary),
      "DESCRIPTION:" + escapeIcsText(desc),
      "URL:" + siteUrl,
      "BEGIN:VALARM",
      "TRIGGER:PT0M",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + escapeIcsText(summary),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
      ""
    ].join("\r\n");
  }

  return {
    DAILY_PROMPTS: DAILY_PROMPTS,
    toDateKey: toDateKey,
    getDailyPrompt: getDailyPrompt,
    computeStreak: computeStreak,
    buildDailyReminderIcs: buildDailyReminderIcs
  };
});
