(function(){
  "use strict";

  var VALUES = ["Tự do","Gia đình","Sức khỏe","Trung thực","Chính trực","Chân thành","Sáng tạo","Học hỏi","Bình an","Yêu thương","Tôn trọng","Công bằng","Trách nhiệm","Dũng cảm","Kiên nhẫn","Biết ơn","Hài hước","Phiêu lưu","An toàn","Thành tựu","Cống hiến","Cộng đồng","Độc lập","Lòng trắc ẩn","Xuất sắc","Giản dị","Kết nối","Tự chủ","Trưởng thành","Niềm vui","Sâu sắc","Tha thứ","Tò mò","Kỷ luật","Linh hoạt","Tin cậy","Hào phóng","Đam mê","Cân bằng","Trí tuệ","Ảnh hưởng","Tự tin","Khiêm tốn","Tử tế","Minh bạch","Thẳng thắn","Gắn kết","Khám phá"];
  var ANTIS = ["Bị kiểm soát","Bất công","Giả dối","Bị phản bội","Nhàm chán","Bị coi thường","Hỗn loạn","Bị bỏ rơi","Phải tuân thủ mù quáng","Bị phán xét","Cô lập","Bất lực","Lãng phí thời gian","Bị lợi dụng","Thiển cận","Bị ép buộc","Thiếu tôn trọng","Bị lãng quên"];
  var VERIFY = [
    {q:"Những giá trị này có khiến bạn thấy tốt về bản thân không?", s:"Danh sách đúng thường đi kèm cảm giác nhẹ nhõm, “đúng là mình”."},
    {q:"Bạn có tự hào về top 3 của mình không?", s:"Nếu phải giấu top 3 đi, có thể chúng chưa phải giá trị thật — hoặc bạn đang sợ ánh nhìn của người khác hơn là sợ sống sai mình."},
    {q:"Bạn có thoải mái kể chúng cho một người bạn tôn trọng không?", s:"Không cần kể cho cả thế giới — chỉ cần không thấy xấu hổ khi nói ra trước người mình nể."},
    {q:"Bạn có giữ chúng ngay cả khi mình là thiểu số không?", s:"Giá trị thật là thứ bạn vẫn giữ khi nó làm bạn khác biệt, thậm chí tốn kém."},
    {q:"Đọc lại danh sách, bạn có thấy hào hứng không?", s:"Nếu cảm giác là “nhạt”, phẳng lặng — đó là dấu hiệu nên quay lại bước 1 và 3."}
  ];

  var state = {
    step: 1,
    selected: [],        // chosen values (strings)
    classify: {},        // value -> 'song' | 'khat-vong' | 'nen-co'
    antis: [],
    pairs: [],
    pairIdx: 0,
    scores: {},
    ranking: [],
    verify: {},          // idx -> true/false
    copyMsg: ""
  };

  var $ = function(id){ return document.getElementById(id); };
  var panels = document.querySelectorAll(".wiz-panel");
  var stepNames = ["Trải nghiệm","Đặt tên","Lọc giá trị thật","Không chịu nổi","Xếp hạng","Kiểm chứng","Viết & hành động","Bản đồ của bạn"];

  /* ---------- Stepper header ---------- */
  var wizSteps = $("wizSteps");
  stepNames.forEach(function(n, i){
    var d = document.createElement("span");
    d.className = "wiz-dot"; d.textContent = (i+1) + ". " + n; d.id = "wizDot" + (i+1);
    wizSteps.appendChild(d);
  });

  function renderStepper(){
    stepNames.forEach(function(_, i){
      var d = $("wizDot" + (i+1));
      d.classList.toggle("active", state.step === i+1);
      d.classList.toggle("done", state.step > i+1);
    });
    $("wizProgressBar").style.width = (state.step / 8 * 100) + "%";
    $("wizProgress").setAttribute("aria-valuenow", state.step);
    $("wizBack").style.visibility = state.step === 1 ? "hidden" : "visible";
    $("wizNext").textContent = state.step === 7 ? "Xem bản đồ giá trị →" : (state.step === 8 ? "Làm lại từ đầu ↺" : "Tiếp tục →");
  }

  function showStep(n, noScroll){
    state.step = n;
    panels.forEach(function(p){ p.classList.toggle("active", +p.dataset.panel === n); });
    setMsg("");
    if (n === 3) renderFilter();
    if (n === 5) renderDuelIntro();
    if (n === 6) renderVerify();
    if (n === 7) renderDefine();
    if (n === 8) renderResult();
    renderStepper();
    saveProgress();
    if (!noScroll){
      var wizEl = document.getElementById("wizard");
      if (wizEl && typeof wizEl.scrollIntoView === "function") wizEl.scrollIntoView({behavior:"smooth", block:"start"});
    }
  }

  function setMsg(text, ok){
    var m = $("wizMsg");
    m.textContent = text || "";
    m.classList.toggle("ok", !!ok);
  }

  /* ---------- Step 1: experiences ---------- */
  var expAreas = document.querySelectorAll("[data-exp]");
  function filledExps(){
    var c = 0;
    expAreas.forEach(function(t){ if (t.value.trim().length >= 10) c++; });
    return c;
  }
  expAreas.forEach(function(t){
    t.addEventListener("input", function(){
      $("fillCount").innerHTML = "Bạn đã viết <strong>" + filledExps() + " / 6</strong> khoảnh khắc." + (filledExps() >= 3 ? " Đủ để đi tiếp — viết thêm được ô nào, kết quả càng thật ô đó." : "");
      saveProgress();
    });
  });

  /* ---------- Step 2: value bank ---------- */
  var bank = $("valueBank");
  function makeChip(text, listEl, isAnti){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (isAnti ? " anti" : "");
    b.textContent = text;
    b.setAttribute("aria-label", (isAnti ? "Chọn điều không chịu nổi: " : "Chọn giá trị: ") + text);
    b.setAttribute("aria-pressed", "false");
    b.dataset.value = text;
    b.addEventListener("click", function(){
      var arr = isAnti ? state.antis : state.selected;
      var idx = arr.indexOf(text);
      if (idx >= 0){ arr.splice(idx, 1); b.setAttribute("aria-pressed","false"); }
      else {
        if (!isAnti && arr.length >= 15){ setMsg("Bạn đã chọn 15 từ — đủ rộng rồi. Hãy bỏ bớt từ kém vang hơn trước khi thêm từ mới."); return; }
        arr.push(text); b.setAttribute("aria-pressed","true");
      }
      if (!isAnti) updateBankCount();
      if (state.step === 2 || state.step === 4) setMsg("");
      saveProgress();
    });
    listEl.appendChild(b);
    return b;
  }
  VALUES.forEach(function(v){ makeChip(v, bank, false); });
  function updateBankCount(){ $("bankCount").textContent = "Đã chọn " + state.selected.length + " / 15"; }
  updateBankCount();

  $("bankSearch").addEventListener("input", function(){
    var q = this.value.trim().toLowerCase();
    bank.querySelectorAll(".chip").forEach(function(c){
      c.style.display = (!q || c.dataset.value.toLowerCase().indexOf(q) >= 0) ? "" : "none";
    });
  });

  function addCustomValue(inputId, bankEl, isAnti){
    var inp = $(inputId);
    var v = inp.value.trim();
    if (!v) return;
    v = v.charAt(0).toUpperCase() + v.slice(1);
    var exists = false;
    bankEl.querySelectorAll(".chip").forEach(function(c){ if (c.dataset.value.toLowerCase() === v.toLowerCase()) exists = c; });
    if (exists){ exists.click(); if (exists.getAttribute("aria-pressed") !== "true") exists.click(); inp.value=""; return; }
    var chip = makeChip(v, bankEl, isAnti);
    chip.click();
    inp.value = "";
  }
  $("addCustom").addEventListener("click", function(){ addCustomValue("customValue", bank, false); });
  $("customValue").addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); $("addCustom").click(); } });

  /* ---------- Step 4: anti bank ---------- */
  var antiBank = $("antiBank");
  ANTIS.forEach(function(a){ makeChip(a, antiBank, true); });
  $("addCustomAnti").addEventListener("click", function(){ addCustomValue("customAnti", antiBank, true); });
  $("customAnti").addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); $("addCustomAnti").click(); } });

  /* ---------- Step 3: filter ---------- */
  var CLASS_OPTIONS = [
    {key:"song", label:"✓ Đã sống — có bằng chứng"},
    {key:"khat-vong", label:"Khát vọng — muốn có, chưa sống"},
    {key:"nen-co", label:"“Nên có” — được dạy phải thế"}
  ];
  function livedValues(){ return state.selected.filter(function(v){ return state.classify[v] === "song"; }); }

  function renderFilter(){
    var list = $("filterList");
    list.innerHTML = "";
    if (!state.selected.length){
      list.innerHTML = '<div class="empty-note">Bạn chưa chọn giá trị nào ở bước 2. Hãy quay lại bước 2 và chọn ít nhất 5 từ vang lên với bạn.</div>';
      $("livedCount").textContent = "";
      return;
    }
    state.selected.forEach(function(v){
      var row = document.createElement("div");
      row.className = "filter-row";
      var name = document.createElement("div");
      name.className = "vname"; name.textContent = v;
      var seg = document.createElement("div");
      seg.className = "seg"; seg.setAttribute("role","group"); seg.setAttribute("aria-label","Phân loại " + v);
      CLASS_OPTIONS.forEach(function(opt){
        var b = document.createElement("button");
        b.type = "button"; b.textContent = opt.label;
        b.setAttribute("aria-pressed", state.classify[v] === opt.key ? "true" : "false");
        b.addEventListener("click", function(){
          state.classify[v] = opt.key;
          seg.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed","false"); });
          b.setAttribute("aria-pressed","true");
          updateLivedCount(); setMsg("");
          state.pairs = []; state.ranking = [];
          saveProgress();
        });
        seg.appendChild(b);
      });
      row.appendChild(name); row.appendChild(seg);
      list.appendChild(row);
    });
    updateLivedCount();
  }
  function updateLivedCount(){
    var lived = livedValues().length;
    var unclassified = state.selected.filter(function(v){ return !state.classify[v]; }).length;
    $("livedCount").innerHTML = "Đang có <strong>" + lived + " giá trị “đã sống”</strong> sẽ vào vòng xếp hạng (lý tưởng 5–8)." + (unclassified ? " Còn " + unclassified + " giá trị chưa phân loại." : "");
  }

  /* ---------- Step 5: pairwise ---------- */
  function buildPairs(){
    var vals = livedValues();
    state.scores = {};
    vals.forEach(function(v){ state.scores[v] = 0; });
    state.pairs = [];
    for (var i = 0; i < vals.length; i++)
      for (var j = i + 1; j < vals.length; j++)
        state.pairs.push([vals[i], vals[j]]);
    state.pairIdx = 0;
    state.ranking = [];
  }
  function renderDuelIntro(){
    var zone = $("duelZone");
    var lived = livedValues();
    if (lived.length < 3){
      zone.innerHTML = '<div class="empty-note">Cần ít nhất 3 giá trị “đã sống” để xếp hạng. Hãy quay lại bước 3 và phân loại thêm — trung thực nhé: giá trị nào bạn thực sự đã có bằng chứng trong đời?</div>';
      return;
    }
    if (!state.pairs.length || state.pairIdx >= state.pairs.length) buildPairs();
    renderDuel();
  }
  function renderDuel(){
    var zone = $("duelZone");
    if (state.pairIdx >= state.pairs.length){ finishDuel(); return; }
    var pair = state.pairs[state.pairIdx];
    zone.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "duel-wrap";
    var count = document.createElement("p");
    count.className = "duel-count";
    count.textContent = "Cặp " + (state.pairIdx + 1) + " / " + state.pairs.length;
    var q = document.createElement("p");
    q.className = "duel-q";
    q.textContent = "Nếu chỉ được thỏa mãn một trong hai, bạn chọn…";
    var duel = document.createElement("div");
    duel.className = "duel";
    [pair[0], null, pair[1]].forEach(function(item){
      if (item === null){
        var vs = document.createElement("div"); vs.className = "duel-vs"; vs.textContent = "hay"; duel.appendChild(vs);
      } else {
        var b = document.createElement("button");
        b.type = "button"; b.className = "duel-btn"; b.textContent = item;
        b.setAttribute("aria-label", "Chọn " + item + " thay vì " + (item === pair[0] ? pair[1] : pair[0]));
        b.addEventListener("click", function(){
          state.scores[item]++;
          state.pairIdx++;
          saveProgress();
          renderDuel();
        });
        duel.appendChild(b);
      }
    });
    var note = document.createElement("p");
    note.className = "duel-note";
    note.textContent = "Chọn đáp án bật ra đầu tiên. Không có đáp án đúng — chỉ có đáp án thật. Dùng phím Tab để di chuyển, Enter để chọn.";
    wrap.appendChild(count); wrap.appendChild(q); wrap.appendChild(duel); wrap.appendChild(note);
    zone.appendChild(wrap);
  }
  function finishDuel(){
    state.ranking = livedValues().slice().sort(function(a, b){
      if (state.scores[b] !== state.scores[a]) return state.scores[b] - state.scores[a];
      return livedValues().indexOf(a) - livedValues().indexOf(b);
    });
    saveProgress();
    var zone = $("duelZone");
    zone.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "duel-wrap";
    var t = document.createElement("p");
    t.className = "duel-q";
    t.textContent = "Xong! Trực giác của bạn đã xếp xong. Bấm “Tiếp tục” để kiểm chứng bảng xếp hạng này.";
    var ol = document.createElement("p");
    ol.style.fontWeight = "700"; ol.style.fontSize = "1.05rem";
    ol.textContent = state.ranking.join("  ·  ");
    var redo = document.createElement("button");
    redo.type = "button"; redo.className = "btn btn-ghost btn-small"; redo.style.marginTop = "16px";
    redo.textContent = "↺ So lại từ đầu";
    redo.addEventListener("click", function(){ buildPairs(); renderDuel(); });
    wrap.appendChild(t); wrap.appendChild(ol); wrap.appendChild(redo);
    zone.appendChild(wrap);
  }

  /* ---------- Step 6: verify ---------- */
  function currentRanking(){
    if (state.ranking.length) return state.ranking;
    return livedValues();
  }
  function renderVerify(){
    var rank = currentRanking();
    var preview = $("rankPreview");
    preview.innerHTML = "";
    if (rank.length){
      var box = document.createElement("div");
      box.className = "tip-box"; box.style.margin = "0 0 20px";
      box.innerHTML = "<strong>Bảng xếp hạng hiện tại của bạn</strong>" + rank.map(function(v, i){ return (i+1) + ". " + v; }).join(" &nbsp;·&nbsp; ");
      preview.appendChild(box);
    }
    var list = $("verifyList");
    list.innerHTML = "";
    VERIFY.forEach(function(item, idx){
      var row = document.createElement("div");
      row.className = "verify-row";
      var txt = document.createElement("div");
      var p = document.createElement("p"); p.textContent = item.q;
      var s = document.createElement("small"); s.textContent = item.s;
      txt.appendChild(p); txt.appendChild(s);
      var seg = document.createElement("div");
      seg.className = "seg";
      [["true","Đúng với tôi"],["false","Chưa chắc"]].forEach(function(opt){
        var isTrue = opt[0] === "true";
        var b = document.createElement("button");
        b.type = "button"; b.textContent = opt[1];
        b.setAttribute("aria-pressed", state.verify[idx] === isTrue ? "true" : "false");
        b.addEventListener("click", function(){
          state.verify[idx] = isTrue;
          seg.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed","false"); });
          b.setAttribute("aria-pressed","true");
          setMsg("");
          saveProgress();
        });
        seg.appendChild(b);
      });
      row.appendChild(txt); row.appendChild(seg);
      list.appendChild(row);
    });
  }

  /* ---------- Step 7: define ---------- */
  var definitions = {}; // value -> {def, act}
  function renderDefine(){
    var rank = currentRanking().slice(0, 5);
    var list = $("defineList");
    list.innerHTML = "";
    if (!rank.length){
      list.innerHTML = '<div class="empty-note">Chưa có bảng xếp hạng. Hãy hoàn thành bước 5 trước.</div>';
      return;
    }
    rank.forEach(function(v, i){
      if (!definitions[v]) definitions[v] = {def:"", act:""};
      var card = document.createElement("div");
      card.className = "define-card";
      var line = document.createElement("div");
      line.className = "rank-line";
      line.innerHTML = '<span class="rank-num">#' + (i+1) + '</span>';
      var h = document.createElement("h4"); h.textContent = v;
      line.appendChild(h);
      var l1 = document.createElement("label");
      l1.textContent = "“" + v + "” với tôi nghĩa là…";
      l1.setAttribute("for", "def-" + i);
      var ta = document.createElement("textarea");
      ta.id = "def-" + i;
      ta.placeholder = "Ví dụ: sống với đầy đủ sinh lực và năng lượng mỗi ngày…";
      ta.value = definitions[v].def;
      ta.addEventListener("input", function(){ definitions[v].def = ta.value; saveProgress(); });
      var l2 = document.createElement("label");
      l2.textContent = "Bài tập 100% — một điều phải khác đi, làm trong tuần này:";
      l2.setAttribute("for", "act-" + i);
      var inp = document.createElement("input");
      inp.type = "text"; inp.id = "act-" + i;
      inp.placeholder = "Ví dụ: chặn 30 phút đi bộ vào lịch, 5 buổi tuần này";
      inp.value = definitions[v].act;
      inp.addEventListener("input", function(){ definitions[v].act = inp.value; saveProgress(); });
      card.appendChild(line); card.appendChild(l1); card.appendChild(ta); card.appendChild(l2); card.appendChild(inp);
      list.appendChild(card);
    });
  }

  /* ---------- Step 8: result ---------- */
  function expText(){
    var labels = {"exp-happy":"Khoảnh khắc hạnh phúc / tự hào nhất","exp-regret":"Điều hối tiếc nhất","exp-empty":"Lúc thất vọng / trống rỗng nhất","exp-flow":"Hoạt động quên thời gian","exp-admire":"Người tôi ngưỡng mộ","exp-help":"Việc người khác hay nhờ tôi"};
    var out = [];
    Object.keys(labels).forEach(function(id){
      var el = $(id);
      if (el && el.value.trim()) out.push({label: labels[id], text: el.value.trim()});
    });
    return out;
  }
  function buildSummaryText(){
    var rank = currentRanking();
    var lines = [];
    lines.push("BẢN ĐỒ GIÁ TRỊ CỐT LÕI CỦA TÔI");
    lines.push("================================");
    lines.push("");
    lines.push("GIÁ TRỊ XẾP HẠNG (theo trực giác, qua so từng cặp):");
    rank.forEach(function(v, i){
      var d = definitions[v] || {def:"", act:""};
      lines.push((i+1) + ". " + v.toUpperCase());
      if (d.def) lines.push("   Với tôi nghĩa là: " + d.def);
      if (d.act) lines.push("   Hành động tuần này: " + d.act);
    });
    var asp = state.selected.filter(function(v){ return state.classify[v] === "khat-vong"; });
    if (asp.length){ lines.push(""); lines.push("GIÁ TRỊ KHÁT VỌNG (muốn hướng tới, chưa phải giá trị đang điều khiển tôi): " + asp.join(", ")); }
    if (state.antis.length){ lines.push(""); lines.push("NHỮNG ĐIỀU TÔI KHÔNG CHỊU NỔI: " + state.antis.join(", ")); }
    var exps = expText();
    if (exps.length){
      lines.push(""); lines.push("BẰNG CHỨNG SỐNG CỦA TÔI:");
      exps.forEach(function(e){ lines.push("- " + e.label + ": " + e.text); });
    }
    lines.push("");
    lines.push("Nhắc mình: soi lại sau 24 giờ, rồi hằng tháng. Đừng hỏi “mình muốn trở thành người thế nào?” — hãy hỏi “đời mình đã chứng minh mình là người thế nào?”");
    return lines.join("\n");
  }
  function renderResult(){
    var rank = currentRanking();
    var zone = $("resultZone");
    zone.innerHTML = "";
    var hero = document.createElement("div");
    hero.className = "result-hero";
    hero.innerHTML = "<h4>Top " + Math.min(5, rank.length) + " giá trị dẫn đường của bạn</h4><p>Thứ tự này là thứ tự ưu tiên khi đời buộc bạn phải chọn — không phải mức độ “tốt xấu”. " + (rank.length >= 2 ? "Giá trị xếp cuối bảng này vẫn là một phần cốt lõi của bạn." : "") + "</p>";
    zone.appendChild(hero);
    var ol = document.createElement("ol");
    ol.className = "result-list";
    rank.slice(0, 5).forEach(function(v, i){
      var d = definitions[v] || {def:"", act:""};
      var li = document.createElement("li");
      var num = document.createElement("div"); num.className = "rnum"; num.textContent = i + 1;
      var body = document.createElement("div");
      var name = document.createElement("div"); name.className = "rname"; name.textContent = v;
      body.appendChild(name);
      if (d.def){ var def = document.createElement("div"); def.className = "rdef"; def.textContent = "“" + d.def + "”"; body.appendChild(def); }
      if (d.act){ var act = document.createElement("div"); act.className = "ract"; act.innerHTML = "<strong>Tuần này:</strong> "; act.appendChild(document.createTextNode(d.act)); body.appendChild(act); }
      li.appendChild(num); li.appendChild(body);
      ol.appendChild(li);
    });
    zone.appendChild(ol);
    if (rank.length > 5){
      var rest = document.createElement("div");
      rest.className = "result-block";
      rest.innerHTML = "<h4>Cũng rất quan trọng với bạn</h4><p>" + rank.slice(5).join(" · ") + "</p>";
      zone.appendChild(rest);
    }
    if (state.antis.length){
      var ab = document.createElement("div");
      ab.className = "result-block";
      ab.innerHTML = "<h4>Những điều bạn không chịu nổi — bản đồ ngược của giá trị</h4>";
      var ul = document.createElement("ul");
      state.antis.forEach(function(a){ var li = document.createElement("li"); li.textContent = a; ul.appendChild(li); });
      ab.appendChild(ul);
      zone.appendChild(ab);
    }
    var asp = state.selected.filter(function(v){ return state.classify[v] === "khat-vong"; });
    if (asp.length){
      var aspB = document.createElement("div");
      aspB.className = "result-block";
      aspB.innerHTML = "<h4>Giá trị khát vọng — để ngắm, chưa để dẫn đường</h4><p>" + asp.join(" · ") + ". Đây là hướng bạn muốn lớn lên tới, nhưng hiện tại chúng chưa điều khiển quyết định của bạn. Đừng để chúng che mất bảng giá trị thật ở trên.</p>";
      zone.appendChild(aspB);
    }
    var actions = document.createElement("div");
    actions.className = "result-actions";
    var copyBtn = document.createElement("button");
    copyBtn.type = "button"; copyBtn.className = "btn btn-primary btn-small"; copyBtn.textContent = "Sao chép bản tổng kết";
    var okSpan = document.createElement("span"); okSpan.className = "copy-ok"; okSpan.id = "copyOk";
    copyBtn.addEventListener("click", function(){
      var text = buildSummaryText();
      function done(){ okSpan.textContent = "Đã sao chép ✓ Dán vào ghi chú của bạn để giữ lại."; }
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done, function(){ fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
    var dlBtn = document.createElement("button");
    dlBtn.type = "button"; dlBtn.className = "btn btn-accent btn-small"; dlBtn.textContent = "Tải về (.txt)";
    dlBtn.addEventListener("click", function(){
      var blob = new Blob([buildSummaryText()], {type: "text/plain;charset=utf-8"});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "ban-do-gia-tri-cua-toi.txt";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    });
    var printBtn = document.createElement("button");
    printBtn.type = "button"; printBtn.className = "btn btn-ghost btn-small"; printBtn.textContent = "In bản tổng kết";
    printBtn.setAttribute("aria-label", "In bản đồ giá trị của bạn");
    printBtn.addEventListener("click", function(){ window.print(); });
    actions.appendChild(copyBtn); actions.appendChild(dlBtn); actions.appendChild(printBtn); actions.appendChild(okSpan);
    zone.appendChild(actions);
  }
  function fallbackCopy(text){
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(e) {}
    document.body.removeChild(ta);
  }

  /* ---------- Persistence: localStorage, this browser only, never sent anywhere ---------- */
  var STORAGE_KEY = "tim-gia-tri-v1";
  var isRestarting = false;

  function saveProgress(manual){
    if (isRestarting) return;
    try {
      var exps = {};
      expAreas.forEach(function(ta){ if (ta.value.trim()) exps[ta.id] = ta.value; });
      var data = {
        version: 1,
        savedAt: new Date().toISOString(),
        step: state.step,
        exps: exps,
        selected: state.selected,
        customValues: state.selected.filter(function(v){ return VALUES.indexOf(v) < 0; }),
        classify: state.classify,
        antis: state.antis,
        customAntis: state.antis.filter(function(v){ return ANTIS.indexOf(v) < 0; }),
        pairs: state.pairs,
        pairIdx: state.pairIdx,
        scores: state.scores,
        ranking: state.ranking,
        verify: state.verify,
        definitions: definitions
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      var timeStr = new Date().toLocaleTimeString("vi-VN", {hour: "2-digit", minute: "2-digit"});
      var status = $("saveStatus");
      if (status) status.textContent = "Đã tự lưu lúc " + timeStr + " trên trình duyệt này — đóng trang rồi quay lại sau vẫn tiếp tục được.";
      if (manual) setMsg("Đã lưu lúc " + timeStr + ". Bạn có thể đóng trang và quay lại sau trên cùng trình duyệt và thiết bị này.", true);
    } catch(e){ /* private mode / storage full: the journey still works, it just is not saved */ }
  }

  function loadSaved(){
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || d.version !== 1 || !Array.isArray(d.selected)) return null;
      return d;
    } catch(e){ return null; }
  }

  function restoreSaved(d){
    var isStr = function(v){ return typeof v === "string" && v.length > 0; };
    state.selected = d.selected.filter(isStr);
    state.classify = d.classify || {};
    state.antis = Array.isArray(d.antis) ? d.antis.filter(isStr) : [];
    state.pairs = Array.isArray(d.pairs) ? d.pairs : [];
    state.pairIdx = typeof d.pairIdx === "number" ? d.pairIdx : 0;
    state.scores = d.scores || {};
    state.ranking = Array.isArray(d.ranking) ? d.ranking : [];
    state.verify = d.verify || {};
    if (d.definitions) Object.keys(d.definitions).forEach(function(k){ definitions[k] = d.definitions[k]; });
    (d.customValues || []).forEach(function(v){ if (VALUES.indexOf(v) < 0) makeChip(v, bank, false); });
    (d.customAntis || []).forEach(function(v){ if (ANTIS.indexOf(v) < 0) makeChip(v, antiBank, true); });
    bank.querySelectorAll(".chip").forEach(function(c){
      c.setAttribute("aria-pressed", state.selected.indexOf(c.dataset.value) >= 0 ? "true" : "false");
    });
    antiBank.querySelectorAll(".chip").forEach(function(c){
      c.setAttribute("aria-pressed", state.antis.indexOf(c.dataset.value) >= 0 ? "true" : "false");
    });
    updateBankCount();
    if (d.exps) Object.keys(d.exps).forEach(function(id){ var el = $(id); if (el) el.value = d.exps[id]; });
    $("fillCount").innerHTML = "Bạn đã viết <strong>" + filledExps() + " / 6</strong> khoảnh khắc." + (filledExps() >= 3 ? " Đủ để đi tiếp — viết thêm được ô nào, kết quả càng thật ô đó." : "");
    if (d.savedAt){
      var dt = new Date(d.savedAt);
      if (!isNaN(dt.getTime())){
        var s = $("saveStatus");
        if (s) s.textContent = "Đã khôi phục tiến trình lưu lúc " + dt.toLocaleString("vi-VN", {hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric"}) + " trên trình duyệt này.";
      }
    }
    return true;
  }

  /* ---------- Navigation & validation ---------- */
  function validateStep(n){
    if (n === 1){
      if (filledExps() < 3) return "Hãy viết ít nhất 3 trong 6 khoảnh khắc trước khi đi tiếp — viết cụ thể một chút, đừng viết chung chung. Đây là dữ liệu gốc cho mọi bước sau.";
      return "";
    }
    if (n === 2){
      if (state.selected.length < 5) return "Hãy chọn ít nhất 5 giá trị vang lên với bạn (hiện mới chọn " + state.selected.length + "). Chọn rộng tay — bước sau sẽ lọc.";
      if (state.selected.length > 15) return "Tối đa 15 giá trị ở bước này thôi.";
      return "";
    }
    if (n === 3){
      var un = state.selected.filter(function(v){ return !state.classify[v]; });
      if (un.length) return "Còn " + un.length + " giá trị chưa phân loại: " + un.join(", ") + ". Phân loại hết rồi mới đi tiếp được.";
      var lived = livedValues().length;
      if (lived < 3) return "Cần ít nhất 3 giá trị “đã sống” để xếp hạng. Nhìn lại các khát vọng của bạn: có giá trị nào bạn thực ra đã có bằng chứng trong đời rồi không?";
      if (lived > 8) return "Bạn có " + lived + " giá trị “đã sống” — hơi nhiều để so cặp (" + (lived*(lived-1)/2) + " cặp). Hãy chuyển bớt những giá trị kém trung tâm hơn sang “khát vọng” để còn tối đa 8.";
      return "";
    }
    if (n === 4){
      if (!state.antis.length) return "Chọn ít nhất 1 điều bạn không chịu nổi — hoặc bấm Tiếp tục lần nữa nếu bạn muốn bỏ qua bước này.";
      return "";
    }
    if (n === 5){
      if (state.pairIdx < state.pairs.length) return "Hãy so hết các cặp đã — còn " + (state.pairs.length - state.pairIdx) + " cặp. Chọn nhanh bằng trực giác thôi.";
      return "";
    }
    if (n === 6){
      var answered = Object.keys(state.verify).length;
      if (answered < VERIFY.length) return "Trả lời cả 5 câu kiểm chứng nhé (mới " + answered + "/5). “Chưa chắc” cũng là một câu trả lời hợp lệ.";
      var nos = Object.keys(state.verify).filter(function(k){ return !state.verify[k]; }).length;
      if (nos >= 3 && !validateStep._warned6){ validateStep._warned6 = true; return "Có " + nos + "/5 câu là “Chưa chắc” — dấu hiệu danh sách chưa thật. Bạn có thể quay lại bước 1–3 làm lại, hoặc bấm Tiếp tục lần nữa để đi tiếp với danh sách hiện tại."; }
      return "";
    }
    if (n === 7){
      var rank = currentRanking().slice(0, 5);
      var doneDef = rank.filter(function(v){ return definitions[v] && definitions[v].def.trim().length >= 5; }).length;
      if (doneDef < Math.min(3, rank.length)) return "Hãy viết câu định nghĩa cho ít nhất " + Math.min(3, rank.length) + " giá trị đầu (hiện " + doneDef + "). Một từ đơn độc rất dễ quên — câu của riêng bạn mới giữ nó sống.";
      return "";
    }
    return "";
  }
  var antiSkipArmed = false;

  $("wizNext").addEventListener("click", function(){
    if (state.step === 8){
      if (window.confirm("Bắt đầu lại sẽ xóa toàn bộ những gì bạn đã viết và chọn trong hành trình này trên trình duyệt này. Bạn chắc chắn chứ?")){
        isRestarting = true;
        try { window.localStorage.removeItem(STORAGE_KEY); } catch(e){}
        location.reload();
      }
      return;
    }
    if (state.step === 4 && !state.antis.length && !antiSkipArmed){
      antiSkipArmed = true;
      setMsg("Chưa chọn điều nào. Bấm “Tiếp tục” lần nữa để bỏ qua — nhưng phần này thường cho manh mối mạnh nhất đấy.");
      return;
    }
    var err = validateStep(state.step);
    if (err){ setMsg(err); return; }
    antiSkipArmed = false;
    showStep(state.step + 1);
  });
  $("wizBack").addEventListener("click", function(){
    if (state.step > 1) showStep(state.step - 1);
  });

  /* ---------- Save / Restart buttons + restore on load ---------- */
  $("saveBtn").addEventListener("click", function(){ saveProgress(true); });
  $("restartBtn").addEventListener("click", function(){
    if (window.confirm("Bắt đầu lại sẽ xóa toàn bộ những gì bạn đã viết và chọn trong hành trình này trên trình duyệt này. Bạn chắc chắn chứ?")){
      isRestarting = true;
      try { window.localStorage.removeItem(STORAGE_KEY); } catch(e){}
      location.reload();
    }
  });
  window.addEventListener("beforeunload", function(){ saveProgress(); });

  (function(){
    var saved = loadSaved();
    if (saved && restoreSaved(saved)){
      var step = (saved.step >= 1 && saved.step <= 8) ? saved.step : 1;
      showStep(step, true);
      if (saved.savedAt){
        var rdt = new Date(saved.savedAt);
        if (!isNaN(rdt.getTime())){
          var rs = $("saveStatus");
          if (rs) rs.textContent = "Đã khôi phục tiến trình lưu lúc " + rdt.toLocaleString("vi-VN", {hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric"}) + " trên trình duyệt này.";
        }
      }
      return;
    }
  })();

  renderStepper();
})();
