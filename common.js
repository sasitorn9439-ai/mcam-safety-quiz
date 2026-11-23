(function () {
  "use strict";
  var C = {};
  C.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };
  C.$ = function (id) { return document.getElementById(id); };
  C.COLORS = ["red", "blue", "yellow", "green"];
  C.SHAPES = [
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4 L29 27 H3 Z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 L30 16 L16 30 L2 16 Z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="2" fill="currentColor"/></svg>'
  ];
  C.SHAPE_NAMES = ["สามเหลี่ยม", "ข้าวหลามตัด", "วงกลม", "สี่เหลี่ยม"];
  /* Bilingual text block: Thai line + English line (either may be empty) */
  C.bi = function (o, cls) {
    if (!o) return "";
    var th = C.esc(o.th || ""), en = C.esc(o.en || "");
    if (th && en && th !== en) return '<span class="th ' + (cls || "") + '">' + th + '</span><span class="en">' + en + "</span>";
    return '<span class="th ' + (cls || "") + '">' + (th || en) + "</span>";
  };
  C.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  C.fmt = function (n) { return Number(n || 0).toLocaleString("en-US"); };

  /* Tiny WebAudio sound kit */
  var ac = null, muted = C.store.get("mcamq_muted", false);
  function ctx() {
    if (muted) return null;
    try {
      if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, vol, delay) {
    var a = ctx(); if (!a) return;
    try {
      var t0 = a.currentTime + (delay || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  C.sfx = {
    unlock: function () { ctx(); },
    tick: function () { tone(880, 0.06, "square", 0.05); },
    pop: function () { tone(660, 0.08, "triangle", 0.12); tone(990, 0.08, "triangle", 0.1, 0.06); },
    go: function () { tone(523, 0.12, "triangle", 0.15); tone(784, 0.18, "triangle", 0.15, 0.12); },
    end: function () { tone(330, 0.35, "sawtooth", 0.08); tone(247, 0.45, "sawtooth", 0.08, 0.2); },
    good: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, "triangle", 0.13, i * 0.09); }); },
    bad: function () { tone(220, 0.3, "square", 0.06); tone(180, 0.35, "square", 0.06, 0.18); },
    fanfare: function () { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, "triangle", 0.14, i * 0.14); }); }
  };
  C.isMuted = function () { return muted; };
  C.setMuted = function (m) { muted = !!m; C.store.set("mcamq_muted", muted); };

  C.download = function (name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    } catch (e) { console.warn(e); }
  };

  C.toast = function (msg) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on");
    clearTimeout(C._tt); C._tt = setTimeout(function () { t.classList.remove("on"); }, 2600);
  };

  window.Q = C;
})();
