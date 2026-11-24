(function () {
  "use strict";

  function wrapLines(ctx, text, maxWidth, maxLines) {
    var words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var lines = [];
    var current = words[0];
    for (var i = 1; i < words.length; i++) {
      var test = current + " " + words[i];
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
        if (maxLines && lines.length >= maxLines - 1) break;
      }
    }
    lines.push(current);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
    }
    return lines;
  }

  function getBrandDomain() {
    var cfg = window.TGT_CONFIG || {};
    var raw = (cfg.siteUrl || window.location.origin || "timgiatri.vn").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return raw || "timgiatri.vn";
  }

  function renderStoryCanvas(data) {
    var W = 1080;
    var H = 1920;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    // Nền giấy ấm phong cách workbook in ấn
    ctx.fillStyle = "#F7F3EB";
    ctx.fillRect(0, 0, W, H);

    // Khung viền editorial
    ctx.strokeStyle = "#D8CFC0";
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, W - 108, H - 108);

    // Dải nhấn đỏ gạch trên cùng
    ctx.fillStyle = "#A93226";
    ctx.fillRect(54, 54, W - 108, 14);

    // Kicker
    ctx.fillStyle = "#A93226";
    ctx.font = "700 28px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText("TÌM GIÁ TRỊ · BẢN ĐỒ CỐT LÕI", 108, 152);

    // Ngày lập
    ctx.fillStyle = "#6F675C";
    ctx.font = "500 26px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText(data.dateStr || "", 108, 198);

    // Tiêu đề chính
    ctx.fillStyle = "#1D1B18";
    ctx.font = "700 72px 'Noto Serif', Georgia, serif";
    var title = data.name ? ("Top 5 giá trị của " + data.name) : "Top 5 giá trị cốt lõi của tôi";
    var titleLines = wrapLines(ctx, title, W - 216, 2);
    var y = 300;
    titleLines.forEach(function (line) {
      ctx.fillText(line, 108, y);
      y += 86;
    });

    // Đường kẻ ngang
    ctx.strokeStyle = "#A93226";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(108, y - 24);
    ctx.lineTo(240, y - 24);
    ctx.stroke();

    // Danh sách Top 5
    var top5 = (data.ranking || []).slice(0, 5);
    var defs = data.definitions || {};
    var cardY = y + 28;
    var cardH = 188;
    var gap = 24;

    top5.forEach(function (val, idx) {
      ctx.fillStyle = idx === 0 ? "#FFFDF9" : "#FBF8F2";
      ctx.fillRect(108, cardY, W - 216, cardH);

      ctx.strokeStyle = idx === 0 ? "#A93226" : "#DFD7C9";
      ctx.lineWidth = idx === 0 ? 3 : 2;
      ctx.strokeRect(108, cardY, W - 216, cardH);

      // Thanh dọc bên trái
      ctx.fillStyle = idx === 0 ? "#A93226" : "#C9BEB0";
      ctx.fillRect(108, cardY, 10, cardH);

      // Số thứ tự
      ctx.fillStyle = "#A93226";
      ctx.font = "800 34px 'Be Vietnam Pro', system-ui, sans-serif";
      ctx.fillText("#" + (idx + 1), 148, cardY + 66);

      // Tên giá trị
      ctx.fillStyle = "#1D1B18";
      ctx.font = "700 46px 'Noto Serif', Georgia, serif";
      ctx.fillText(val, 224, cardY + 68);

      // Định nghĩa ngắn (nếu có)
      var defText = defs[val] && defs[val].def ? defs[val].def : "";
      if (defText) {
        ctx.fillStyle = "#544D44";
        ctx.font = "400 26px 'Be Vietnam Pro', system-ui, sans-serif";
        var dLines = wrapLines(ctx, "“" + defText + "”", W - 310, 2);
        var dy = cardY + 116;
        dLines.forEach(function (dl) {
          ctx.fillText(dl, 148, dy);
          dy += 36;
        });
      } else {
        ctx.fillStyle = "#7D7468";
        ctx.font = "italic 25px 'Noto Serif', Georgia, serif";
        ctx.fillText(idx === 0 ? "Giá trị dẫn đường số 1" : "Giá trị cốt lõi đã sống", 148, cardY + 124);
      }

      cardY += cardH + gap;
    });

    // Ranh giới đỏ (Anti-values)
    var antis = (data.antis || []).slice(0, 4);
    if (antis.length) {
      var antiY = Math.max(cardY + 24, 1580);
      ctx.fillStyle = "#6F675C";
      ctx.font = "700 24px 'Be Vietnam Pro', system-ui, sans-serif";
      ctx.fillText("ĐIỀU TÔI KHÔNG CHỊU NỔI:", 108, antiY);

      ctx.fillStyle = "#1D1B18";
      ctx.font = "500 28px 'Be Vietnam Pro', system-ui, sans-serif";
      var antiLines = wrapLines(ctx, antis.join("  ·  "), W - 216, 2);
      var ay = antiY + 42;
      antiLines.forEach(function (al) {
        ctx.fillText(al, 108, ay);
        ay += 38;
      });
    }

    // Footer
    ctx.strokeStyle = "#D8CFC0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(108, H - 156);
    ctx.lineTo(W - 108, H - 156);
    ctx.stroke();

    ctx.fillStyle = "#1D1B18";
    ctx.font = "600 28px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText("Tự tìm bản đồ giá trị miễn phí tại:", 108, H - 108);

    ctx.fillStyle = "#A93226";
    ctx.font = "700 28px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText(getBrandDomain(), 108, H - 70);

    return canvas;
  }

  function renderLandscapeCanvas(data) {
    var W = 1200;
    var H = 630;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#F7F3EB";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#D8CFC0";
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    ctx.fillStyle = "#A93226";
    ctx.fillRect(28, 28, 12, H - 56);

    // Cột trái: tiêu đề + trích dẫn
    ctx.fillStyle = "#A93226";
    ctx.font = "700 18px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText("TÌM GIÁ TRỊ · BẢN ĐỒ CỐT LÕI", 76, 94);

    ctx.fillStyle = "#1D1B18";
    ctx.font = "700 44px 'Noto Serif', Georgia, serif";
    var title = data.name ? ("Bản đồ giá trị của " + data.name) : "Bản đồ giá trị cốt lõi của tôi";
    var tLines = wrapLines(ctx, title, 470, 3);
    var ty = 158;
    tLines.forEach(function (line) {
      ctx.fillText(line, 76, ty);
      ty += 56;
    });

    ctx.fillStyle = "#6F675C";
    ctx.font = "500 18px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText(data.dateStr || "", 76, ty + 14);

    var top1 = (data.ranking && data.ranking[0]) || "";
    var top1Def = top1 && data.definitions && data.definitions[top1] ? data.definitions[top1].def : "";
    if (top1Def) {
      ctx.fillStyle = "#4A433A";
      ctx.font = "italic 21px 'Noto Serif', Georgia, serif";
      var qLines = wrapLines(ctx, "“" + top1Def + "”", 470, 4);
      var qy = ty + 68;
      qLines.forEach(function (ql) {
        ctx.fillText(ql, 76, qy);
        qy += 32;
      });
    }

    // Footer cột trái
    ctx.fillStyle = "#A93226";
    ctx.font = "700 19px 'Be Vietnam Pro', system-ui, sans-serif";
    ctx.fillText(getBrandDomain(), 76, H - 64);

    // Cột phải: Top 5
    var top5 = (data.ranking || []).slice(0, 5);
    var rx = 600;
    var rw = 532;
    var ry = 76;
    var rh = 86;
    top5.forEach(function (val, idx) {
      ctx.fillStyle = idx === 0 ? "#FFFDF9" : "#FBF8F2";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = idx === 0 ? "#A93226" : "#DFD7C9";
      ctx.lineWidth = idx === 0 ? 2.5 : 1.5;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = "#A93226";
      ctx.font = "800 22px 'Be Vietnam Pro', system-ui, sans-serif";
      ctx.fillText("#" + (idx + 1), rx + 22, ry + 52);

      ctx.fillStyle = "#1D1B18";
      ctx.font = "700 28px 'Noto Serif', Georgia, serif";
      ctx.fillText(val, rx + 76, ry + 53);

      ry += rh + 14;
    });

    return canvas;
  }

  function download(format, data) {
    var canvas = format === "landscape" ? renderLandscapeCanvas(data) : renderStoryCanvas(data);
    var a = document.createElement("a");
    var suffix = format === "landscape" ? "facebook-16x9" : "story-9x16";
    a.download = "ban-do-gia-tri-" + suffix + ".png";
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (window.TGTAnalytics) {
      window.TGTAnalytics.track("share_card_download", 8, { format: format });
    }
  }

  window.TGTShareCard = {
    download: download
  };
})();
