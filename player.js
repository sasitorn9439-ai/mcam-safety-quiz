(function () {
  "use strict";
  var $ = Q.$, esc = Q.esc;
  var SESSION_KEY = "mcamq_session", NAME_KEY = "mcamq_name";

  var sess = null;          // {pin, pid, name}
  var bus = null, S = null, lastSeq = 0;
  var joinT = null, notFoundT = null, uiT = null, ansT = null;
  var myAns = {};           // qi -> choice
  var deadline = 0, shownQi = -1, resultQi = -1, lastView = "";

  function params() { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } }
  function cleanPin(v) { return String(v || "").replace(/\D/g, "").slice(0, 6); }

  /* ---------- views ---------- */
  var VIEWS = ["vJoin", "vMsg", "vAns", "vRes"];
  function view(id) {
    VIEWS.forEach(function (v) { $(v).classList.toggle("hidden", v !== id); });
    if (id !== "vRes") document.body.classList.remove("good", "bad");
    lastView = id;
  }
  function msg(ico, title, sub, opt) {
    opt = opt || {};
    $("msgIco").textContent = ico;
    $("msgTitle").textContent = title;
    $("msgSub").textContent = sub || "";
    $("msgBar").classList.toggle("hidden", !opt.bar);
    var b = $("msgBtn");
    b.classList.toggle("hidden", !opt.btn);
    if (opt.btn) { b.textContent = opt.btn; b.onclick = opt.onBtn; }
    $("msgIco").classList.toggle("pulse", !!opt.pulse);
    view("vMsg");
  }
  function header() {
    $("hdrName").textContent = sess ? sess.name : "";
    var me = S && sess && S.pl ? S.pl[sess.pid] : null;
    $("hdrScore").textContent = me ? Q.fmt(me[1]) : "";
  }

  /* ---------- join ---------- */
  function showJoin(err) {
    stopAll();
    view("vJoin");
    $("joinErr").textContent = err || "";
    header();
  }
  $("inPin").addEventListener("input", function () {
    var p = cleanPin(this.value);
    this.value = p.length > 3 ? p.slice(0, 3) + " " + p.slice(3) : p;
  });
  $("joinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    Q.sfx.unlock();
    var pin = cleanPin($("inPin").value);
    var name = $("inName").value.replace(/\s+/g, " ").trim().slice(0, 20);
    if (pin.length !== 6) { $("joinErr").textContent = "PIN ต้องมี 6 หลัก · PIN must be 6 digits"; $("inPin").focus(); return; }
    if (!name) { $("joinErr").textContent = "กรุณาใส่ชื่อ · Please enter your name"; $("inName").focus(); return; }
    Q.store.set(NAME_KEY, name);
    var old = Q.store.get(SESSION_KEY, null);
    var pid = old && old.pin === pin && old.pid ? old.pid : window.busRid(16);
    sess = { pin: pin, pid: pid, name: name };
    Q.store.set(SESSION_KEY, sess);
    connect();
  });

  function stopAll() {
    clearInterval(joinT); clearTimeout(notFoundT); clearInterval(uiT); clearInterval(ansT);
    joinT = notFoundT = uiT = ansT = null;
    if (bus) { bus.stop(); bus = null; }
    S = null; lastSeq = 0; shownQi = -1; resultQi = -1;
  }

  function connect() {
    stopAll();
    myAns = {};
    header();
    if (typeof window.mqtt === "undefined") {
      msg("⚠️", "โหลดระบบไม่สำเร็จ", "ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ · Could not load. Check your connection.", { btn: "ลองใหม่ · Retry", onBtn: function () { location.reload(); } });
      return;
    }
    msg("📡", "กำลังเชื่อมต่อ…", "Connecting to game " + sess.pin.slice(0, 3) + " " + sess.pin.slice(3), { pulse: true });
    bus = new window.Bus(window.busTopicPrefix(sess.pin), {
      onMessage: onMessage,
      onStatus: function (n) {
        $("net").className = "net " + (n > 0 ? "ok" : "bad");
        $("net").title = n > 0 ? "เชื่อมต่อแล้ว · Online" : "ไม่ได้เชื่อมต่อ · Offline";
      },
      onConnect: function () { sendJoin(); }
    });
    bus.sub("state");
    bus.start();
    joinT = setInterval(function () { if (!joined()) sendJoin(); }, 2000);
    notFoundT = setTimeout(function () {
      if (!S) msg("🔍", "ไม่พบเกม PIN นี้", "ตรวจสอบ PIN ให้ตรงกับบนจอ หรือรอให้ผู้ดำเนินเกมสร้างเกม · Game not found — check the PIN.",
        { btn: "แก้ไข PIN · Change PIN", onBtn: function () { Q.store.del(SESSION_KEY); showJoin(); }, pulse: true });
    }, 9000);
    uiT = setInterval(uiTick, 200);
  }
  function joined() { return !!(S && S.pl && S.pl[sess.pid]); }
  function sendJoin() { if (bus && sess) bus.pub("join", { pid: sess.pid, name: sess.name }, { qos: 1 }); }

  /* ---------- state ---------- */
  function onMessage(topic, d) {
    if (topic !== "state" || !sess) return;
    if (typeof d.seq !== "number" || d.seq <= lastSeq || d.pin !== sess.pin) return;
    lastSeq = d.seq;
    S = d;
    clearTimeout(notFoundT);
    if (typeof d.remain === "number") {
      var nd = Date.now() + d.remain;
      if (!deadline || Math.abs(nd - deadline) > 600 || d.phase !== "question") deadline = nd;
    }
    render();
  }

  function render() {
    header();
    if (!S) return;
    if (Array.isArray(S.kicked) && S.kicked.indexOf(sess.pid) >= 0) {
      Q.store.del(SESSION_KEY);
      var name = sess.name;
      stopAll();
      msg("🚫", "คุณถูกนำออกจากเกม", "You were removed by the host.", { btn: "เข้าร่วมใหม่ · Join again", onBtn: function () { $("inName").value = name; showJoin(); } });
      return;
    }
    var me = S.pl ? S.pl[sess.pid] : null;
    if (!me) {
      if (S.phase === "final") msg("🏁", "เกมนี้จบแล้ว", "This game has ended.", { btn: "กลับ · Back", onBtn: function () { Q.store.del(SESSION_KEY); showJoin(); } });
      else msg("🙋", "กำลังเข้าร่วม…", "Joining the game…", { pulse: true });
      return;
    }
    if (sess.name !== me[0]) { sess.name = me[0]; Q.store.set(SESSION_KEY, sess); header(); }
    var total = S.total, qn = "ข้อ " + (S.qi + 1) + "/" + total;
    switch (S.phase) {
      case "lobby":
        msg("🎉", "เข้าร่วมแล้ว!", "You're in! ดูชื่อของคุณบนจอ แล้วรอผู้ดำเนินเกมเริ่ม · " + S.pc + " ผู้เล่น", { pulse: true });
        break;
      case "ready":
        msg("⚡", "เตรียมตัว!", qn + " · Get ready…", { bar: true });
        break;
      case "question":
        if (myAns[S.qi] != null) showAnswered();
        else if (deadline - Date.now() <= 0) msg("⌛", "หมดเวลา", "Time's up", {});
        else showQuestion();
        break;
      case "reveal":
        showResult(me);
        break;
      case "leaderboard":
        showStanding(me);
        break;
      case "final":
        showFinal(me);
        break;
    }
  }

  function showQuestion() {
    var q = S.q; if (!q) return;
    if (shownQi !== S.qi || lastView !== "vAns") {
      shownQi = S.qi;
      $("aNum").textContent = (S.qi + 1) + "/" + S.total;
      $("aQ").innerHTML = Q.bi(q);
      $("aOpts").innerHTML = [0, 1, 2, 3].map(function (i) {
        var o = q.o && q.o[i];
        if (!o || !((o.th || "").trim() || (o.en || "").trim())) return "";
        return '<button type="button" class="opt ' + Q.COLORS[i] + '" data-c="' + i + '" aria-label="' + esc(Q.SHAPE_NAMES[i] + ": " + (o.th || o.en)) + '">' +
          Q.SHAPES[i] + "<div>" + Q.bi(o) + "</div></button>";
      }).join("");
      view("vAns");
      Q.sfx.go();
    }
    uiTick();
  }
  $("aOpts").addEventListener("click", function (e) {
    var b = e.target.closest("[data-c]");
    if (!b || !S || S.phase !== "question" || myAns[S.qi] != null) return;
    var c = +b.dataset.c, qi = S.qi;
    myAns[qi] = c;
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (err) { /* ignore */ }
    Q.sfx.pop();
    sendAnswer(qi, c);
    clearInterval(ansT);
    var tries = 0;
    ansT = setInterval(function () {
      tries++;
      var confirmed = S && S.qi === qi && Array.isArray(S.ans) && S.ans.indexOf(sess.pid) >= 0;
      if (confirmed || !S || S.phase !== "question" || S.qi !== qi || tries > 6) { clearInterval(ansT); ansT = null; return; }
      sendAnswer(qi, c);
    }, 1500);
    showAnswered();
  });
  function sendAnswer(qi, c) { if (bus) bus.pub("ans", { pid: sess.pid, qi: qi, c: c }, { qos: 1 }); }

  function showAnswered() {
    var c = myAns[S.qi];
    var ok = Array.isArray(S.ans) && S.ans.indexOf(sess.pid) >= 0;
    msg(["🔺", "🔷", "🟡", "🟩"][c] || "✅", ok ? "ส่งคำตอบแล้ว ✓" : "กำลังส่งคำตอบ…",
      (ok ? "Answer received" : "Sending…") + " · รอผู้เล่นคนอื่น", { pulse: !ok });
  }

  function rankLine(me) { return "อันดับที่ " + me[2] + " จาก " + S.pc + " · Rank " + me[2] + " of " + S.pc; }

  function showResult(me) {
    var got = me[4];
    if (resultQi !== S.qi) { resultQi = S.qi; if (got === 1) Q.sfx.good(); else Q.sfx.bad(); }
    document.body.classList.toggle("good", got === 1);
    document.body.classList.toggle("bad", got !== 1);
    $("resIco").textContent = got === 1 ? "✅" : got === 0 ? "❌" : "⌛";
    $("resTitle").textContent = got === 1 ? "ถูกต้อง! · Correct" : got === 0 ? "ยังไม่ถูก · Incorrect" : "ไม่ทันเวลา · No answer";
    $("resPts").textContent = got === 1 ? "+" + Q.fmt(me[3]) : "";
    $("resStreak").textContent = got === 1 && me[5] >= 2 ? "🔥 ตอบถูกติดกัน " + me[5] + " ข้อ · streak " + me[5] : (got === 1 ? "" : "เป็นกำลังใจให้ข้อต่อไป · Keep going!");
    $("resRank").textContent = rankLine(me);
    var ex = $("resExp"), q = S.q;
    var right = q && q.o && q.o[S.correct];
    var html = "";
    if (got !== 1 && right) html += "<b>คำตอบที่ถูก · Answer:</b>" + Q.bi(right);
    if (S.x && (S.x.th || S.x.en)) html += (html ? "<hr>" : "") + Q.bi(S.x);
    ex.innerHTML = html;
    ex.classList.toggle("hidden", !html);
    view("vRes");
    var box = $("resBox"); box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop");
  }

  function aheadOf(me) {
    var best = null;
    Object.keys(S.pl).forEach(function (id) {
      var p = S.pl[id];
      if (p[1] > me[1] && (best === null || p[1] < best[1])) best = p;
    });
    return best;
  }
  function showStanding(me) {
    var a = aheadOf(me);
    var sub = me[2] === 1 ? "คุณนำอยู่! · You're in the lead!" :
      a ? "ตามหลัง " + a[0] + " อยู่ " + Q.fmt(a[1] - me[1]) + " คะแนน · " + Q.fmt(a[1] - me[1]) + " pts behind" : "";
    msg(me[2] === 1 ? "👑" : "📊", rankLine(me), Q.fmt(me[1]) + " คะแนน · " + sub, {});
  }
  function showFinal(me) {
    var medal = ["🥇", "🥈", "🥉"][me[2] - 1] || "🏁";
    msg(medal, "อันดับที่ " + me[2] + " · Rank " + me[2], Q.fmt(me[1]) + " คะแนน · ขอบคุณที่ร่วมเล่น! Thanks for playing", {
      btn: "ออกจากเกม · Leave", onBtn: function () { Q.store.del(SESSION_KEY); showJoin(); }
    });
    if (resultQi !== "final") { resultQi = "final"; if (me[2] <= 3) Q.sfx.fanfare(); }
  }

  function uiTick() {
    if (!S) return;
    var left = deadline - Date.now();
    if (S.phase === "question" && lastView === "vAns" && S.q) {
      var total = S.q.t * 1000;
      $("aFill").style.width = Math.max(0, Math.min(100, (left / total) * 100)) + "%";
      $("aSec").textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= -300 && myAns[S.qi] == null) msg("⌛", "หมดเวลา", "Time's up", {});
    } else if (S.phase === "ready" && lastView === "vMsg") {
      $("msgFill").style.width = Math.max(0, Math.min(100, 100 - (left / 3000) * 100)) + "%";
    }
  }

  /* ---------- boot ---------- */
  var p = params();
  var urlPin = cleanPin(p.get("pin"));
  var savedName = Q.store.get(NAME_KEY, "");
  if (savedName) $("inName").value = savedName;
  if (urlPin) $("inPin").value = urlPin.slice(0, 3) + " " + urlPin.slice(3);
  var saved = Q.store.get(SESSION_KEY, null);
  if (saved && saved.pin && saved.pid && saved.name && (!urlPin || urlPin === saved.pin)) {
    sess = saved; connect();
  } else {
    showJoin();
    setTimeout(function () { (urlPin ? $("inName") : $("inPin")).focus(); }, 50);
  }
})();
