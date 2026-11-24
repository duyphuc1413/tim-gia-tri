(function () {
  "use strict";

  var WORKBOOK_KEY = "tim-gia-tri-v1";
  var DAILY_KEY = "tim-gia-tri-daily-v1";
  var REMINDER_TIME_KEY = "tim-gia-tri-daily-time";

  var promptOffset = 0;
  var selectedScore = 4;

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function loadWorkbookProfile() {
    var Core = window.TimGiaTriCore;
    try {
      var raw = window.localStorage.getItem(WORKBOOK_KEY);
      if (!raw) return { ranking: [], antis: [] };
      var parsed = JSON.parse(raw);
      var clean = Core ? Core.sanitizeSavedState(parsed) : parsed;
      return {
        ranking: (clean && Array.isArray(clean.ranking)) ? clean.ranking.slice(0, 5) : [],
        antis: (clean && Array.isArray(clean.antis)) ? clean.antis.slice(0, 5) : []
      };
    } catch (e) {
      return { ranking: [], antis: [] };
    }
  }

  function loadDailyLogs() {
    try {
      var raw = window.localStorage.getItem(DAILY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveDailyLogs(logs) {
    try {
      window.localStorage.setItem(DAILY_KEY, JSON.stringify(logs.slice(0, 365)));
    } catch (e) {}
  }

  function render() {
    var Daily = window.TimGiaTriDaily;
    if (!Daily) return;

    var profile = loadWorkbookProfile();
    var logs = loadDailyLogs();
    var today = new Date();
    var todayKey = Daily.toDateKey(today);

    // 1. Streak & 14-day dots
    var st = Daily.computeStreak(logs, today);
    $("streakCurrent").textContent = String(st.currentStreak);
    $("streakLongest").textContent = String(st.longestStreak);
    $("streakTotal").textContent = String(st.totalDays);

    var dots = $("streakDots");
    dots.textContent = "";
    st.last14Days.forEach(function (d) {
      var dot = el("div", {
        className: "streak-dot" + (d.done ? " done" : "") + (d.isToday ? " today" : ""),
        title: d.dateKey + (d.done ? " · Đã hoàn thành" : " · Chưa ghi")
      }, String(d.dayNum));
      dots.appendChild(dot);
    });

    // 2. Câu hỏi hôm nay
    var p = Daily.getDailyPrompt(today, profile.ranking, profile.antis, promptOffset);
    $("dailyPromptMeta").textContent = "Ngày " + p.cycleDay + "/" + p.totalCycle + " · " + p.category;
    $("dailyQuestion").textContent = p.question;
    $("dailyHint").textContent = p.hint;

    var topBar = $("dailyTopValuesBar");
    topBar.textContent = "";
    if (profile.ranking.length) {
      topBar.appendChild(el("span", { className: "daily-top-lbl" }, "Top giá trị của bạn:"));
      profile.ranking.slice(0, 5).forEach(function (v, idx) {
        topBar.appendChild(el("span", { className: "daily-val-chip" }, "#" + (idx + 1) + " " + v));
      });
    } else {
      topBar.appendChild(el("span", { className: "daily-top-lbl" },
        "Mẹo: Hoàn thành 7 bước workbook để câu hỏi tự cá nhân hóa theo đúng Top 5 giá trị của bạn."));
    }

    // Nếu hôm nay đã ghi, điền sẵn vào form để có thể xem/sửa
    var todayEntry = logs.find(function (l) { return l.dateKey === todayKey; });
    if (todayEntry && !$("dailyAnswer").value) {
      $("dailyAnswer").value = todayEntry.answer || "";
      selectedScore = todayEntry.score || 4;
    }

    // Rating pills 1-5
    var pills = $("dailyRatingPills");
    pills.textContent = "";
    [1, 2, 3, 4, 5].forEach(function (n) {
      var btn = el("button", {
        type: "button",
        className: "checkin-pill" + (n === selectedScore ? " active" : "")
      }, String(n));
      btn.addEventListener("click", function () {
        selectedScore = n;
        Array.prototype.forEach.call(pills.children, function (c) { c.classList.remove("active"); });
        btn.classList.add("active");
      });
      pills.appendChild(btn);
    });

    // 3. Lịch sử gần đây
    var hist = $("dailyHistoryList");
    hist.textContent = "";
    if (!logs.length) {
      hist.appendChild(el("p", { className: "empty-note" }, "Chưa có bản ghi nào. Hãy viết 1–2 dòng đầu tiên cho hôm nay!"));
      return;
    }
    logs.slice(0, 14).forEach(function (item) {
      var card = el("div", { className: "daily-hist-card" });
      var meta = el("div", { className: "daily-hist-meta" });
      meta.appendChild(el("strong", null, item.dateKey + " · " + (item.score || 4) + "/5 điểm"));
      meta.appendChild(el("span", null, item.category || ""));
      card.appendChild(meta);
      if (item.question) card.appendChild(el("p", { className: "daily-hist-q" }, item.question));
      card.appendChild(el("p", { className: "daily-hist-a" }, item.answer || ""));
      hist.appendChild(card);
    });
  }

  function init() {
    var Daily = window.TimGiaTriDaily;
    if (!Daily) return;

    // Khôi phục giờ nhắc đã chọn
    var savedTime = "";
    try { savedTime = window.localStorage.getItem(REMINDER_TIME_KEY) || ""; } catch (e) {}
    if (/^\d{2}:\d{2}$/.test(savedTime)) {
      $("reminderTimeInput").value = savedTime;
    }

    $("nextPromptBtn").addEventListener("click", function () {
      promptOffset += 1;
      render();
    });

    $("dailyForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var answer = ($("dailyAnswer").value || "").trim();
      if (!answer) {
        $("dailyMsg").textContent = "Hãy viết ít nhất 1 câu ngắn trước khi lưu.";
        return;
      }
      var profile = loadWorkbookProfile();
      var today = new Date();
      var todayKey = Daily.toDateKey(today);
      var p = Daily.getDailyPrompt(today, profile.ranking, profile.antis, promptOffset);

      var logs = loadDailyLogs().filter(function (l) { return l.dateKey !== todayKey; });
      logs.unshift({
        dateKey: todayKey,
        savedAt: today.toISOString(),
        category: p.category,
        question: p.question,
        answer: answer,
        score: selectedScore
      });
      saveDailyLogs(logs);
      $("dailyMsg").textContent = "Đã lưu nhật ký hôm nay! Hẹn gặp lại bạn vào ngày mai để giữ chuỗi.";
      render();
    });

    document.querySelectorAll("[data-preset-time]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var val = btn.getAttribute("data-preset-time");
        $("reminderTimeInput").value = val;
        try { window.localStorage.setItem(REMINDER_TIME_KEY, val); } catch (e) {}
      });
    });

    $("reminderTimeInput").addEventListener("change", function () {
      try { window.localStorage.setItem(REMINDER_TIME_KEY, $("reminderTimeInput").value); } catch (e) {}
    });

    $("downloadDailyIcsBtn").addEventListener("click", function () {
      var parts = ($("reminderTimeInput").value || "20:30").split(":");
      var hour = Number(parts[0]) || 20;
      var minute = Number(parts[1]) || 30;
      var profile = loadWorkbookProfile();
      var cfg = window.TGT_CONFIG || {};
      var ics = Daily.buildDailyReminderIcs({
        hour: hour,
        minute: minute,
        topValues: profile.ranking,
        siteUrl: cfg.siteUrl || window.location.origin
      });
      var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "tim-gia-tri-nhac-hang-ngay.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      $("reminderMsg").textContent = "Đã tải file lịch nhắc hằng ngày lúc " + $("reminderTimeInput").value + ". Mở file này để thêm vào Lịch iPhone hoặc Google Calendar.";
    });

    $("enableNativeNotifBtn").addEventListener("click", function () {
      var parts = ($("reminderTimeInput").value || "20:30").split(":");
      var hour = Number(parts[0]) || 20;
      var minute = Number(parts[1]) || 30;
      var Native = window.TGTNativeReminders;
      if (Native && Native.isNative()) {
        Native.scheduleNativeDaily(hour, minute).then(function () {
          $("reminderMsg").textContent = "Đã bật thông báo hằng ngày trên thiết bị lúc " + $("reminderTimeInput").value + "!";
        }).catch(function (err) {
          $("reminderMsg").textContent = (err && err.message) || "Không thể đặt thông báo thiết bị.";
        });
      } else {
        $("reminderMsg").textContent = "Bạn đang dùng trình duyệt web — hãy bấm “Tải lịch nhắc hằng ngày (.ics)” ở bên trái để iPhone / Android nhắc ổn định mỗi ngày, hoặc cài ứng dụng di động.";
      }
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
