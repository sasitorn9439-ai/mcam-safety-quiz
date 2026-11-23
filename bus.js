/* Realtime bus: connects to several public MQTT brokers at once and treats them as one.
   Host and players publish to every connected broker; receivers de-duplicate. */
(function () {
  "use strict";
  var DEFAULT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
  ];

  function brokerList() {
    try {
      var p = new URLSearchParams(location.search).get("broker");
      if (p) return p.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    } catch (e) { /* ignore */ }
    return DEFAULT_BROKERS.slice();
  }

  function rid(n) {
    var s = "", a = "abcdefghijkmnpqrstuvwxyz23456789";
    var buf = new Uint32Array(n);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) s += a[buf[i] % a.length];
    return s;
  }

  function Bus(prefix, handlers) {
    this.prefix = prefix;
    this.h = handlers || {};
    this.clients = [];
    this.subs = [];
    this.connected = 0;
  }

  Bus.prototype.start = function () {
    var self = this;
    if (typeof window.mqtt === "undefined") {
      self._status();
      return;
    }
    brokerList().forEach(function (url) {
      var c;
      try {
        c = window.mqtt.connect(url, {
          clientId: "mq_" + rid(10),
          clean: true,
          keepalive: 30,
          reconnectPeriod: 2500,
          connectTimeout: 8000,
          protocolVersion: 4
        });
      } catch (e) {
        return;
      }
      c._ok = false;
      c.on("connect", function () {
        c._ok = true;
        self.subs.forEach(function (t) { c.subscribe(self.prefix + t, { qos: 1 }); });
        self._status();
        if (self.h.onConnect) self.h.onConnect();
      });
      c.on("close", function () { if (c._ok) { c._ok = false; self._status(); } });
      c.on("offline", function () { if (c._ok) { c._ok = false; self._status(); } });
      c.on("error", function () { /* reconnects automatically */ });
      c.on("message", function (topic, payload) {
        if (!payload || !payload.length) return;
        var data;
        try { data = JSON.parse(new TextDecoder().decode(payload)); } catch (e) { return; }
        if (!data || typeof data !== "object") return;
        if (self.h.onMessage) {
          try { self.h.onMessage(topic.slice(self.prefix.length), data); } catch (e) { console.warn(e); }
        }
      });
      self.clients.push(c);
    });
    self._status();
  };

  Bus.prototype._status = function () {
    var n = this.clients.filter(function (c) { return c._ok; }).length;
    this.connected = n;
    if (this.h.onStatus) this.h.onStatus(n, this.clients.length);
  };

  Bus.prototype.sub = function (topic) {
    var self = this;
    if (self.subs.indexOf(topic) < 0) self.subs.push(topic);
    self.clients.forEach(function (c) { if (c._ok) c.subscribe(self.prefix + topic, { qos: 1 }); });
  };

  Bus.prototype.pub = function (topic, obj, opts) {
    var self = this, o = opts || {};
    var msg = obj === null ? "" : JSON.stringify(obj);
    var sent = 0;
    self.clients.forEach(function (c) {
      if (!c._ok) return;
      try { c.publish(self.prefix + topic, msg, { qos: o.qos == null ? 1 : o.qos, retain: !!o.retain }); sent++; } catch (e) { /* ignore */ }
    });
    return sent;
  };

  Bus.prototype.stop = function () {
    this.clients.forEach(function (c) { try { c.end(true); } catch (e) { /* ignore */ } });
    this.clients = [];
  };

  window.Bus = Bus;
  window.busRid = rid;
  window.busTopicPrefix = function (pin) { return "mcamquiz/v1/" + pin + "/"; };
  window.busBrokerParam = function () {
    try { var p = new URLSearchParams(location.search).get("broker"); return p ? "&broker=" + encodeURIComponent(p) : ""; } catch (e) { return ""; }
  };
})();
