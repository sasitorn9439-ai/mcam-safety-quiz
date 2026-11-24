(function () {
  "use strict";
  var $ = Q.$, esc = Q.esc;
  var GAME_KEY = "mcamq_game", SET_KEY = "mcamq_set", OPT_KEY = "mcamq_opts";
  var READY_MS = 3000, MAX_PLAYERS = 300;

  /* ---------- quiz data ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function str(v, n) { return String(v == null ? "" : v).slice(0, n || 300); }
  function filled(o) { return !!(o && (str(o.th).trim() || str(o.en).trim())); }
  function normQ(x) {
    x = x || {};
    var o = Array.isArray(x.o) ? x.o.slice(0, 4) : [];
    while (o.length < 4) o.push({ th: "", en: "" });
    o = o.map(function (k) { return typeof k === "string" ? { th: str(k, 160), en: "" } : { th: str(k && k.th, 160), en: str(k && k.en, 160) }; });
    var c = parseInt(x.c, 10); if (!(c >= 0 && c < 4)) c = 0;
    var t = parseInt(x.t, 10); if (!(t >= 5 && t <= 120)) t = 20;
    var xp = x.x || {};
    return { th: str(x.th), en: str(x.en), o: o, c: c, t: t, x: { th: str(xp.th, 400), en: str(xp.en, 400) }, img: str(x.img, 40) };
  }
  function qErrors(q) {
    var e = [];
    if (!str(q.th).trim() && !str(q.en).trim()) e.push("ใส่ข้อความคำถาม");
    if (q.o.filter(filled).length < 2) e.push("ต้องมีอย่างน้อย 2 ตัวเลือก");
    if (!filled(q.o[q.c])) e.push("ตัวเลือกที่ถูกต้องว่างอยู่");
    return e;
  }
  function normQuiz(d) {
    var qs = Array.isArray(d) ? d : (d && Array.isArray(d.questions) ? d.questions : null);
    if (!qs || !qs.length) return null;
    var t = (d && d.title) || {};
    return { title: { th: str(t.th, 80), en: str(t.en, 80) }, questions: qs.slice(0, 100).map(normQ) };
  }
  var SETS = (Array.isArray(window.QUIZ_SETS) && window.QUIZ_SETS.length ? window.QUIZ_SETS : [{ id: "default", icon: "?", title: window.DEFAULT_QUIZ.title, questions: window.DEFAULT_QUIZ.questions }])
    .map(function (s) { var q = normQuiz(s); return { id: String(s.id), icon: s.icon || "", title: q.title, questions: q.questions }; });
  function setById(id) { for (var i = 0; i < SETS.length; i++) if (SETS[i].id === id) return SETS[i]; return SETS[0]; }
  function defaultQuiz(id) { var s = setById(id); return normQuiz(clone({ title: s.title, questions: s.questions })); }
  function customKey(id) { return "mcamq_quiz_" + id; }
  function isCustom(id) { return !!Q.store.get(customKey(id), null); }
  function loadQuiz(id) {
    var q = normQuiz(Q.store.get(customKey(id), null));
    if (!q || q.questions.some(function (x) { return qErrors(x).length; })) q = defaultQuiz(id);
    return q;
  }
  var curSetId = setById(Q.store.get(SET_KEY, SETS[0].id)).id;
  var quiz = loadQuiz(curSetId);
  var opts = Q.store.get(OPT_KEY, null) || {};
  if (typeof opts.sq !== "boolean") opts.sq = false;
  if (typeof opts.sa !== "boolean") opts.sa = true;
  opts.t = [0, 10, 15, 20, 30, 45, 60].indexOf(+opts.t) >= 0 ? +opts.t : 0;
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var b = new Uint32Array(1); crypto.getRandomValues(b);
      var j = b[0] % (i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function prepareQuiz(src) {
    var q = clone(src);
    q.questions.forEach(function (x) {
      if (opts.t) x.t = opts.t;
      var idx = [0, 1, 2, 3].filter(function (i) { return filled(x.o[i]); });
      if (opts.sa && idx.length >= 3) {
        var order = shuffle(idx.slice()), o = x.o.slice(), newC = x.c;
        idx.forEach(function (slot, k) { o[slot] = x.o[order[k]]; if (order[k] === x.c) newC = slot; });
        x.o = o; x.c = newC;
      }
    });
    if (opts.sq) shuffle(q.questions);
    return q;
  }

  /* ---------- game state ---------- */
  var G = null, bus = null, seqLast = 0, tickT = null, pubT = null, lastBeat = 0, lastTickSec = -1;

  function now() { return Date.now(); }
  function nextSeq() { seqLast = Math.max(now(), seqLast + 1); return seqLast; }
  function save() { if (G) Q.store.set(GAME_KEY, G); }
  function curQ() { return G && G.qi >= 0 ? G.quiz.questions[G.qi] : null; }
  function playerIds() { return G.order.filter(function (id) { return G.players[id]; }); }
  function newPin() {
    var b = new Uint32Array(1); crypto.getRandomValues(b);
    return String(100000 + (b[0] % 900000));
  }
  function ranked() {
    var ids = playerIds().slice().sort(function (a, b) {
      var pa = G.players[a], pb = G.players[b];
      return pb.score - pa.score || pa.name.localeCompare(pb.name);
    });
    var out = [], prev = null, rank = 0;
    ids.forEach(function (id, i) {
      var p = G.players[id];
      if (prev === null || p.score !== prev) { rank = i + 1; prev = p.score; }
      out.push({ id: id, p: p, rank: rank });
    });
    return out;
  }

  function buildState() {
    var q = curQ(), t = now();
    var s = { seq: nextSeq(), pin: G.pin, phase: G.phase, qi: G.qi, total: G.quiz.questions.length,
      title: G.quiz.title, pc: playerIds().length };
    if (q && (G.phase === "ready" || G.phase === "question" || G.phase === "reveal")) {
      s.q = { th: q.th, en: q.en, o: q.o, t: q.t, img: q.img || "" };
    }
    if (G.phase === "ready") s.remain = Math.max(0, READY_MS - (t - G.readyStart));
    if (G.phase === "question") { s.remain = Math.max(0, q.t * 1000 - (t - G.qStart)); s.ans = Object.keys(G.cur); }
    if (G.phase === "reveal") { s.correct = q.c; s.dist = dist(); s.x = q.x; }
    var pl = {};
    ranked().forEach(function (r) {
      var a = G.qi >= 0 ? r.p.ans[G.qi] : null;
      pl[r.id] = [r.p.name, r.p.score, r.rank, a ? a.pts : 0, a ? (a.ok ? 1 : (a.c >= 0 ? 0 : -1)) : -1, r.p.streak];
    });
    s.pl = pl;
    s.kicked = Object.keys(G.kicked);
    return s;
  }
  function publishNow() {
    clearTimeout(pubT); pubT = null;
    if (!bus || !G) return;
    lastBeat = now();
    bus.pub("state", buildState(), { retain: true, qos: 1 });
  }
  function schedulePublish() { if (!pubT) pubT = setTimeout(publishNow, 250); }

  function dist() {
    var d = [0, 0, 0, 0];
    Object.keys(G.cur).forEach(function (id) { var a = G.cur[id]; if (a && a.c >= 0 && a.c < 4) d[a.c]++; });
    return d;
  }

  /* ---------- networking ---------- */
  function startBus() {
    if (bus) bus.stop();
    bus = new window.Bus(window.busTopicPrefix(G.pin), {
      onMessage: onMessage,
      onStatus: function (n, total) {
        var el = $("net");
        el.className = "net " + (n > 0 ? "ok" : "bad");
        el.lastElementChild.textContent = n > 0 ? "ออนไลน์ " + n + "/" + total + " เซิร์ฟเวอร์" : (typeof window.mqtt === "undefined" ? "โหลดไลบรารีไม่สำเร็จ" : "กำลังเชื่อมต่อ…");
      },
      onConnect: function () { publishNow(); }
    });
    bus.sub("join");
    bus.sub("ans");
    bus.start();
  }

  function onMessage(topic, d) {
    if (!G) return;
    var pid = typeof d.pid === "string" ? d.pid.slice(0, 40) : "";
    if (!/^[a-z0-9]{6,40}$/.test(pid)) return;
    if (topic === "join") onJoin(pid, d);
    else if (topic === "ans") onAnswer(pid, d);
  }

  function onJoin(pid, d) {
    if (G.kicked[pid]) { schedulePublish(); return; }
    if (G.players[pid]) { schedulePublish(); return; }
    if (G.phase === "final") return;
    if (playerIds().length >= MAX_PLAYERS) return;
    var name = str(d.name, 40).replace(/\s+/g, " ").trim().slice(0, 20);
    if (!name) return;
    var base = name, n = 2, taken = function (nm) {
      return playerIds().some(function (id) { return G.players[id].name.toLowerCase() === nm.toLowerCase(); });
    };
    while (taken(name)) { name = base.slice(0, 17) + " " + n; n++; }
    G.players[pid] = { name: name, score: 0, streak: 0, ans: {} };
    G.order.push(pid);
    save();
    if (G.phase === "lobby") { Q.sfx.pop(); renderLobby(); }
    publishNow();
  }

  function onAnswer(pid, d) {
    if (G.phase !== "question" || !G.players[pid] || G.kicked[pid]) return;
    if (d.qi !== G.qi || G.cur[pid]) { schedulePublish(); return; }
    var q = curQ(), c = parseInt(d.c, 10);
    if (!(c >= 0 && c < 4) || !filled(q.o[c])) return;
    var ms = now() - G.qStart;
    if (ms > q.t * 1000 + 1200) return;
    G.cur[pid] = { c: c, ms: Math.max(0, Math.min(ms, q.t * 1000)) };
    save();
    renderAnswered();
    if (Object.keys(G.cur).length >= playerIds().length) endQuestion();
    else schedulePublish();
  }

  /* ---------- flow ---------- */
  function createGame() {
    Q.sfx.unlock();
    G = { pin: newPin(), setId: curSetId, quiz: prepareQuiz(quiz), phase: "lobby", qi: -1, players: {}, order: [], kicked: {},
      cur: {}, qStart: 0, readyStart: 0, created: now() };
    save(); startBus(); render(); startTick();
  }
  function startQuestion(i) {
    G.qi = i; G.cur = {}; G.phase = "ready"; G.readyStart = now();
    save(); render(); publishNow();
  }
  function beginAnswering() {
    G.phase = "question"; G.qStart = now(); lastTickSec = -1;
    save(); Q.sfx.go(); render(); publishNow();
  }
  function endQuestion() {
    if (G.phase !== "question") return;
    var q = curQ();
    playerIds().forEach(function (id) {
      var p = G.players[id], a = G.cur[id];
      if (a && a.c === q.c) {
        p.streak += 1;
        var pts = Math.round(1000 * (1 - 0.5 * (a.ms / (q.t * 1000))));
        var bonus = Math.min((p.streak - 1) * 100, 500);
        p.ans[G.qi] = { c: a.c, ms: a.ms, pts: pts + bonus, ok: true };
        p.score += pts + bonus;
      } else {
        p.streak = 0;
        p.ans[G.qi] = { c: a ? a.c : -1, ms: a ? a.ms : null, pts: 0, ok: false };
      }
    });
    G.phase = "reveal";
    save(); Q.sfx.end(); render(); publishNow();
  }
  function next() {
    if (G.phase === "reveal") { G.phase = "leaderboard"; }
    else if (G.phase === "leaderboard") {
      if (G.qi + 1 < G.quiz.questions.length) { startQuestion(G.qi + 1); return; }
      G.phase = "final"; Q.sfx.fanfare();
    } else if (G.phase === "ready") { beginAnswering(); return; }
    else if (G.phase === "question") { endQuestion(); return; }
    save(); render(); publishNow();
  }

  function startTick() {
    clearInterval(tickT);
    tickT = setInterval(tick, 200);
  }
  function tick() {
    if (!G) return;
    var t = now(), q = curQ();
    if (G.phase === "ready") {
      var r = t - G.readyStart;
      $("readyFill").style.width = Math.min(100, (r / READY_MS) * 100) + "%";
      if (r >= READY_MS) { beginAnswering(); return; }
    } else if (G.phase === "question") {
      var total = q.t * 1000, left = total - (t - G.qStart);
      var sec = Math.max(0, Math.ceil(left / 1000));
      $("timerN").textContent = sec;
      $("timer").style.setProperty("--p", Math.max(0, (left / total) * 100) + "%");
      $("timer").classList.toggle("low", sec <= 5);
      if (sec !== lastTickSec) { lastTickSec = sec; if (sec <= 5 && sec > 0) Q.sfx.tick(); }
      if (left <= 0) { endQuestion(); return; }
    }
    var beat = (G.phase === "ready" || G.phase === "question") ? 2000 : 6000;
    if (bus && t - lastBeat > beat) publishNow();
  }

  /* ---------- render ---------- */
  var SCREENS = ["sSetup", "sLobby", "sQ", "sLb", "sFinal"];
  function show(id) { SCREENS.forEach(function (s) { $(s).classList.toggle("hidden", s !== id); }); }
  function render() {
    if (!G) { renderSetup(); show("sSetup"); return; }
    if (G.phase === "lobby") { renderLobby(); show("sLobby"); }
    else if (G.phase === "ready" || G.phase === "question" || G.phase === "reveal") { renderQ(); show("sQ"); }
    else if (G.phase === "leaderboard") { renderLb(); show("sLb"); }
    else if (G.phase === "final") { renderFinal(); show("sFinal"); }
    window.scrollTo(0, 0);
  }

  function renderSets() {
    $("sets").innerHTML = SETS.map(function (s, i) {
      return '<button type="button" class="setcard' + (s.id === curSetId ? " on" : "") + '" data-set="' + esc(s.id) + '" aria-pressed="' + (s.id === curSetId) + '">' +
        '<span class="ico">' + esc(s.icon) + '</span><span class="num">' + (i + 1) + '</span>' +
        '<span class="st">' + esc(s.title.th || s.title.en) + "</span>" + (s.title.en && s.title.th ? '<span class="se">' + esc(s.title.en) + "</span>" : "") +
        (isCustom(s.id) ? '<span class="badge">\u0e41\u0e01\u0e49\u0e44\u0e02\u0e41\u0e25\u0e49\u0e27</span>' : "") + "</button>";
    }).join("");
  }
  function renderSetup() {
    renderSets();
    $("optShuffleQ").checked = opts.sq; $("optShuffleA").checked = opts.sa; $("optTime").value = String(opts.t);
    $("setupTitle").innerHTML = Q.bi(quiz.title.th || quiz.title.en ? quiz.title : { th: "ควิซความปลอดภัย", en: "Safety Quiz" });
    var secs = quiz.questions.reduce(function (s, q) { return s + (opts.t || q.t); }, 0);
    $("setupMeta").textContent = quiz.questions.length + " คำถาม · ประมาณ " + Math.max(1, Math.round((secs + quiz.questions.length * 20) / 60)) + " นาที · " + quiz.questions.length + " questions";
    $("qList").innerHTML = quiz.questions.map(function (q) {
      return "<li>" + esc(q.th || q.en) + (q.th && q.en ? "<small>" + esc(q.en) + "</small>" : "") + "</li>";
    }).join("");
    var saved = Q.store.get(GAME_KEY, null);
    var ok = saved && saved.pin && saved.phase && saved.phase !== "final" && saved.quiz && now() - (saved.created || 0) < 12 * 3600 * 1000;
    $("resumeBox").classList.toggle("hidden", !ok);
    if (ok) {
      var n = (saved.order || []).length;
      $("resumeInfo").textContent = (saved.setId ? setById(saved.setId).title.th + " · " : "") + "PIN " + saved.pin + " · " + n + " ผู้เล่น · " + (saved.qi >= 0 ? "ข้อ " + (saved.qi + 1) + "/" + saved.quiz.questions.length : "ห้องรอ");
    }
  }

  function joinUrl() {
    var base = location.href.split(/[?#]/)[0].replace(/host\.html$/, "");
    return base + "?pin=" + G.pin + window.busBrokerParam();
  }

  function renderLobby() {
    $("pin").textContent = G.pin.slice(0, 3) + " " + G.pin.slice(3);
    var url = joinUrl();
    $("joinUrl").textContent = url.replace(/^https?:\/\//, "").split("?")[0];
    if ($("qr").dataset.url !== url) {
      try {
        var qr = window.qrcode(0, "M"); qr.addData(url); qr.make();
        $("qr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      } catch (e) { $("qr").textContent = url; }
      $("qr").dataset.url = url;
    }
    var ids = playerIds();
    $("pCount").textContent = ids.length;
    $("btnStart").disabled = ids.length === 0;
    $("chips").innerHTML = ids.slice().reverse().map(function (id) {
      return '<button type="button" class="chip" data-kick="' + esc(id) + '" title="นำออก · Remove">' + esc(G.players[id].name) + "</button>";
    }).join("");
  }

  function optHtml(q, i, extra) {
    if (!filled(q.o[i])) return "";
    return '<div class="opt ' + Q.COLORS[i] + " " + (extra || "") + '">' + Q.SHAPES[i] + "<div>" + Q.bi(q.o[i]) + "</div>" +
      (G.phase === "reveal" ? '<span class="cnt">' + dist()[i] + "</span>" : "") + "</div>";
  }
  function renderQ() {
    var q = curQ();
    $("qNum").textContent = "ข้อ " + (G.qi + 1) + " / " + G.quiz.questions.length;
    $("qText").innerHTML = Q.bi(q);
    var art = q.img && window.QUIZ_ART && window.QUIZ_ART[q.img];
    $("qImg").classList.toggle("hidden", !art);
    if (art) $("qImg").innerHTML = art;
    var ready = G.phase === "ready", reveal = G.phase === "reveal";
    $("readyBar").classList.toggle("hidden", !ready);
    $("timer").classList.toggle("hidden", G.phase !== "question");
    $("btnSkip").classList.toggle("hidden", G.phase !== "question");
    $("btnNext").classList.toggle("hidden", !reveal);
    $("btnNext").textContent = "คะแนน · Scores ▶";
    var ex = $("explain");
    ex.classList.toggle("hidden", !(reveal && (q.x.th || q.x.en)));
    ex.innerHTML = reveal ? '<small class="exlab">✓ เฉลย · Key point</small>' + Q.bi(q.x) : "";
    $("qOpts").classList.toggle("hidden", ready);
    $("qOpts").innerHTML = [0, 1, 2, 3].map(function (i) {
      return optHtml(q, i, reveal ? (i === q.c ? "correct" : "dim") : "");
    }).join("");
    if (G.phase === "question") {
      var left = q.t * 1000 - (now() - G.qStart);
      $("timerN").textContent = Math.max(0, Math.ceil(left / 1000));
      $("timer").style.setProperty("--p", Math.max(0, (left / (q.t * 1000)) * 100) + "%");
    }
    if (ready) $("readyFill").style.width = "0%";
    renderAnswered();
  }
  function renderAnswered() {
    if (!G || G.phase === "lobby" || G.qi < 0) return;
    var n = Object.keys(G.cur).length, total = playerIds().length;
    $("qAnswered").textContent = G.phase === "ready" ? total + " ผู้เล่น" : "ตอบแล้ว " + n + " / " + total + " · answered";
  }

  function renderLb() {
    var r = ranked().slice(0, 5);
    var last = G.qi + 1 >= G.quiz.questions.length;
    $("btnNext2").textContent = last ? "ผลสุดท้าย · Final ▶" : "ข้อถัดไป · Next question ▶";
    $("lb").innerHTML = r.length ? r.map(function (x) {
      return '<li><span class="rk">' + x.rank + '</span><span class="nm">' + esc(x.p.name) + "</span>" +
        (x.p.streak >= 2 ? '<span class="stk">🔥 ' + x.p.streak + "</span>" : "") +
        '<span class="sc">' + Q.fmt(x.p.score) + "</span></li>";
    }).join("") : '<li><span class="nm">ยังไม่มีผู้เล่น · No players</span></li>';
  }

  function renderFinal() {
    var r = ranked();
    var top = [r[1], r[0], r[2]];
    $("podium").innerHTML = top.map(function (x, i) {
      if (!x) return '<div class="pod" aria-hidden="true"></div>';
      var cls = ["p2", "p1", "p3"][i];
      return '<div class="pod ' + cls + '"><div class="nm">' + esc(x.p.name) + '</div><div class="blk">' + x.rank +
        "<small>" + Q.fmt(x.p.score) + "</small></div></div>";
    }).join("");
    var n = G.quiz.questions.length, head = '<tr><th>#</th><th class="l">ชื่อ · Name</th><th>คะแนน</th><th>ถูก</th>';
    for (var i = 0; i < n; i++) head += "<th>Q" + (i + 1) + "</th>";
    var rows = r.map(function (x) {
      var ok = 0, cells = "";
      for (var j = 0; j < n; j++) {
        var a = x.p.ans[j];
        if (a && a.ok) ok++;
        cells += "<td>" + (!a ? "–" : a.ok ? '<span class="ok">✓</span>' : a.c >= 0 ? '<span class="no">✗</span>' : '<span class="muted">–</span>') + "</td>";
      }
      return "<tr><td>" + x.rank + '</td><td class="l">' + esc(x.p.name) + '</td><td class="n">' + Q.fmt(x.p.score) + "</td><td>" + ok + "/" + n + "</td>" + cells + "</tr>";
    }).join("");
    $("results").innerHTML = "<thead>" + head + "</tr></thead><tbody>" + (rows || '<tr><td colspan="4">ไม่มีผู้เล่น</td></tr>') + "</tbody>";
  }

  function csv() {
    var n = G.quiz.questions.length, q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var head = ["Rank", "Name", "Score", "Correct", "Total"];
    for (var i = 0; i < n; i++) head.push("Q" + (i + 1));
    var lines = [head.join(",")];
    ranked().forEach(function (x) {
      var ok = 0, cells = [];
      for (var j = 0; j < n; j++) { var a = x.p.ans[j]; if (a && a.ok) ok++; cells.push(!a ? "" : a.ok ? "1" : (a.c >= 0 ? "0" : "-")); }
      lines.push([x.rank, q(x.p.name), x.p.score, ok, n].concat(cells).join(","));
    });
    var d = new Date(G.created), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    Q.download("SafetyQuiz_" + stamp + "_PIN" + G.pin + ".csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
  }

  /* ---------- confirm ---------- */
  var confirmCb = null;
  function ask(msg, cb) { $("confirmMsg").textContent = msg; confirmCb = cb; $("confirmBox").classList.remove("hidden"); $("confirmYes").focus(); }
  $("confirmNo").addEventListener("click", function () { $("confirmBox").classList.add("hidden"); confirmCb = null; });
  $("confirmYes").addEventListener("click", function () { $("confirmBox").classList.add("hidden"); var c = confirmCb; confirmCb = null; if (c) c(); });

  /* ---------- editor ---------- */
  var ed = null;
  function edRender() {
    $("edTitleTh").value = ed.title.th; $("edTitleEn").value = ed.title.en;
    $("edList").innerHTML = ed.questions.map(function (q, i) {
      var opts = q.o.map(function (o, j) {
        return '<div class="ed-o"><span class="sw ' + Q.COLORS[j] + '">' + Q.SHAPES[j] + "</span>" +
          '<input data-f="o' + j + 'th" value="' + esc(o.th) + '" placeholder="ตัวเลือก ' + (j + 1) + ' (ไทย)" maxlength="160">' +
          '<input data-f="o' + j + 'en" value="' + esc(o.en) + '" placeholder="Option ' + (j + 1) + ' (EN)" maxlength="160">' +
          '<label class="rad"><input type="radio" name="c' + i + '" data-f="c" value="' + j + '"' + (q.c === j ? " checked" : "") + "> ✓ คำตอบที่ถูก · correct</label></div>";
      }).join("");
      var times = [5, 10, 15, 20, 30, 45, 60, 90, 120].map(function (t) { return '<option value="' + t + '"' + (q.t === t ? " selected" : "") + ">" + t + " วินาที</option>"; }).join("");
      return '<div class="ed-q" data-i="' + i + '"><div class="qh"><b>ข้อ ' + (i + 1) + "</b>" +
        '<select data-f="t" aria-label="เวลา" style="width:auto">' + times + "</select>" +
        '<button type="button" class="ed-mini" data-act="up" ' + (i === 0 ? "disabled" : "") + ' aria-label="เลื่อนขึ้น">▲</button>' +
        '<button type="button" class="ed-mini" data-act="down" ' + (i === ed.questions.length - 1 ? "disabled" : "") + ' aria-label="เลื่อนลง">▼</button>' +
        '<button type="button" class="ed-mini" data-act="dup">ทำซ้ำ</button>' +
        '<button type="button" class="ed-mini del" data-act="del">ลบ</button></div>' +
        '<div class="two"><textarea data-f="th" placeholder="คำถาม (ไทย)" maxlength="300">' + esc(q.th) + '</textarea><textarea data-f="en" placeholder="Question (English)" maxlength="300">' + esc(q.en) + "</textarea></div>" +
        opts +
        '<div class="two"><textarea data-f="xth" placeholder="คำอธิบายเฉลย (ไทย) – ไม่บังคับ" maxlength="400">' + esc(q.x.th) + '</textarea><textarea data-f="xen" placeholder="Explanation (EN) – optional" maxlength="400">' + esc(q.x.en) + "</textarea></div></div>";
    }).join("");
    $("edErr").textContent = "";
  }
  function edOpen() { ed = clone(quiz); edRender(); try { $("editor").showModal(); } catch (e) { $("editor").setAttribute("open", ""); } }
  function edClose() { try { $("editor").close(); } catch (e) { $("editor").removeAttribute("open"); } }
  $("edList").addEventListener("input", edField);
  $("edList").addEventListener("change", edField);
  function edField(e) {
    var el = e.target, f = el.dataset.f, box = el.closest(".ed-q"); if (!f || !box) return;
    var q = ed.questions[+box.dataset.i]; if (!q) return;
    var m = /^o(\d)(th|en)$/.exec(f);
    if (m) q.o[+m[1]][m[2]] = el.value;
    else if (f === "c") q.c = +el.value;
    else if (f === "t") q.t = +el.value;
    else if (f === "xth") q.x.th = el.value;
    else if (f === "xen") q.x.en = el.value;
    else if (f === "th" || f === "en") q[f] = el.value;
    box.classList.remove("err");
  }
  $("edList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var i = +b.closest(".ed-q").dataset.i, a = b.dataset.act, qs = ed.questions;
    if (a === "del") { if (qs.length <= 1) { $("edErr").textContent = "ต้องมีอย่างน้อย 1 คำถาม"; return; } qs.splice(i, 1); }
    if (a === "dup") qs.splice(i + 1, 0, clone(qs[i]));
    if (a === "up" && i > 0) { var t = qs[i - 1]; qs[i - 1] = qs[i]; qs[i] = t; }
    if (a === "down" && i < qs.length - 1) { var u = qs[i + 1]; qs[i + 1] = qs[i]; qs[i] = u; }
    edRender();
  });
  $("edAdd").addEventListener("click", function () {
    if (ed.questions.length >= 100) return;
    ed.questions.push(normQ({ t: 20 }));
    edRender();
    var l = $("edList"); l.scrollTop = l.scrollHeight;
    var last = l.querySelector(".ed-q:last-child textarea"); if (last) last.focus();
  });
  $("edSave").addEventListener("click", function () {
    ed.title = { th: $("edTitleTh").value.trim(), en: $("edTitleEn").value.trim() };
    var bad = -1;
    ed.questions.forEach(function (q, i) {
      var err = qErrors(q).length > 0;
      var box = $("edList").querySelector('.ed-q[data-i="' + i + '"]');
      if (box) box.classList.toggle("err", err);
      if (err && bad < 0) bad = i;
    });
    if (bad >= 0) {
      $("edErr").textContent = "ข้อ " + (bad + 1) + ": " + qErrors(ed.questions[bad]).join(", ");
      var b = $("edList").querySelector('.ed-q[data-i="' + bad + '"]'); if (b) b.scrollIntoView({ block: "center" });
      return;
    }
    quiz = normQuiz(ed);
    if (JSON.stringify(quiz) === JSON.stringify(defaultQuiz(curSetId))) Q.store.del(customKey(curSetId)); else Q.store.set(customKey(curSetId), quiz);
    edClose(); renderSetup(); Q.toast("บันทึกแล้ว · Saved");
  });
  $("edCancel").addEventListener("click", edClose);
  $("edReset").addEventListener("click", function () { ed = defaultQuiz(curSetId); edRender(); Q.toast("คืนค่าเริ่มต้นแล้ว — กดบันทึกเพื่อใช้"); });
  $("edExport").addEventListener("click", function () { Q.download("safety-quiz-questions.json", JSON.stringify(ed, null, 2), "application/json"); });
  $("edImport").addEventListener("click", function () { $("edFile").value = ""; $("edFile").click(); });
  $("edFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { var q = normQuiz(JSON.parse(rd.result)); if (!q) throw new Error("empty"); ed = q; edRender(); Q.toast("นำเข้า " + q.questions.length + " คำถาม — กดบันทึกเพื่อใช้"); }
      catch (e) { $("edErr").textContent = "ไฟล์ JSON ไม่ถูกต้อง · Invalid file"; }
    };
    rd.readAsText(f);
  });
  $("editor").addEventListener("cancel", function () { /* Esc closes */ });

  /* ---------- buttons ---------- */
  $("btnCreate").addEventListener("click", function () {
    var saved = Q.store.get(GAME_KEY, null);
    if (saved && saved.phase && saved.phase !== "final" && !$("resumeBox").classList.contains("hidden")) {
      ask("มีเกมค้างอยู่ สร้างเกมใหม่แทน? · Replace the unfinished game?", createGame);
    } else createGame();
  });
  $("btnEdit").addEventListener("click", edOpen);
  $("btnResume").addEventListener("click", function () {
    var s = Q.store.get(GAME_KEY, null); if (!s) return;
    Q.sfx.unlock();
    G = s; G.cur = G.cur || {}; G.kicked = G.kicked || {};
    startBus(); render(); startTick();
  });
  $("btnDiscard").addEventListener("click", function () { Q.store.del(GAME_KEY); renderSetup(); });
  $("sets").addEventListener("click", function (e) {
    var b = e.target.closest("[data-set]"); if (!b) return;
    curSetId = setById(b.dataset.set).id; Q.store.set(SET_KEY, curSetId);
    quiz = loadQuiz(curSetId); renderSetup();
    var card = $("setupTitle"); if (card && card.scrollIntoView && window.innerWidth < 900) card.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  function saveOpts() { Q.store.set(OPT_KEY, opts); renderSetup(); }
  $("optShuffleQ").addEventListener("change", function () { opts.sq = this.checked; saveOpts(); });
  $("optShuffleA").addEventListener("change", function () { opts.sa = this.checked; saveOpts(); });
  $("optTime").addEventListener("change", function () { opts.t = +this.value || 0; saveOpts(); });
  $("btnStart").addEventListener("click", function () { if (playerIds().length) { Q.sfx.unlock(); startQuestion(0); } });
  $("btnSkip").addEventListener("click", function () { if (G && G.phase === "question") endQuestion(); });
  $("btnNext").addEventListener("click", next);
  $("btnNext2").addEventListener("click", next);
  $("btnCsv").addEventListener("click", csv);
  $("btnNew").addEventListener("click", function () {
    ask("จบเกมนี้และกลับหน้าแรก? (ดาวน์โหลด CSV ก่อนถ้าต้องการ)", function () {
      if (bus) { bus.pub("state", null, { retain: true }); var b = bus; setTimeout(function () { b.stop(); }, 800); bus = null; }
      clearInterval(tickT); Q.store.del(GAME_KEY); G = null; render();
    });
  });
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-kick]"); if (!b || !G) return;
    var id = b.dataset.kick, p = G.players[id]; if (!p) return;
    ask("นำ \"" + p.name + "\" ออกจากเกม?", function () {
      G.kicked[id] = 1; delete G.players[id]; G.order = G.order.filter(function (x) { return x !== id; });
      save(); renderLobby(); publishNow();
    });
  });
  $("btnCopy").addEventListener("click", function () {
    var url = joinUrl();
    try { navigator.clipboard.writeText(url).then(function () { Q.toast("คัดลอกแล้ว · Copied"); }, function () { Q.toast(url); }); }
    catch (e) { Q.toast(url); }
  });
  function muteLabel() { $("btnMute").textContent = Q.isMuted() ? "🔇 ปิดเสียง" : "🔊 เสียง"; }
  $("btnMute").addEventListener("click", function () { Q.setMuted(!Q.isMuted()); muteLabel(); Q.sfx.unlock(); });
  $("btnFull").addEventListener("click", function () {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else { var p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* not supported */ }
  });
  document.addEventListener("keydown", function (e) {
    if (!G || e.target.closest("input,textarea,select,dialog")) return;
    if ((e.key === " " || e.key === "ArrowRight") && (G.phase === "reveal" || G.phase === "leaderboard")) { e.preventDefault(); next(); }
  });
  window.addEventListener("beforeunload", function (e) {
    if (G && G.phase !== "lobby" && G.phase !== "final") { e.preventDefault(); e.returnValue = ""; }
  });

  muteLabel();
  if (typeof window.mqtt === "undefined") { $("net").className = "net bad"; $("net").lastElementChild.textContent = "โหลดไลบรารีไม่สำเร็จ"; }
  else { $("net").lastElementChild.textContent = "พร้อม · Ready"; }
  render();
})();
