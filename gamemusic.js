/* Procedural "countdown" game music (WebAudio, no files).
   A-minor loop (Am–F–G–E) with kick, hats, snare, driving bass and an arpeggio.
   Intensity rises as time runs out: 0 = groove, 1 = faster + brighter, 2 = fastest + high
   tension ticks + snare rolls. A noise riser + drum roll covers the 3-second "get ready". */
(function () {
  "use strict";
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var PROG = [
    { b: 45, c: [57, 60, 64] }, // Am
    { b: 41, c: [53, 57, 60] }, // F
    { b: 43, c: [55, 59, 62] }, // G
    { b: 40, c: [52, 56, 59] }  // E (major: tension back to Am)
  ];
  var BASS = [0, 0, 12, 0, 0, 12, 7, 12];
  var ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 3, 0, 1, 2, 3];
  var BPM = [124, 136, 152];

  function Engine(ctx, out) {
    this.ctx = ctx; this.out = out;
    var len = Math.floor(ctx.sampleRate * 1), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
  }
  Engine.prototype.env = function (t, peak, dur, attack) {
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out);
    return g;
  };
  Engine.prototype.kick = function (t, v) {
    var o = this.ctx.createOscillator(), g = this.env(t, v, 0.28, 0.002);
    o.type = "sine"; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    o.connect(g); o.start(t); o.stop(t + 0.3);
  };
  Engine.prototype.noiseHit = function (t, v, dur, type, freq, q) {
    var s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.env(t, v, dur, 0.002);
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    s.connect(f); f.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  Engine.prototype.hat = function (t, v, open) { this.noiseHit(t, v, open ? 0.11 : 0.035, "highpass", 7500); };
  Engine.prototype.snare = function (t, v) {
    this.noiseHit(t, v, 0.16, "bandpass", 1900, 0.7);
    var o = this.ctx.createOscillator(), g = this.env(t, v * 0.5, 0.09, 0.002);
    o.type = "triangle"; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    o.connect(g); o.start(t); o.stop(t + 0.1);
  };
  Engine.prototype.tone = function (t, m, dur, v, wave, cutoff, q) {
    var o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.env(t, v, dur, 0.005);
    o.type = wave; o.frequency.setValueAtTime(hz(m), t);
    f.type = "lowpass"; f.frequency.setValueAtTime(cutoff, t); f.Q.value = q || 1;
    o.connect(f); f.connect(g); o.start(t); o.stop(t + dur + 0.02);
  };
  Engine.prototype.riser = function (t, dur, v) {
    var s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t); s.stop(t + dur + 0.1);
    /* drum roll that speeds up: 8ths → 16ths → 32nds */
    var x = t, end = t + dur;
    while (x < end - 0.02) {
      var p = (x - t) / dur, gap = p < 0.4 ? 0.2 : p < 0.75 ? 0.1 : 0.05;
      this.snare(x, 0.12 + 0.35 * p);
      x += gap;
    }
    this.tone(t, 45, dur, 0.12, "sawtooth", 300, 1);  // low drone
    this.kick(end, 0.9);
  };
  /* one 16th-note step */
  Engine.prototype.step = function (i, t, spb, lvl) {
    var s = i % 16, ch = PROG[Math.floor(i / 16) % 4];
    if (s % 4 === 0) this.kick(t, 0.85);
    if (lvl >= 2 && (s === 10 || s === 14)) this.kick(t, 0.5);
    this.hat(t, (s % 2 ? 0.11 : 0.05) * (lvl ? 1.25 : 1), s % 4 === 2);
    if (s === 4 || s === 12) this.snare(t, 0.42);
    if (lvl >= 1 && s >= 13) this.snare(t, 0.12 + 0.08 * lvl);
    if (s % 2 === 0) this.tone(t, ch.b + BASS[s / 2], spb * 1.7, 0.3, "sawtooth", 520 + 180 * lvl, 5);
    var arp = ch.c.concat([ch.c[0] + 12]);
    this.tone(t, arp[ARP[s]] + (lvl >= 2 ? 12 : 0), spb * 0.85, 0.075 + 0.025 * lvl, "square", 1500 + 1600 * lvl, 2);
    if (lvl >= 2 && s % 2 === 0) this.tone(t, 81, spb * 0.45, 0.045, "square", 6000, 1);
  };

  /* realtime player with a look-ahead scheduler */
  function Player(ctx, dest) {
    this.ctx = ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.bus.connect(comp); comp.connect(dest);
    this.e = new Engine(ctx, this.bus);
    this.timer = null; this.i = 0; this.next = 0; this.lvl = 0; this.vol = 0.6; this.running = false;
  }
  Player.prototype.fade = function (v, sec) {
    var g = this.bus.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + (sec || 0.25));
  };
  Player.prototype.setVolume = function (v) { this.vol = v; if (this.running) this.fade(v, 0.15); };
  Player.prototype.setLevel = function (l) { this.lvl = Math.max(0, Math.min(2, l | 0)); };
  Player.prototype.pump = function () {
    var spb = 60 / BPM[this.lvl] / 4;
    while (this.next < this.ctx.currentTime + 0.15) {
      this.e.step(this.i, this.next, spb, this.lvl);
      this.next += spb; this.i++;
    }
  };
  Player.prototype.start = function () {
    if (this.running) return;
    var self = this;
    this.running = true; this.i = 0; this.next = this.ctx.currentTime + 0.05;
    this.fade(this.vol, 0.2);
    this.pump();
    clearInterval(this.timer); this.timer = setInterval(function () { self.pump(); }, 25);
  };
  Player.prototype.stop = function () {
    if (!this.running) return;
    var self = this;
    this.running = false; this.fade(0, 0.2);
    clearInterval(this.timer); this.timer = null;
    setTimeout(function () { if (!self.running) { self.i = 0; } }, 300);
  };
  Player.prototype.riser = function (sec) {
    this.stop();
    var t = this.ctx.currentTime + 0.03, g = this.bus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(this.vol, t);
    this.e.riser(t, Math.max(0.5, sec), 0.35);
    var self = this;
    setTimeout(function () { if (!self.running) self.fade(0, 0.3); }, (sec + 0.6) * 1000);
  };

  window.GameMusic = { Engine: Engine, Player: Player, BPM: BPM };
})();
