(function () {
  "use strict";

  var Core = window.TimGiaTriCore;
  if (!Core) return;

  var STORAGE_KEY = "tim-gia-tri-v1";
  var THEME_KEY = "tim-gia-tri-theme";
  var LIMITS = Core.LIMITS;

  var state = {
    step: 1,
    maxStepReached: 1,
    selected: [],
    classify: {},
    antis: [],
    pairs: [],
    pairIdx: 0,
    pairHistory: [],
    pairsSig: "",
    scores: {},
    ranking: [],
    verify: {},
    definitions: {}
  };

  var antiSkipArmed = false;
  var verifyWarned = false;
  var isRestarting = false;
  var saveTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var panels = document.querySelectorAll(".wiz-panel");
  var expAreas = document.querySelectorAll("[data-exp]");

  /* ---------- Safe DOM helper ---------- */
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "textContent") node.textContent = attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  /* ---------- Theme toggle (light / dark, defaults to OS preference) ---------- */
  (function initTheme() {
    var toggleBtn = $("themeToggle");
    var root = document.documentElement;
    var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function getSystemTheme() {
      return mql && mql.matches ? "dark" : "light";
    }

    function applyTheme(pref) {
      var effective = pref === "dark" || pref === "light" ? pref : getSystemTheme();
      if (pref === "dark" || pref === "light") {
        root.setAttribute("data-theme", pref);
      } else {
        root.removeAttribute("data-theme");
      }
      if (toggleBtn) {
        var isDark = effective === "dark";
        toggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
        toggleBtn.textContent = isDark ? "Chế độ sáng" : "Chế độ tối";
        toggleBtn.setAttribute("aria-label", isDark ? "Chuyển sang giao diện nền sáng" : "Chuyển sang giao diện nền tối");
      }
    }

    var savedTheme = null;
    try { savedTheme = window.localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(savedTheme);

    if (mql && typeof mql.addEventListener === "function") {
      mql.addEventListener("change", function () {
        var current = null;
        try { current = window.localStorage.getItem(THEME_KEY); } catch (e) {}
        if (!current) applyTheme(null);
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var currentEffective = root.getAttribute("data-theme") || getSystemTheme();
        var next = currentEffective === "dark" ? "light" : "dark";
        try { window.localStorage.setItem(THEME_KEY, next); } catch (e) {}
        applyTheme(next);
      });
    }
  })();

  /* ---------- Quicknav Scroll-Spy ---------- */
  (function initScrollSpy() {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".quicknav a[href^='#']"));
    if (!navLinks.length || typeof IntersectionObserver !== "function") return;

    var linkById = {};
    var sections = [];
    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var sec = $(id);
      if (sec) {
        linkById[id] = link;
        sections.push(sec);
      }
    });

    function setActive(id) {
      navLinks.forEach(function (a) {
        var isCurrent = a === linkById[id];
        a.classList.toggle("is-current", isCurrent);
        if (isCurrent) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });

    sections.forEach(function (sec) { observer.observe(sec); });
  })();

  /* ---------- Core State Helpers ---------- */
  function livedValues() {
    return state.selected.filter(function (v) { return state.classify[v] === "song"; });
  }

  function currentRanking() {
    var lived = livedValues();
    var sig = Core.valuesSignature(lived);
    if (state.ranking.length && state.pairsSig === sig) {
      return state.ranking;
    }
    return lived;
  }

  function syncLivedState() {
    var lived = livedValues();
    var sig = Core.valuesSignature(lived);
    if (state.pairsSig && state.pairsSig !== sig) {
      state.pairs = [];
      state.pairIdx = 0;
      state.pairHistory = [];
      state.scores = {};
      state.ranking = [];
      state.pairsSig = "";
      verifyWarned = false;
    }
  }

  function getExperiences() {
    var out = [];
    Core.EXPERIENCE_FIELDS.forEach(function (field) {
      var area = $(field.id);
      if (area && area.value.trim()) {
        out.push({ id: field.id, label: field.label, text: area.value.trim() });
      }
    });
    return out;
  }

  function filledExpsCount() {
    var count = 0;
    expAreas.forEach(function (t) {
      if (t.value.trim().length >= LIMITS.minExpChars) count++;
    });
    return count;
  }

  function setMsg(text, ok) {
    var m = $("wizMsg");
    if (!m) return;
    m.textContent = text || "";
    m.classList.toggle("ok", !!ok);
  }

  /* ---------- Stepper header (interactive navigation) ---------- */
  var wizSteps = $("wizSteps");
  Core.STEP_NAMES.forEach(function (name, i) {
    var stepNum = i + 1;
    var btn = el("button", {
      type: "button",
      className: "wiz-dot",
      id: "wizDot" + stepNum
    }, stepNum + ". " + name);
    btn.addEventListener("click", function () {
      if (stepNum === state.step) return;
      if (stepNum < state.step) {
        showStep(stepNum);
        return;
      }
      if (stepNum <= state.maxStepReached) {
        // Validate each intermediate step before jumping forward
        for (var s = state.step; s < stepNum; s++) {
          var err = validateStep(s, true);
          if (err) {
            setMsg(err);
            return;
          }
        }
        showStep(stepNum);
      }
    });
    wizSteps.appendChild(btn);
  });

  function renderStepper() {
    Core.STEP_NAMES.forEach(function (_, i) {
      var stepNum = i + 1;
      var btn = $("wizDot" + stepNum);
      var isActive = state.step === stepNum;
      var isDone = stepNum < state.step || (stepNum <= state.maxStepReached && !isActive);
      var isReachable = stepNum <= state.maxStepReached;

      btn.classList.toggle("active", isActive);
      btn.classList.toggle("done", isDone);
      btn.disabled = !isReachable;
      if (isActive) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });

    $("wizProgressBar").style.width = (state.step / Core.STEP_NAMES.length * 100) + "%";
    $("wizProgress").setAttribute("aria-valuenow", String(state.step));
    $("wizBack").hidden = state.step === 1;
    $("wizBack").disabled = state.step === 1;
    $("wizNext").textContent = state.step === 7
      ? "Xem bản đồ giá trị →"
      : (state.step === 8 ? "Làm lại từ đầu ↺" : "Tiếp tục →");
  }

  function showStep(n, opts) {
    var options = opts || {};
    state.step = n;
    if (n > state.maxStepReached) state.maxStepReached = n;
    antiSkipArmed = false;

    panels.forEach(function (p) {
      var isMatch = Number(p.dataset.panel) === n;
      p.classList.toggle("active", isMatch);
      p.hidden = !isMatch;
    });

    setMsg("");
    if (n === 2) renderExpReference("expRefStep2");
    if (n === 3) {
      renderExpReference("expRefStep3");
      renderFilter();
    }
    if (n === 4) renderLivedReference("livedRefStep4");
    if (n === 5) renderDuelIntro();
    if (n === 6) renderVerify();
    if (n === 7) renderDefine();
    if (n === 8) renderResult();

    renderStepper();
    if (!options.skipSave) saveProgress();

    if (!options.noScroll) {
      var wizEl = $("wizard");
      if (wizEl && typeof wizEl.scrollIntoView === "function") {
        wizEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  /* ---------- Step 1: Experiences ---------- */
  function updateExpUI() {
    var filled = filledExpsCount();
    var countEl = $("fillCount");
    countEl.textContent = "";
    countEl.appendChild(document.createTextNode("Bạn đã viết "));
    countEl.appendChild(el("strong", null, filled + " / " + Core.EXPERIENCE_FIELDS.length));
    countEl.appendChild(document.createTextNode(" khoảnh khắc." + (filled >= LIMITS.minFilledExps
      ? " Đủ để đi tiếp — viết thêm được ô nào, kết quả càng thật ô đó."
      : " Cần ít nhất " + LIMITS.minFilledExps + " ô viết cụ thể (mỗi ô từ " + LIMITS.minExpChars + " ký tự).")));

    expAreas.forEach(function (ta) {
      var badge = document.querySelector('[data-exp-status="' + ta.id + '"]');
      if (!badge) return;
      var len = ta.value.trim().length;
      if (len === 0) {
        badge.textContent = "";
        badge.className = "card-status";
      } else if (len < LIMITS.minExpChars) {
        badge.textContent = "Viết cụ thể thêm (" + len + "/" + LIMITS.minExpChars + " ký tự)";
        badge.className = "card-status is-short";
      } else {
        badge.textContent = "✓ Đã ghi nhận";
        badge.className = "card-status is-ready";
      }
    });
  }

  expAreas.forEach(function (ta) {
    ta.addEventListener("input", function () {
      updateExpUI();
      if (state.step === 1) setMsg("");
      scheduleSave();
    });
  });

  function renderExpReference(containerId) {
    var container = $(containerId);
    if (!container) return;
    container.textContent = "";
    var exps = getExperiences();
    if (!exps.length) return;

    var details = el("details", { className: "ref-drawer" });
    var summary = el("summary", null, "Xem lại " + exps.length + " khoảnh khắc bạn đã viết ở Bước 1");
    details.appendChild(summary);

    var list = el("dl", { className: "ref-list" });
    exps.forEach(function (item) {
      list.appendChild(el("dt", null, item.label));
      list.appendChild(el("dd", null, item.text));
    });
    details.appendChild(list);
    container.appendChild(details);
  }

  function renderLivedReference(containerId) {
    var container = $(containerId);
    if (!container) return;
    container.textContent = "";
    var lived = livedValues();
    if (!lived.length) return;

    var box = el("div", { className: "ref-strip" });
    box.appendChild(el("strong", null, "Giá trị “đã sống” bạn vừa lọc ở Bước 3: "));
    box.appendChild(document.createTextNode(lived.join(" · ")));
    container.appendChild(box);
  }

  /* ---------- Step 2 & Step 4: Chips ---------- */
  var bank = $("valueBank");
  var antiBank = $("antiBank");

  function findChipByValue(listEl, label) {
    var target = Core.normalizeText(label);
    var chips = listEl.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      if (Core.normalizeText(chips[i].dataset.value) === target) return chips[i];
    }
    return null;
  }

  function makeChip(text, listEl, isAnti) {
    var b = el("button", {
      type: "button",
      className: "chip" + (isAnti ? " anti" : ""),
      "aria-label": (isAnti ? "Chọn điều không chịu nổi: " : "Chọn giá trị: ") + text,
      "aria-pressed": "false"
    }, text);
    b.dataset.value = text;

    b.addEventListener("click", function () {
      var arr = isAnti ? state.antis : state.selected;
      var idx = arr.indexOf(text);
      if (idx >= 0) {
        arr.splice(idx, 1);
        b.setAttribute("aria-pressed", "false");
      } else {
        if (!isAnti && arr.length >= LIMITS.maxSelected) {
          setMsg("Bạn đã chọn " + LIMITS.maxSelected + " từ — đủ rộng rồi. Hãy bỏ bớt từ kém vang hơn trước khi thêm từ mới.");
          return;
        }
        arr.push(text);
        b.setAttribute("aria-pressed", "true");
      }
      if (!isAnti) {
        updateBankCount();
        syncLivedState();
      } else {
        antiSkipArmed = false;
      }
      if (state.step === 2 || state.step === 4) setMsg("");
      saveProgress();
    });

    listEl.appendChild(b);
    return b;
  }

  Core.VALUES.forEach(function (v) { makeChip(v, bank, false); });
  Core.ANTIS.forEach(function (a) { makeChip(a, antiBank, true); });

  function updateBankCount() {
    $("bankCount").textContent = "Đã chọn " + state.selected.length + " / " + LIMITS.maxSelected;
  }
  updateBankCount();

  $("bankSearch").addEventListener("input", function () {
    var q = Core.normalizeText(this.value);
    var shown = 0;
    bank.querySelectorAll(".chip").forEach(function (c) {
      var match = !q || Core.normalizeText(c.dataset.value).indexOf(q) >= 0;
      c.style.display = match ? "" : "none";
      if (match) shown++;
    });
    var emptyNote = $("bankSearchEmpty");
    if (emptyNote) {
      emptyNote.hidden = shown > 0;
    }
  });

  function addCustomValue(inputId, listEl, isAnti) {
    var inp = $(inputId);
    var v = Core.cleanLabel(inp.value);
    if (!v) return;

    var existing = findChipByValue(listEl, v);
    if (existing) {
      if (existing.getAttribute("aria-pressed") !== "true") {
        existing.click();
      } else {
        setMsg("“" + existing.dataset.value + "” đã được chọn rồi.", true);
      }
      inp.value = "";
      return;
    }

    if (!isAnti && state.selected.length >= LIMITS.maxSelected) {
      setMsg("Bạn đã chọn đủ " + LIMITS.maxSelected + " từ. Hãy bỏ bớt một từ trước khi thêm từ mới.");
      return;
    }

    var chip = makeChip(v, listEl, isAnti);
    chip.click();
    inp.value = "";
    // Clear search filter if active so the newly added chip is visible
    if (!isAnti && $("bankSearch").value) {
      $("bankSearch").value = "";
      $("bankSearch").dispatchEvent(new Event("input"));
    }
  }

  $("addCustom").addEventListener("click", function () { addCustomValue("customValue", bank, false); });
  $("customValue").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("addCustom").click(); }
  });
  $("addCustomAnti").addEventListener("click", function () { addCustomValue("customAnti", antiBank, true); });
  $("customAnti").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("addCustomAnti").click(); }
  });

  /* ---------- Step 3: Filter ---------- */
  function renderFilter() {
    var list = $("filterList");
    list.textContent = "";
    if (!state.selected.length) {
      list.appendChild(el("div", { className: "empty-note" },
        "Bạn chưa chọn giá trị nào ở bước 2. Hãy quay lại bước 2 và chọn ít nhất " + LIMITS.minSelected + " từ vang lên với bạn."));
      $("livedCount").textContent = "";
      return;
    }

    state.selected.forEach(function (v) {
      var row = el("div", { className: "filter-row" });
      row.appendChild(el("div", { className: "vname" }, v));

      var seg = el("div", {
        className: "seg",
        role: "group",
        "aria-label": "Phân loại giá trị " + v
      });

      Core.CLASS_OPTIONS.forEach(function (opt) {
        var b = el("button", {
          type: "button",
          "aria-pressed": state.classify[v] === opt.key ? "true" : "false"
        }, opt.label);
        b.addEventListener("click", function () {
          state.classify[v] = opt.key;
          seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
          updateLivedCount();
          setMsg("");
          syncLivedState();
          saveProgress();
        });
        seg.appendChild(b);
      });

      row.appendChild(seg);
      list.appendChild(row);
    });

    updateLivedCount();
  }

  function updateLivedCount() {
    var lived = livedValues().length;
    var unclassified = state.selected.filter(function (v) { return !state.classify[v]; }).length;
    var elCount = $("livedCount");
    elCount.textContent = "";
    elCount.appendChild(document.createTextNode("Đang có "));
    elCount.appendChild(el("strong", null, lived + " giá trị “đã sống”"));
    elCount.appendChild(document.createTextNode(" sẽ vào vòng xếp hạng (lý tưởng 5–8, cho phép 3–8)."));
    if (unclassified) {
      elCount.appendChild(document.createTextNode(" Còn " + unclassified + " giá trị chưa phân loại."));
    }
  }

  /* ---------- Step 5: Pairwise Duel ---------- */
  function startNewDuel() {
    var vals = livedValues();
    state.scores = {};
    vals.forEach(function (v) { state.scores[v] = 0; });
    state.pairs = Core.buildShuffledPairs(vals);
    state.pairIdx = 0;
    state.pairHistory = [];
    state.pairsSig = Core.valuesSignature(vals);
    state.ranking = [];
    verifyWarned = false;
  }

  function renderDuelIntro() {
    var zone = $("duelZone");
    var lived = livedValues();
    if (lived.length < LIMITS.minLived) {
      zone.textContent = "";
      zone.appendChild(el("div", { className: "empty-note" },
        "Cần ít nhất " + LIMITS.minLived + " giá trị “đã sống” để xếp hạng. Hãy quay lại bước 3 và phân loại thêm — trung thực nhé: giá trị nào bạn thực sự đã có bằng chứng trong đời?"));
      return;
    }

    var sig = Core.valuesSignature(lived);
    // Preserve completed ranking when navigating back from Step 6+
    if (state.pairsSig === sig && state.ranking.length === lived.length && state.pairIdx >= state.pairs.length && state.pairs.length > 0) {
      renderDuelComplete();
      return;
    }

    // Start fresh only if no valid matching duel exists
    if (state.pairsSig !== sig || !state.pairs.length) {
      startNewDuel();
      saveProgress();
    }

    renderDuel(false);
  }

  function chooseDuelWinner(winner, fromKeyboard) {
    if (state.pairIdx >= state.pairs.length) return;
    var pair = state.pairs[state.pairIdx];
    if (winner !== pair[0] && winner !== pair[1]) return;

    state.scores[winner] = (state.scores[winner] || 0) + 1;
    state.pairHistory.push({ pair: [pair[0], pair[1]], winner: winner });
    state.pairIdx++;
    setMsg("");

    if (state.pairIdx >= state.pairs.length) {
      state.ranking = Core.computeRanking(livedValues(), state.scores, state.pairHistory);
      verifyWarned = false;
      saveProgress();
      renderDuelComplete();
    } else {
      saveProgress();
      renderDuel(fromKeyboard);
    }
  }

  function undoDuelStep() {
    if (!state.pairHistory.length || state.pairIdx <= 0) return;
    var last = state.pairHistory.pop();
    state.pairIdx--;
    if (last && typeof state.scores[last.winner] === "number" && state.scores[last.winner] > 0) {
      state.scores[last.winner]--;
    }
    state.ranking = [];
    setMsg("");
    saveProgress();
    renderDuel(false);
  }

  function renderDuel(focusFirstOption) {
    var zone = $("duelZone");
    if (state.pairIdx >= state.pairs.length) {
      renderDuelComplete();
      return;
    }

    var pair = state.pairs[state.pairIdx];
    zone.textContent = "";

    var wrap = el("div", { className: "duel-wrap" });

    var metaRow = el("div", { className: "duel-meta" });
    metaRow.appendChild(el("span", { className: "duel-count" },
      "Cặp " + (state.pairIdx + 1) + " / " + state.pairs.length));
    if (state.pairHistory.length > 0) {
      var undoBtn = el("button", {
        type: "button",
        className: "btn-link",
        id: "duelUndo"
      }, "← Chọn lại cặp trước");
      undoBtn.addEventListener("click", undoDuelStep);
      metaRow.appendChild(undoBtn);
    }
    wrap.appendChild(metaRow);

    var barTrack = el("div", { className: "duel-track", "aria-hidden": "true" });
    var barFill = el("div", { className: "duel-fill" });
    barFill.style.width = (state.pairIdx / state.pairs.length * 100) + "%";
    barTrack.appendChild(barFill);
    wrap.appendChild(barTrack);

    wrap.appendChild(el("p", { className: "duel-q" }, "Nếu chỉ được thỏa mãn một trong hai, bạn chọn…"));

    var duel = el("div", { className: "duel" });
    var leftBtn = el("button", {
      type: "button",
      className: "duel-btn",
      id: "duelLeft",
      "aria-label": "Chọn " + pair[0] + " thay vì " + pair[1]
    });
    leftBtn.appendChild(el("span", { className: "duel-key", "aria-hidden": "true" }, "← / 1"));
    leftBtn.appendChild(el("span", { className: "duel-label" }, pair[0]));
    leftBtn.addEventListener("click", function () { chooseDuelWinner(pair[0], false); });

    var vs = el("div", { className: "duel-vs", "aria-hidden": "true" }, "hay");

    var rightBtn = el("button", {
      type: "button",
      className: "duel-btn",
      id: "duelRight",
      "aria-label": "Chọn " + pair[1] + " thay vì " + pair[0]
    });
    rightBtn.appendChild(el("span", { className: "duel-key", "aria-hidden": "true" }, "→ / 2"));
    rightBtn.appendChild(el("span", { className: "duel-label" }, pair[1]));
    rightBtn.addEventListener("click", function () { chooseDuelWinner(pair[1], false); });

    duel.appendChild(leftBtn);
    duel.appendChild(vs);
    duel.appendChild(rightBtn);
    wrap.appendChild(duel);

    wrap.appendChild(el("p", { className: "duel-note" },
      "Chọn đáp án bật ra đầu tiên. Không có đáp án đúng — chỉ có đáp án thật. Phím tắt: ← / → (hoặc 1 / 2) để chọn nhanh, Backspace để lùi 1 cặp."));

    zone.appendChild(wrap);
    if (focusFirstOption) {
      leftBtn.focus({ preventScroll: true });
    }
  }

  function renderDuelComplete() {
    var zone = $("duelZone");
    zone.textContent = "";
    var wrap = el("div", { className: "duel-wrap" });

    wrap.appendChild(el("p", { className: "duel-count" }, "Hoàn thành " + state.pairs.length + " / " + state.pairs.length + " cặp"));
    wrap.appendChild(el("p", { className: "duel-q" },
      "Trực giác của bạn đã xếp xong thứ tự. Bấm “Tiếp tục” để kiểm chứng bảng xếp hạng này."));

    var ol = el("ol", { className: "duel-ranking" });
    state.ranking.forEach(function (val, idx) {
      var li = el("li");
      li.appendChild(el("span", { className: "duel-rank-num" }, String(idx + 1)));
      li.appendChild(el("span", { className: "duel-rank-val" }, val));
      ol.appendChild(li);
    });
    wrap.appendChild(ol);

    var redo = el("button", {
      type: "button",
      className: "btn btn-ghost btn-small duel-redo"
    }, "↺ So lại từ đầu");
    redo.addEventListener("click", function () {
      startNewDuel();
      saveProgress();
      renderDuel(true);
    });
    wrap.appendChild(redo);
    zone.appendChild(wrap);
  }

  document.addEventListener("keydown", function (e) {
    if (state.step !== 5 || state.pairIdx >= state.pairs.length) return;
    var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var pair = state.pairs[state.pairIdx];
    if (!pair) return;

    if (e.key === "ArrowLeft" || e.key === "1") {
      e.preventDefault();
      chooseDuelWinner(pair[0], true);
    } else if (e.key === "ArrowRight" || e.key === "2") {
      e.preventDefault();
      chooseDuelWinner(pair[1], true);
    } else if ((e.key === "Backspace" || e.key === "z" || e.key === "Z") && state.pairHistory.length > 0) {
      e.preventDefault();
      undoDuelStep();
    }
  });

  /* ---------- Step 6: Verify ---------- */
  function renderVerify() {
    var rank = currentRanking();
    var preview = $("rankPreview");
    preview.textContent = "";

    if (rank.length) {
      var box = el("div", { className: "tip-box rank-preview-box" });
      box.appendChild(el("strong", null, "Bảng xếp hạng hiện tại của bạn"));
      var listText = rank.map(function (v, i) { return (i + 1) + ". " + v; }).join("  ·  ");
      box.appendChild(el("span", null, listText));
      preview.appendChild(box);
    }

    var list = $("verifyList");
    list.textContent = "";

    Core.VERIFY_QUESTIONS.forEach(function (item, idx) {
      var row = el("div", { className: "verify-row" });
      var txt = el("div");
      txt.appendChild(el("p", null, item.q));
      txt.appendChild(el("small", null, item.s));

      var hintWrap = el("div", { className: "verify-hint" });
      hintWrap.hidden = state.verify[idx] !== false;
      var jumpBtn = el("button", { type: "button", className: "btn-link" }, "→ " + item.hintLabel);
      jumpBtn.addEventListener("click", function () { showStep(item.hintStep); });
      hintWrap.appendChild(jumpBtn);
      txt.appendChild(hintWrap);

      var seg = el("div", {
        className: "seg",
        role: "group",
        "aria-label": item.q
      });

      [[true, "Đúng với tôi"], [false, "Chưa chắc"]].forEach(function (opt) {
        var isTrue = opt[0];
        var b = el("button", {
          type: "button",
          "aria-pressed": state.verify[idx] === isTrue ? "true" : "false"
        }, opt[1]);
        b.addEventListener("click", function () {
          state.verify[idx] = isTrue;
          verifyWarned = false;
          seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
          hintWrap.hidden = isTrue;
          setMsg("");
          saveProgress();
        });
        seg.appendChild(b);
      });

      row.appendChild(txt);
      row.appendChild(seg);
      list.appendChild(row);
    });
  }

  /* ---------- Step 7: Define ---------- */
  function renderDefine() {
    var rank = currentRanking().slice(0, LIMITS.topDefineCount);
    var list = $("defineList");
    list.textContent = "";

    if (!rank.length) {
      list.appendChild(el("div", { className: "empty-note" },
        "Chưa có bảng xếp hạng. Hãy hoàn thành bước 5 trước."));
      return;
    }

    rank.forEach(function (v, i) {
      if (!state.definitions[v]) state.definitions[v] = { def: "", act: "" };
      var card = el("div", { className: "define-card" });

      var line = el("div", { className: "rank-line" });
      line.appendChild(el("span", { className: "rank-num" }, "#" + (i + 1)));
      line.appendChild(el("h4", null, v));

      var l1 = el("label", { "for": "def-" + i }, "“" + v + "” với tôi nghĩa là…");
      var ta = el("textarea", {
        id: "def-" + i,
        placeholder: "Ví dụ: sống với đầy đủ sinh lực và năng lượng mỗi ngày…"
      });
      ta.value = state.definitions[v].def;
      ta.addEventListener("input", function () {
        state.definitions[v].def = ta.value;
        if (state.step === 7) setMsg("");
        scheduleSave();
      });

      var l2 = el("label", { "for": "act-" + i }, "Bài tập 100% — một điều phải khác đi, làm trong tuần này:");
      var inp = el("input", {
        type: "text",
        id: "act-" + i,
        placeholder: "Ví dụ: chặn 30 phút đi bộ vào lịch, 5 buổi tuần này"
      });
      inp.value = state.definitions[v].act;
      inp.addEventListener("input", function () {
        state.definitions[v].act = inp.value;
        scheduleSave();
      });

      card.appendChild(line);
      card.appendChild(l1);
      card.appendChild(ta);
      card.appendChild(l2);
      card.appendChild(inp);
      list.appendChild(card);
    });
  }

  /* ---------- Step 8: Result Map ---------- */
  function buildCurrentSummaryText() {
    var asp = state.selected.filter(function (v) { return state.classify[v] === "khat-vong"; });
    return Core.buildSummaryText({
      ranking: currentRanking(),
      definitions: state.definitions,
      aspirational: asp,
      antis: state.antis,
      experiences: getExperiences(),
      dateStr: Core.formatVietnameseDate(new Date())
    });
  }

  function renderResult() {
    var rank = currentRanking();
    var zone = $("resultZone");
    zone.textContent = "";

    var todayStr = Core.formatVietnameseDate(new Date());

    var hero = el("div", { className: "result-hero" });
    hero.appendChild(el("p", { className: "result-date" }, "Ngày lập: " + todayStr + " · Nhắc soi lại sau 24 giờ, hằng tháng và hằng năm"));
    hero.appendChild(el("h4", null, "Top " + Math.min(LIMITS.topDefineCount, rank.length) + " giá trị dẫn đường của bạn"));
    hero.appendChild(el("p", null,
      "Thứ tự này là thứ tự ưu tiên khi đời buộc bạn phải chọn — không phải mức độ “tốt xấu”." +
      (rank.length >= 2 ? " Giá trị xếp cuối bảng này vẫn là một phần cốt lõi của bạn." : "")));
    zone.appendChild(hero);

    var ol = el("ol", { className: "result-list" });
    rank.slice(0, LIMITS.topDefineCount).forEach(function (v, i) {
      var d = state.definitions[v] || { def: "", act: "" };
      var li = el("li");
      li.appendChild(el("div", { className: "rnum" }, String(i + 1)));

      var body = el("div");
      body.appendChild(el("div", { className: "rname" }, v));
      if (d.def && d.def.trim()) {
        body.appendChild(el("div", { className: "rdef" }, "“" + d.def.trim() + "”"));
      }
      if (d.act && d.act.trim()) {
        var act = el("div", { className: "ract" });
        act.appendChild(el("strong", null, "Tuần này: "));
        act.appendChild(document.createTextNode(d.act.trim()));
        body.appendChild(act);
      }

      li.appendChild(body);
      ol.appendChild(li);
    });
    zone.appendChild(ol);

    if (rank.length > LIMITS.topDefineCount) {
      var rest = el("div", { className: "result-block" });
      rest.appendChild(el("h4", null, "Cũng rất quan trọng với bạn"));
      rest.appendChild(el("p", null, rank.slice(LIMITS.topDefineCount).join(" · ")));
      zone.appendChild(rest);
    }

    if (state.antis.length) {
      var ab = el("div", { className: "result-block" });
      ab.appendChild(el("h4", null, "Những điều bạn không chịu nổi — bản đồ ngược của giá trị"));
      var ul = el("ul");
      state.antis.forEach(function (a) { ul.appendChild(el("li", null, a)); });
      ab.appendChild(ul);
      zone.appendChild(ab);
    }

    var asp = state.selected.filter(function (v) { return state.classify[v] === "khat-vong"; });
    if (asp.length) {
      var aspB = el("div", { className: "result-block" });
      aspB.appendChild(el("h4", null, "Giá trị khát vọng — để ngắm, chưa để dẫn đường"));
      aspB.appendChild(el("p", null,
        asp.join(" · ") + ". Đây là hướng bạn muốn lớn lên tới, nhưng hiện tại chúng chưa điều khiển quyết định của bạn. Đừng để chúng che mất bảng giá trị thật ở trên."));
      zone.appendChild(aspB);
    }

    var exps = getExperiences();
    if (exps.length) {
      var expDetails = el("details", { className: "result-evidence" });
      expDetails.appendChild(el("summary", null, "Bằng chứng sống đã ghi lại (" + exps.length + " khoảnh khắc)"));
      var dl = el("dl", { className: "ref-list" });
      exps.forEach(function (item) {
        dl.appendChild(el("dt", null, item.label));
        dl.appendChild(el("dd", null, item.text));
      });
      expDetails.appendChild(dl);
      zone.appendChild(expDetails);
    }

    var actions = el("div", { className: "result-actions" });

    var copyBtn = el("button", { type: "button", className: "btn btn-primary btn-small" }, "Sao chép bản tổng kết");
    var okSpan = el("span", { className: "copy-ok", id: "copyOk", role: "status", "aria-live": "polite" });
    copyBtn.addEventListener("click", function () {
      var text = buildCurrentSummaryText();
      function done() {
        okSpan.textContent = "Đã sao chép ✓ Dán vào ghi chú của bạn để giữ lại.";
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else {
        fallbackCopy(text);
        done();
      }
    });

    var dlBtn = el("button", { type: "button", className: "btn btn-accent btn-small" }, "Tải về (.txt)");
    dlBtn.addEventListener("click", function () {
      // UTF-8 BOM ensures Vietnamese characters display cleanly in Windows Notepad as well as modern editors
      var blob = new Blob(["\uFEFF" + buildCurrentSummaryText()], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = el("a", {
        href: url,
        download: "ban-do-gia-tri-" + Core.formatIsoDate(new Date()) + ".txt"
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    var printBtn = el("button", {
      type: "button",
      className: "btn btn-ghost btn-small",
      "aria-label": "In bản đồ giá trị của bạn"
    }, "In bản tổng kết");
    printBtn.addEventListener("click", function () { window.print(); });

    actions.appendChild(copyBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(printBtn);
    actions.appendChild(okSpan);
    zone.appendChild(actions);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- Persistence (localStorage only, debounced on typing) ---------- */
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveProgress(false, true);
    }, 350);
  }

  function saveProgress(manual, silent) {
    if (isRestarting) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      var exps = {};
      expAreas.forEach(function (ta) { if (ta.value.trim()) exps[ta.id] = ta.value; });
      var data = {
        version: 2,
        savedAt: new Date().toISOString(),
        step: state.step,
        maxStepReached: state.maxStepReached,
        exps: exps,
        selected: state.selected,
        customValues: state.selected.filter(function (v) { return Core.VALUES.indexOf(v) < 0; }),
        classify: state.classify,
        antis: state.antis,
        customAntis: state.antis.filter(function (v) { return Core.ANTIS.indexOf(v) < 0; }),
        pairs: state.pairs,
        pairIdx: state.pairIdx,
        pairHistory: state.pairHistory,
        pairsSig: state.pairsSig,
        scores: state.scores,
        ranking: state.ranking,
        verify: state.verify,
        definitions: state.definitions
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      var timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      var status = $("saveStatus");
      if (status && (!silent || manual)) {
        status.textContent = "Đã tự lưu lúc " + timeStr + " trên trình duyệt này — đóng trang rồi quay lại sau vẫn tiếp tục được.";
      } else if (status && silent) {
        status.textContent = "Đã tự lưu lúc " + timeStr + " trên trình duyệt này.";
      }
      if (manual) {
        setMsg("Đã lưu lúc " + timeStr + ". Bạn có thể đóng trang và quay lại sau trên cùng trình duyệt và thiết bị này.", true);
      }
    } catch (e) {
      if (manual) {
        setMsg("Trình duyệt đang chặn bộ nhớ cục bộ (localStorage). Hành trình vẫn hoạt động bình thường — hãy tải về hoặc sao chép bản tổng kết khi hoàn thành.");
      }
    }
  }

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return Core.sanitizeSavedState(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function restoreSaved(d) {
    state.selected = d.selected;
    state.classify = d.classify;
    state.antis = d.antis;
    state.pairs = d.pairs;
    state.pairIdx = d.pairIdx;
    state.pairHistory = d.pairHistory;
    state.pairsSig = d.pairsSig || (d.pairs.length ? Core.valuesSignature(livedValues()) : "");
    state.scores = d.scores;
    state.ranking = d.ranking;
    state.verify = d.verify;
    state.definitions = d.definitions;
    state.maxStepReached = d.maxStepReached;

    d.customValues.forEach(function (v) {
      if (!findChipByValue(bank, v)) makeChip(v, bank, false);
    });
    d.customAntis.forEach(function (v) {
      if (!findChipByValue(antiBank, v)) makeChip(v, antiBank, true);
    });

    bank.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", state.selected.indexOf(c.dataset.value) >= 0 ? "true" : "false");
    });
    antiBank.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", state.antis.indexOf(c.dataset.value) >= 0 ? "true" : "false");
    });
    updateBankCount();

    Object.keys(d.exps).forEach(function (id) {
      var area = $(id);
      if (area) area.value = d.exps[id];
    });
    updateExpUI();

    if (d.savedAt) {
      var dt = new Date(d.savedAt);
      if (!isNaN(dt.getTime())) {
        var s = $("saveStatus");
        if (s) {
          s.textContent = "Đã khôi phục tiến trình lưu lúc " +
            dt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) +
            " trên trình duyệt này.";
        }
      }
    }
    return true;
  }

  /* ---------- Validation & Navigation ---------- */
  function validateStep(n, allowOptionalSkip) {
    if (n === 1) {
      if (filledExpsCount() < LIMITS.minFilledExps) {
        return "Hãy viết ít nhất " + LIMITS.minFilledExps + " trong 6 khoảnh khắc trước khi đi tiếp — viết cụ thể một chút (tối thiểu " + LIMITS.minExpChars + " ký tự mỗi ô). Đây là dữ liệu gốc cho mọi bước sau.";
      }
      return "";
    }
    if (n === 2) {
      if (state.selected.length < LIMITS.minSelected) {
        return "Hãy chọn ít nhất " + LIMITS.minSelected + " giá trị vang lên với bạn (hiện mới chọn " + state.selected.length + "). Chọn rộng tay — bước sau sẽ lọc.";
      }
      if (state.selected.length > LIMITS.maxSelected) {
        return "Tối đa " + LIMITS.maxSelected + " giá trị ở bước này thôi.";
      }
      return "";
    }
    if (n === 3) {
      var un = state.selected.filter(function (v) { return !state.classify[v]; });
      if (un.length) {
        return "Còn " + un.length + " giá trị chưa phân loại: " + un.join(", ") + ". Phân loại hết rồi mới đi tiếp được.";
      }
      var lived = livedValues().length;
      if (lived < LIMITS.minLived) {
        return "Cần ít nhất " + LIMITS.minLived + " giá trị “đã sống” để xếp hạng. Nhìn lại các khát vọng của bạn: có giá trị nào bạn thực ra đã có bằng chứng trong đời rồi không?";
      }
      if (lived > LIMITS.maxLived) {
        return "Bạn có " + lived + " giá trị “đã sống” — hơi nhiều để so cặp (" + (lived * (lived - 1) / 2) + " cặp). Hãy chuyển bớt những giá trị kém trung tâm hơn sang “khát vọng” để còn tối đa " + LIMITS.maxLived + ".";
      }
      return "";
    }
    if (n === 4) {
      if (!state.antis.length && !antiSkipArmed && !allowOptionalSkip) {
        antiSkipArmed = true;
        return "Chưa chọn điều nào. Bấm “Tiếp tục” lần nữa nếu bạn muốn bỏ qua — nhưng phần này thường cho manh mối rất mạnh đấy.";
      }
      return "";
    }
    if (n === 5) {
      if (!state.pairs.length || state.pairIdx < state.pairs.length) {
        var remaining = Math.max(0, state.pairs.length - state.pairIdx);
        return "Hãy so hết các cặp đã — còn " + remaining + " cặp. Chọn nhanh bằng trực giác thôi.";
      }
      return "";
    }
    if (n === 6) {
      var answered = Object.keys(state.verify).length;
      if (answered < Core.VERIFY_QUESTIONS.length) {
        return "Trả lời cả " + Core.VERIFY_QUESTIONS.length + " câu kiểm chứng nhé (mới " + answered + "/" + Core.VERIFY_QUESTIONS.length + "). “Chưa chắc” cũng là một câu trả lời hợp lệ.";
      }
      var nos = Object.keys(state.verify).filter(function (k) { return state.verify[k] === false; }).length;
      if (nos >= 3 && !verifyWarned && !allowOptionalSkip) {
        verifyWarned = true;
        return "Có " + nos + "/5 câu là “Chưa chắc” — dấu hiệu danh sách chưa thật. Bạn có thể bấm vào gợi ý từng câu để quay lại chỉnh, hoặc bấm “Tiếp tục” lần nữa để đi tiếp với danh sách hiện tại.";
      }
      return "";
    }
    if (n === 7) {
      var rank = currentRanking().slice(0, LIMITS.topDefineCount);
      var required = Math.min(3, rank.length);
      var doneDef = rank.filter(function (v) {
        return state.definitions[v] && state.definitions[v].def.trim().length >= LIMITS.minDefChars;
      }).length;
      if (doneDef < required) {
        return "Hãy viết câu định nghĩa cho ít nhất " + required + " giá trị đầu (hiện " + doneDef + "). Một từ đơn độc rất dễ quên — câu của riêng bạn mới giữ nó sống.";
      }
      return "";
    }
    return "";
  }

  function confirmRestart() {
    if (window.confirm("Bắt đầu lại sẽ xóa toàn bộ những gì bạn đã viết và chọn trong hành trình này trên trình duyệt này. Bạn chắc chắn chứ?")) {
      isRestarting = true;
      if (saveTimer) clearTimeout(saveTimer);
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      location.reload();
    }
  }

  $("wizNext").addEventListener("click", function () {
    if (state.step === 8) {
      confirmRestart();
      return;
    }
    var err = validateStep(state.step, false);
    if (err) {
      setMsg(err);
      return;
    }
    antiSkipArmed = false;
    showStep(state.step + 1);
  });

  $("wizBack").addEventListener("click", function () {
    if (state.step > 1) showStep(state.step - 1);
  });

  $("saveBtn").addEventListener("click", function () { saveProgress(true, false); });
  $("restartBtn").addEventListener("click", confirmRestart);
  window.addEventListener("beforeunload", function () {
    if (saveTimer) saveProgress(false, true);
  });

  /* ---------- Init & Restore ---------- */
  updateExpUI();
  (function initRestore() {
    var saved = loadSaved();
    if (saved && restoreSaved(saved)) {
      showStep(saved.step, { noScroll: true, skipSave: true });
      return;
    }
    showStep(1, { noScroll: true, skipSave: true });
  })();
})();
