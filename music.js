/* Background music for the Host screen.
   Default song: music/ppe-ready.mp3 ("PPE พร้อม"). The host may replace it with their own
   file (kept in this browser via IndexedDB). Plays automatically: full volume in lobby & questions, softer on the scoreboard,
   off on the setup and final screens. */
(function () {
  "use strict";
  var DB = "mcamq_media", STORE = "files", KEY = "bg";
  var DEFAULT_SRC = "music/ppe-ready.mp3", DEFAULT_NAME = "PPE พร้อม (เพลงประจำเกม)";
  var isDefault = false;
  var SET_KEY = "mcamq_music";
  var st = { on: true, vol: 0.6, game: true };
  try { var s = JSON.parse(localStorage.getItem(SET_KEY) || "null"); if (s) { st.on = s.on !== false; st.vol = Math.min(1, Math.max(0, +s.vol || 0.6)); st.game = s.game !== false; } } catch (e) { /* ignore */ }
  function saveSt() { try { localStorage.setItem(SET_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

  var audio = new Audio();
  audio.loop = true; audio.preload = "auto"; audio.volume = 0;
  var hasSong = false, songName = "", url = null, level = 0, fadeT = null, blocked = false;

  /* ---------- IndexedDB ---------- */
  function idb(mode, fn) {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error("no idb")); return; }
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
      rq.onerror = function () { rej(rq.error); };
      rq.onsuccess = function () {
        try {
          var tx = rq.result.transaction(STORE, mode), os = tx.objectStore(STORE), r = fn(os);
          tx.oncomplete = function () { res(r && r.result); rq.result.close(); };
          tx.onerror = function () { rej(tx.error); rq.result.close(); };
        } catch (e) { rej(e); }
      };
    });
  }
  function loadSaved() {
    return idb("readonly", function (os) { return os.get(KEY); }).then(function (v) {
      if (v && v.blob) setSong(v.blob, v.name); else useDefault();
    }).catch(function () { useDefault(); });
  }
  function setSong(blob, name) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    audio.src = url; hasSong = true; songName = name || "song"; isDefault = false;
    ui(); apply(true);
  }
  function useDefault() {
    if (url) { URL.revokeObjectURL(url); url = null; }
    audio.src = DEFAULT_SRC; hasSong = true; songName = DEFAULT_NAME; isDefault = true;
    ui(); apply(true);
  }
  audio.addEventListener("error", function () {
    if (isDefault) { hasSong = false; songName = ""; ui(); }
  });

  /* ---------- UI ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".mus{position:relative}.mus-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:60;width:min(320px,90vw);background:#fff;color:#1a1530;border-radius:14px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);color-scheme:light}" +
    ".mus-pop h4{margin:0 0 4px;font:600 16px Kanit,sans-serif}.mus-pop p{margin:0 0 10px;font-size:13px;color:#6b6585;word-break:break-all}" +
    ".mus-row{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}.mus-row input[type=range]{flex:1;accent-color:#6b3fd1}" +
    ".mus-btn{background:#ffd21f;color:#111;font:600 14px Kanit,sans-serif;padding:8px 14px;border-radius:10px;min-height:38px}.mus-btn.g{background:#efeaf9}.mus-btn.d{background:#ffe1e5;color:#a1122a}" +
    ".mus-hint{animation:pulse 1.2s ease-in-out infinite;background:#ffd21f!important;color:#111!important}";
  document.head.appendChild(css);

  var wrap = document.createElement("div"); wrap.className = "mus";
  wrap.innerHTML =
    '<button class="icon-btn" id="musBtn" type="button" aria-expanded="false">🎵 เพลง</button>' +
    '<div class="mus-pop hidden" id="musPop" role="dialog" aria-label="เพลงประกอบ">' +
    '<h4>เพลงประกอบ · Background music</h4><p id="musName"></p>' +
    '<div class="mus-row"><button class="mus-btn" id="musPick" type="button">เปลี่ยนเพลง</button>' +
    '<button class="mus-btn g" id="musTest" type="button">▶ ทดลองฟัง</button>' +
    '<button class="mus-btn d" id="musDel" type="button">ใช้เพลงเดิม</button></div>' +
    '<div class="mus-row"><label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:14px"><input type="checkbox" id="musOn" style="width:20px;height:20px;accent-color:#6b3fd1"> เปิดเพลงระหว่างเกม</label></div>' +
    '<div class="mus-row"><label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:14px"><input type="checkbox" id="musGame" style="width:20px;height:20px;accent-color:#6b3fd1"> ดนตรีลุ้นช่วงตอบคำถาม</label>' +
    '<button class="mus-btn g" id="musDemo" type="button">▶ ฟังดนตรีลุ้น</button></div>' +
    '<p style="margin:6px 0 0">จังหวะเร็วขึ้นเมื่อเวลาใกล้หมด · Speeds up as time runs out</p>' +
    '<div class="mus-row"><span style="font-size:13px">ระดับเสียง</span><input type="range" id="musVol" min="0" max="100" step="5" aria-label="ระดับเสียงเพลง"></div>' +
    '<input type="file" id="musFile" accept="audio/*,video/mp4,.mp3,.m4a,.mp4,.wav,.ogg" class="hidden">' +
    "</div>";
  var anchor = document.getElementById("btnMute");
  anchor.parentNode.insertBefore(wrap, anchor);
  var $ = function (id) { return document.getElementById(id); };

  function ui() {
    $("musName").textContent = hasSong ? "🎶 " + songName : "ยังไม่มีเพลง — เลือกไฟล์ครั้งเดียว ระบบจำไว้ในเครื่องนี้";
    $("musTest").classList.toggle("hidden", !hasSong);
    $("musDel").classList.toggle("hidden", !hasSong || isDefault);
    $("musOn").checked = st.on; $("musGame").checked = st.game;
    $("musVol").value = Math.round(st.vol * 100);
    $("musBtn").textContent = !hasSong ? "🎵 เพลง" : (st.on ? "🎵 เพลง: เปิด" : "🎵 เพลง: ปิด");
    $("musBtn").classList.toggle("mus-hint", blocked && hasSong && st.on);
  }
  $("musBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    var p = $("musPop"), open = p.classList.contains("hidden");
    p.classList.toggle("hidden", !open); this.setAttribute("aria-expanded", String(open));
    if (blocked) apply(true);
  });
  document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) $("musPop").classList.add("hidden"); });
  $("musPick").addEventListener("click", function () { $("musFile").value = ""; $("musFile").click(); });
  $("musFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    setSong(f, f.name);
    idb("readwrite", function (os) { return os.put({ blob: f, name: f.name }, KEY); })
      .then(function () { if (window.Q) Q.toast("บันทึกเพลงแล้ว · Music saved"); })
      .catch(function () { if (window.Q) Q.toast("เล่นได้ แต่บันทึกไว้ในเครื่องไม่ได้"); });
  });
  $("musDel").addEventListener("click", function () {
    audio.pause();
    idb("readwrite", function (os) { return os.delete(KEY); }).catch(function () {});
    useDefault();
  });
  $("musOn").addEventListener("change", function () { st.on = this.checked; saveSt(); ui(); apply(true); });
  $("musVol").addEventListener("input", function () { st.vol = (+this.value || 0) / 100; saveSt(); if (player) player.setVolume(st.vol * 1.2); apply(false); });
  $("musGame").addEventListener("change", function () { st.game = this.checked; saveSt(); ui(); apply(true); });
  var demoT = null, demoStep = 0;
  $("musDemo").addEventListener("click", function () {
    var btn = this;
    if (demoT) { clearInterval(demoT); demoT = null; btn.textContent = "▶ ฟังดนตรีลุ้น"; apply(true); return; }
    if (!getPlayer()) return;
    testing = false; $("musTest").textContent = "▶ ทดลองฟัง"; fadeTo(0);
    demoStep = 0; btn.textContent = "■ หยุด";
    player.setLevel(0); player.start();
    demoT = setInterval(function () {
      demoStep++;
      if (demoStep < 3) player.setLevel(demoStep);
      else { clearInterval(demoT); demoT = null; btn.textContent = "▶ ฟังดนตรีลุ้น"; apply(true); }
    }, 5000);
  });
  var testing = false;
  $("musTest").addEventListener("click", function () {
    testing = !testing; this.textContent = testing ? "■ หยุด" : "▶ ทดลองฟัง"; apply(true);
  });

  /* ---------- playback by screen ---------- */
  function screen() {
    var ids = ["sSetup", "sLobby", "sQ", "sLb", "sFinal"];
    for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el && !el.classList.contains("hidden")) return ids[i]; }
    return "sSetup";
  }
  function phase() {
    var s = screen();
    if (s !== "sQ") return s;
    if (!$("readyBar").classList.contains("hidden")) return "ready";
    if (!$("timer").classList.contains("hidden")) return "question";
    return "reveal";
  }
  function gameOn() { return st.on && st.game && !!getPlayer(); }
  function targetLevel() {
    if (!hasSong || !st.on) return testing && hasSong ? st.vol : 0;
    if (testing) return st.vol;
    var ph = phase();
    if (ph === "sLobby") return st.vol;
    if (ph === "sLb") return st.vol * 0.45;
    if (ph === "ready" || ph === "question" || ph === "reveal") return st.game ? 0 : st.vol;
    return 0;
  }

  /* ---------- generated game music ---------- */
  var actx = null, player = null, lastPhase = "", lvlT = null;
  function getPlayer() {
    if (player) return player;
    try {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A || !window.GameMusic) return null;
      actx = new A();
      player = new window.GameMusic.Player(actx, actx.destination);
      player.setVolume(st.vol * 1.2);
    } catch (e) { player = null; }
    return player;
  }
  function timeLeft() { var n = parseInt(($("timerN") || {}).textContent, 10); return isNaN(n) ? 99 : n; }
  function levelFor(sec) { return sec <= 5 ? 2 : sec <= 10 ? 1 : 0; }
  function applyGame() {
    var ph = phase();
    if (demoT) { lastPhase = ph; return; }
    if (!(st.on && st.game)) { if (player) player.stop(); clearInterval(lvlT); lvlT = null; lastPhase = ph; return; }
    if (!player && ph !== "ready" && ph !== "question") { lastPhase = ph; return; }
    var pl = getPlayer(); if (!pl) { lastPhase = ph; return; }
    if (actx.state === "suspended") { var r = actx.resume(); if (r && r.then) r.then(null, function () {}); }
    if (ph === "ready" && lastPhase !== "ready") {
      var w = parseFloat(($("readyFill") || { style: {} }).style.width) || 0;
      pl.setVolume(st.vol * 1.2); pl.riser(Math.max(0.6, 3 * (1 - w / 100)));
    } else if (ph === "question") {
      pl.setVolume(st.vol * 1.2);
      pl.setLevel(levelFor(timeLeft()));
      pl.start();
      if (!lvlT) lvlT = setInterval(function () { if (player) player.setLevel(levelFor(timeLeft())); }, 250);
    } else if (ph !== "ready") {
      pl.stop(); clearInterval(lvlT); lvlT = null;
    }
    lastPhase = ph;
  }
  function fadeTo(v) {
    clearInterval(fadeT);
    fadeT = setInterval(function () {
      var d = v - level;
      if (Math.abs(d) < 0.03) { level = v; clearInterval(fadeT); if (v === 0) audio.pause(); }
      else level += d * 0.25;
      try { audio.volume = Math.max(0, Math.min(1, level)); } catch (e) { /* ignore */ }
    }, 50);
  }
  function apply(tryPlay) {
    if (tryPlay !== false) applyGame();
    var v = targetLevel();
    if (v > 0 && hasSong) {
      if (audio.paused && tryPlay !== false) {
        var p = audio.play();
        if (p && p.then) p.then(function () { blocked = false; ui(); }, function () { blocked = true; ui(); });
      }
      fadeTo(v);
    } else {
      fadeTo(0);
    }
  }
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { apply(true); });
    ["sSetup", "sLobby", "sQ", "sLb", "sFinal", "timer", "readyBar"].forEach(function (id) { var el = $(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ["class"] }); });
  }
  /* browsers block sound until the first tap — retry on any interaction */
  document.addEventListener("pointerdown", function () {
    if (actx && actx.state === "suspended") { var r = actx.resume(); if (r && r.then) r.then(null, function () {}); }
    if (blocked) apply(true);
  }, true);
  document.addEventListener("keydown", function () { if (blocked) apply(true); }, true);

  window.HostMusic = { audio: audio, state: function () {
    return { hasSong: hasSong, playing: !audio.paused, level: level, screen: phase(),
      game: player ? { running: player.running, lvl: player.lvl, ctx: actx.state } : null };
  } };
  ui();
  loadSaved();
})();
