/* MCAM Safety Quiz — tiny original illustration library for image-based questions.
   Each entry is a self-contained inline SVG (no external images, no fonts, no copyrighted
   logos/characters) keyed by a short id referenced from questions.js via row[6]. */
(function () {
  "use strict";
  var A = {};

  A.loto_locks = '<svg viewBox="0 0 200 120"><rect x="10" y="30" width="180" height="70" rx="6" fill="#2b3550"/>' +
    '<rect x="25" y="45" width="40" height="40" rx="4" fill="#1c2438"/>' +
    [0, 1, 2].map(function (i) { var x = 95 + i * 32;
      return '<g transform="translate(' + x + ',40)"><path d="M6 14 V9 a8 8 0 0 1 16 0 v5" fill="none" stroke="#ffd34d" stroke-width="4"/><rect x="0" y="14" width="28" height="22" rx="4" fill="#ffd34d"/></g>';
    }).join("") + '<text x="100" y="112" text-anchor="middle" font-size="11" fill="#9fb0d9">ล็อก 3 ดอก · 3 locks</text></svg>';

  A.fire_classes = '<svg viewBox="0 0 260 110">' +
    [["A", "#3fae4a", "ไม้/กระดาษ"], ["B", "#d64545", "ของเหลวไวไฟ"], ["C", "#2e7bd6", "ไฟฟ้า"], ["D", "#e8c33d", "โลหะ"], ["K", "#8e5bd8", "น้ำมันครัว"]].map(function (c, i) {
      var x = 10 + i * 50;
      return '<g transform="translate(' + x + ',10)"><circle cx="20" cy="20" r="20" fill="' + c[1] + '"/><text x="20" y="27" text-anchor="middle" font-size="20" fill="#fff" font-weight="700">' + c[0] + "</text>" +
        '<text x="20" y="55" text-anchor="middle" font-size="9" fill="#cdd6ee">' + c[2] + "</text></g>";
    }).join("") + "</svg>";

  A.fall_clearance = '<svg viewBox="0 0 200 130"><line x1="20" y1="10" x2="20" y2="120" stroke="#9fb0d9" stroke-width="3"/>' +
    '<circle cx="20" cy="10" r="6" fill="#ffd34d"/><path d="M20 10 C 60 40, 70 70, 60 95" fill="none" stroke="#ffd34d" stroke-width="3" stroke-dasharray="5 4"/>' +
    '<circle cx="60" cy="95" r="10" fill="#e8622b"/><rect x="0" y="100" width="200" height="20" fill="#2b3550"/>' +
    '<text x="100" y="114" text-anchor="middle" font-size="10" fill="#cdd6ee">ระยะตกต้องไม่ถึงพื้น · fall clearance</text></svg>';

  A.line_of_fire = '<svg viewBox="0 0 200 130"><rect x="70" y="10" width="40" height="35" fill="#9fb0d9"/><line x1="90" y1="45" x2="90" y2="85" stroke="#ffd34d" stroke-width="3" stroke-dasharray="4 4"/>' +
    '<circle cx="45" cy="95" r="9" fill="#e8622b"/><rect x="38" y="104" width="14" height="22" fill="#e8622b"/>' +
    '<path d="M70 125 Q90 105 110 125" fill="none" stroke="#d64545" stroke-width="3"/><text x="100" y="20" text-anchor="middle" font-size="22">⚠️</text></svg>';

  A.ghs_flammable = '<svg viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" fill="#fff" stroke="#d64545" stroke-width="5" transform="rotate(45 60 60)"/>' +
    '<path d="M60 35 C 48 55 45 65 55 78 C 50 70 56 66 58 60 C 64 70 70 72 66 85 C 82 75 82 55 68 42 C 70 50 64 52 62 48 C 62 42 62 38 60 35 Z" fill="#1c2438"/></svg>';

  A.ghs_corrosive = '<svg viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" fill="#fff" stroke="#d64545" stroke-width="5" transform="rotate(45 60 60)"/>' +
    '<path d="M40 40 l10 15 -4 20 h8 l4 -18 8 14 h8 l-10 -16 4 -18 h-8 l-4 16 -8 -13z" fill="#1c2438"/>' +
    '<circle cx="80" cy="82" r="5" fill="#1c2438"/></svg>';

  A.ppe_icons = '<svg viewBox="0 0 260 90">' +
    [["⛑️", "หมวก"], ["🥽", "แว่น"], ["🧤", "ถุงมือ"], ["🥾", "รองเท้า"], ["🦻", "ลดเสียง"]].map(function (c, i) {
      var x = 10 + i * 50;
      return '<g transform="translate(' + x + ',5)"><circle cx="22" cy="24" r="24" fill="#1c2438"/><text x="22" y="33" text-anchor="middle" font-size="22">' + c[0] + "</text>" +
        '<text x="22" y="62" text-anchor="middle" font-size="9" fill="#cdd6ee">' + c[1] + "</text></g>";
    }).join("") + "</svg>";

  A.lift_posture = '<svg viewBox="0 0 220 120">' +
    '<g transform="translate(10,10)"><circle cx="30" cy="10" r="9" fill="#d64545"/><path d="M15 60 Q30 20 45 60" fill="none" stroke="#d64545" stroke-width="6"/><line x1="30" y1="60" x2="30" y2="95" stroke="#d64545" stroke-width="6"/><rect x="18" y="55" width="24" height="18" fill="#9fb0d9"/><text x="30" y="112" text-anchor="middle" font-size="10" fill="#d64545">✗ ก้มหลัง</text></g>' +
    '<g transform="translate(130,10)"><circle cx="30" cy="10" r="9" fill="#3fae4a"/><line x1="30" y1="20" x2="30" y2="55" stroke="#3fae4a" stroke-width="6"/><path d="M12 95 L25 60 L35 60 L48 95" fill="none" stroke="#3fae4a" stroke-width="6"/><rect x="14" y="60" width="32" height="16" fill="#9fb0d9"/><text x="30" y="112" text-anchor="middle" font-size="10" fill="#3fae4a">✓ ย่อเข่า</text></g></svg>';

  A.confined_meter = '<svg viewBox="0 0 200 110"><rect x="20" y="10" width="160" height="70" rx="8" fill="#1c2438"/>' +
    '<rect x="35" y="25" width="130" height="30" rx="4" fill="#0c1222"/><text x="100" y="47" text-anchor="middle" font-size="16" fill="#3fae4a" font-family="monospace">O₂ 20.9%</text>' +
    '<circle cx="45" cy="68" r="4" fill="#3fae4a"/><circle cx="60" cy="68" r="4" fill="#ffd34d"/><circle cx="75" cy="68" r="4" fill="#d64545"/>' +
    '<text x="100" y="100" text-anchor="middle" font-size="10" fill="#cdd6ee">เครื่องตรวจวัดก๊าซ · gas detector</text></svg>';

  A.arc_flash_label = '<svg viewBox="0 0 200 120"><rect x="10" y="10" width="180" height="100" fill="#ffd34d" stroke="#1c2438" stroke-width="4"/>' +
    '<text x="100" y="35" text-anchor="middle" font-size="13" font-weight="700" fill="#1c2438">⚠ ARC FLASH</text>' +
    '<text x="100" y="55" text-anchor="middle" font-size="10" fill="#1c2438">อันตราย · เสี่ยงไฟอาร์ก</text>' +
    '<text x="100" y="80" text-anchor="middle" font-size="9" fill="#1c2438">ต้องใช้ PPE ทนอาร์ก</text>' +
    '<text x="100" y="98" text-anchor="middle" font-size="9" fill="#1c2438">Arc-rated PPE required</text></svg>';

  A.pinch_point = '<svg viewBox="0 0 200 110"><circle cx="70" cy="55" r="34" fill="none" stroke="#9fb0d9" stroke-width="10"/><circle cx="130" cy="55" r="34" fill="none" stroke="#9fb0d9" stroke-width="10"/>' +
    '<circle cx="100" cy="55" r="12" fill="#d64545"/><text x="100" y="60" text-anchor="middle" font-size="14">⚠</text>' +
    '<text x="100" y="100" text-anchor="middle" font-size="10" fill="#cdd6ee">จุดหนีบ · pinch point</text></svg>';

  A.forklift_triangle = '<svg viewBox="0 0 200 120"><path d="M30 100 L100 20 L170 100 Z" fill="none" stroke="#ffd34d" stroke-width="4"/>' +
    '<circle cx="30" cy="100" r="6" fill="#9fb0d9"/><circle cx="170" cy="100" r="6" fill="#9fb0d9"/><circle cx="100" cy="20" r="6" fill="#9fb0d9"/>' +
    '<circle cx="100" cy="70" r="7" fill="#e8622b"/><text x="100" y="112" text-anchor="middle" font-size="10" fill="#cdd6ee">สามเหลี่ยมความมั่นคง · stability triangle</text></svg>';

  A.ptw_permit = '<svg viewBox="0 0 160 120"><rect x="20" y="10" width="120" height="100" rx="4" fill="#fff"/>' +
    '<rect x="32" y="22" width="96" height="8" fill="#1c2438"/><rect x="32" y="38" width="70" height="6" fill="#9fb0d9"/><rect x="32" y="50" width="80" height="6" fill="#9fb0d9"/><rect x="32" y="62" width="60" height="6" fill="#9fb0d9"/>' +
    '<circle cx="105" cy="90" r="16" fill="none" stroke="#d64545" stroke-width="3"/><text x="105" y="94" text-anchor="middle" font-size="9" fill="#d64545" font-weight="700">PTW</text></svg>';

  A.emergency_assembly = '<svg viewBox="0 0 160 120"><rect x="20" y="10" width="120" height="90" fill="#3fae4a"/>' +
    '<circle cx="80" cy="40" r="10" fill="#fff"/><path d="M60 80 q20 -25 40 0" fill="none" stroke="#fff" stroke-width="5"/>' +
    '<circle cx="45" cy="75" r="7" fill="#fff"/><circle cx="115" cy="75" r="7" fill="#fff"/>' +
    '<text x="80" y="112" text-anchor="middle" font-size="10" fill="#cdd6ee">จุดรวมพล · assembly point</text></svg>';

  A.firstaid_kit = '<svg viewBox="0 0 140 110"><rect x="15" y="25" width="110" height="70" rx="8" fill="#fff" stroke="#d64545" stroke-width="4"/>' +
    '<rect x="55" y="10" width="30" height="25" rx="4" fill="#fff" stroke="#d64545" stroke-width="4"/>' +
    '<rect x="55" y="48" width="30" height="10" fill="#d64545"/><rect x="65" y="38" width="10" height="30" fill="#d64545"/></svg>';

  A.nearmiss_iceberg = '<svg viewBox="0 0 160 130"><rect x="0" y="0" width="160" height="60" fill="#0c1222"/>' +
    '<path d="M60 60 L80 20 L100 60 Z" fill="#9fb0d9"/><rect x="0" y="60" width="160" height="60" fill="#162040"/>' +
    '<path d="M20 60 L80 20 L140 60 Z" fill="#45598f" opacity="0.6"/>' +
    '<text x="80" y="35" text-anchor="middle" font-size="9" fill="#1c2438">บาดเจ็บ · injury</text>' +
    '<text x="80" y="95" text-anchor="middle" font-size="9" fill="#cdd6ee">เกือบเกิดเหตุ (ฐานใหญ่) · near miss</text></svg>';

  A.env_waste_bins = '<svg viewBox="0 0 220 100">' +
    [["ทั่วไป", "#6b7a9e"], ["รีไซเคิล", "#2e7bd6"], ["อันตราย", "#d64545"], ["อินทรีย์", "#3fae4a"]].map(function (c, i) {
      var x = 10 + i * 52;
      return '<g transform="translate(' + x + ',10)"><rect x="0" y="15" width="42" height="55" rx="4" fill="' + c[1] + '"/><rect x="-3" y="8" width="48" height="10" rx="3" fill="' + c[1] + '"/>' +
        '<text x="21" y="90" text-anchor="middle" font-size="9" fill="#cdd6ee">' + c[0] + "</text></g>";
    }).join("") + "</svg>";

  A.law_signal_words = '<svg viewBox="0 0 220 100"><rect x="10" y="10" width="95" height="60" fill="#d64545"/><text x="57" y="46" text-anchor="middle" font-size="16" fill="#fff" font-weight="700">DANGER</text>' +
    '<rect x="115" y="10" width="95" height="60" fill="#ffd34d"/><text x="162" y="46" text-anchor="middle" font-size="16" fill="#1c2438" font-weight="700">WARNING</text>' +
    '<text x="57" y="88" text-anchor="middle" font-size="9" fill="#cdd6ee">รุนแรงกว่า · more severe</text></svg>';

  A.health_noise = '<svg viewBox="0 0 200 110"><path d="M20 55 h20 l25 -30 v60 l-25 -30 h-20 z" fill="#9fb0d9"/>' +
    '<path d="M75 35 a28 28 0 0 1 0 40" fill="none" stroke="#ffd34d" stroke-width="5"/><path d="M90 25 a44 44 0 0 1 0 60" fill="none" stroke="#e8622b" stroke-width="5"/>' +
    '<text x="130" y="60" font-size="22" fill="#d64545">!</text><text x="100" y="100" text-anchor="middle" font-size="10" fill="#cdd6ee">เสียงดัง &gt; 85 dB(A)</text></svg>';

  A["5s_before_after"] = '<svg viewBox="0 0 220 100">' +
    '<g><rect x="5" y="10" width="95" height="70" fill="#1c2438"/>' +
    '<rect x="15" y="20" width="18" height="10" fill="#d64545" transform="rotate(12 24 25)"/><rect x="45" y="18" width="22" height="8" fill="#ffd34d" transform="rotate(-8 56 22)"/><rect x="30" y="45" width="14" height="22" fill="#9fb0d9" transform="rotate(20 37 56)"/><rect x="60" y="50" width="20" height="10" fill="#3fae4a" transform="rotate(-15 70 55)"/>' +
    '<text x="52" y="95" text-anchor="middle" font-size="9" fill="#d64545">ก่อน · before</text></g>' +
    '<g transform="translate(115,0)"><rect x="5" y="10" width="95" height="70" fill="#1c2438"/>' +
    '<rect x="14" y="18" width="18" height="10" fill="#d64545"/><rect x="14" y="32" width="18" height="10" fill="#ffd34d"/><rect x="14" y="46" width="18" height="10" fill="#3fae4a"/>' +
    '<rect x="55" y="18" width="30" height="38" fill="none" stroke="#9fb0d9" stroke-width="2"/>' +
    '<text x="52" y="95" text-anchor="middle" font-size="9" fill="#3fae4a">หลัง · after</text></g></svg>';

  A.lifting_sling_angle = '<svg viewBox="0 0 200 120"><rect x="80" y="10" width="40" height="12" fill="#9fb0d9"/>' +
    '<line x1="85" y1="22" x2="30" y2="90" stroke="#ffd34d" stroke-width="4"/><line x1="115" y1="22" x2="170" y2="90" stroke="#ffd34d" stroke-width="4"/>' +
    '<rect x="25" y="90" width="150" height="20" fill="#2b3550"/>' +
    '<path d="M70 40 A30 30 0 0 0 85 22" fill="none" stroke="#e8622b" stroke-width="2"/><text x="78" y="36" font-size="10" fill="#e8622b">θ</text>' +
    '<text x="100" y="118" text-anchor="middle" font-size="10" fill="#cdd6ee">มุมสลิง · sling angle</text></svg>';

  window.QUIZ_ART = A;
})();
