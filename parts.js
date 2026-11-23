window.PARTS_CATALOG = (() => {
  const GRID = 20; // 2.54mm ピッチ = 20px

  // ローカル座標 → 回転＋左右反転（SVGの rotate(rot) scale(flipX?-1:1, 1) と完全一致）
  function transformGrid(lx, ly, rot, flipX = false) {
    const fx = flipX ? -lx : lx;
    const r = ((rot % 360) + 360) % 360;
    if (r === 90) return { gx: -ly, gy: fx };
    if (r === 180) return { gx: -fx, gy: -ly };
    if (r === 270) return { gx: ly, gy: -fx };
    return { gx: fx, gy: ly };
  }

  // 反転時に文字が鏡文字にならないよう打ち消すtransform属性
  function unflipAttr(cx, cy, flipX) {
    return flipX ? `transform="translate(${cx}, ${cy}) scale(-1, 1) translate(${-cx}, ${-cy})"` : "";
  }

  // Raspberry Pi Pico / Pico 2 W（全40ピン）
  const PICO_BOTTOM = [
    [1, "GP0", "gpio"], [2, "GP1", "gpio"], [3, "GND", "gnd"], [4, "GP2", "gpio"],
    [5, "GP3", "gpio"], [6, "GP4", "gpio"], [7, "GP5", "gpio"], [8, "GND", "gnd"],
    [9, "GP6", "gpio"], [10, "GP7", "gpio"], [11, "GP8", "gpio"], [12, "GP9", "gpio"],
    [13, "GND", "gnd"], [14, "GP10", "gpio"], [15, "GP11", "gpio"], [16, "GP12", "gpio"],
    [17, "GP13", "gpio"], [18, "GND", "gnd"], [19, "GP14", "gpio"], [20, "GP15", "gpio"]
  ];

  const PICO_TOP = [
    [40, "VBUS", "pwr"], [39, "VSYS", "pwr"], [38, "GND", "gnd"], [37, "3V3_EN", "sys"],
    [36, "3V3(OUT)", "pwr"], [35, "ADC_VREF", "sys"], [34, "GP28", "gpio"], [33, "GND", "gnd"],
    [32, "GP27", "gpio"], [31, "GP26", "gpio"], [30, "RUN", "sys"], [29, "GP22", "gpio"],
    [28, "GND", "gnd"], [27, "GP21", "gpio"], [26, "GP20", "gpio"], [25, "GP19", "gpio"],
    [24, "GP18", "gpio"], [23, "GND", "gnd"], [22, "GP17", "gpio"], [21, "GP16", "gpio"]
  ];

  const PICO_PINS = [
    ...PICO_TOP.map(([num, label, kind], idx) => ({ num, label, kind, gx: idx, gy: 0, side: "top" })),
    ...PICO_BOTTOM.map(([num, label, kind], idx) => ({ num, label, kind, gx: idx, gy: 7, side: "bottom" }))
  ];

  const PIN_KIND_COLORS = {
    gpio: "#16a34a",
    gnd: "#1e293b",
    pwr: "#dc2626",
    sys: "#64748b"
  };

  // LEDカラー定義
  const LED_COLORS = {
    red:    { name: "赤", body: "#ef4444", glow: "#fca5a5", dark: "#991b1b" },
    yellow: { name: "黄", body: "#facc15", glow: "#fef08a", dark: "#a16207" },
    green:  { name: "緑", body: "#22c55e", glow: "#86efac", dark: "#166534" },
    blue:   { name: "青", body: "#3b82f6", glow: "#93c5fd", dark: "#1e40af" },
    white:  { name: "白", body: "#f8fafc", glow: "#e2e8f0", dark: "#64748b" }
  };

  // タクトスイッチ ボタン色
  const BUTTON_COLORS = {
    black:  { name: "黒", fill: "#1e293b", stroke: "#0f172a" },
    red:    { name: "赤", fill: "#dc2626", stroke: "#991b1b" },
    blue:   { name: "青", fill: "#2563eb", stroke: "#1e40af" },
    yellow: { name: "黄", fill: "#eab308", stroke: "#a16207" },
    green:  { name: "緑", fill: "#16a34a", stroke: "#166534" }
  };

  // 抵抗カラーコード（数字0〜9・乗数）
  const BAND_DIGIT_COLORS = [
    "#111827", // 0 黒
    "#92400e", // 1 茶
    "#dc2626", // 2 赤
    "#f97316", // 3 橙
    "#eab308", // 4 黄
    "#16a34a", // 5 緑
    "#2563eb", // 6 青
    "#9333ea", // 7 紫
    "#64748b", // 8 灰
    "#f8fafc"  // 9 白
  ];

  // 任意の抵抗値文字列（例: "220", "4.7k", "10kΩ", "1M"）からラベルと4本帯カラーコードを計算
  function parseResistance(raw) {
    const str = String(raw || "220")
      .replace(/[０-９．ａ-ｚＡ-Ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/Ω|ohm|オーム|\s+/gi, "")
      .trim();

    const match = str.match(/^(\d+(?:\.\d+)?)([kKmMgG]?)$/);
    if (!match) {
      return {
        label: raw ? String(raw) : "220Ω",
        bands: ["#dc2626", "#dc2626", "#92400e", "#eab308"],
        valid: false
      };
    }

    let num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === "k") num *= 1e3;
    else if (unit === "m") num *= 1e6;
    else if (unit === "g") num *= 1e9;

    // きれいな表示ラベルを生成
    let label = "";
    if (num >= 1e6) label = `${+(num / 1e6).toFixed(2)}MΩ`;
    else if (num >= 1e3) label = `${+(num / 1e3).toFixed(2)}kΩ`;
    else label = `${+num.toFixed(2)}Ω`;

    // 4本帯（第1数字・第2数字・乗数・金±5%）
    if (num <= 0) {
      return { label: "0Ω", bands: ["#111827", "#111827", "#111827", "#eab308"], valid: true };
    }

    const exp = Math.floor(Math.log10(num));
    const sig = Math.round(num / Math.pow(10, exp - 1)); // 2桁の有効数字 (10..99)
    let d1 = Math.floor(sig / 10);
    let d2 = sig % 10;
    let multExp = exp - 1;
    if (d1 >= 10) {
      d1 = 1;
      d2 = 0;
      multExp += 1;
    }

    let multColor = "#111827";
    if (multExp >= 0 && multExp <= 9) multColor = BAND_DIGIT_COLORS[multExp];
    else if (multExp === -1) multColor = "#eab308"; // 金 ×0.1
    else if (multExp === -2) multColor = "#cbd5e1"; // 銀 ×0.01

    return {
      label,
      bands: [
        BAND_DIGIT_COLORS[Math.max(0, Math.min(9, d1))],
        BAND_DIGIT_COLORS[Math.max(0, Math.min(9, d2))],
        multColor,
        "#eab308" // 金（±5%）
      ],
      valid: true
    };
  }

  // ジャンパ線の色リスト
  const WIRE_COLORS = [
    { id: "#ef4444", name: "赤" },
    { id: "#1e293b", name: "黒（GND共通）" },
    { id: "#2563eb", name: "青" },
    { id: "#16a34a", name: "緑" },
    { id: "#f97316", name: "橙" },
    { id: "#eab308", name: "黄" },
    { id: "#9333ea", name: "紫" },
    { id: "#f8fafc", name: "白" }
  ];

  // 8x8 マトリクス点灯パターン
  const MATRIX_PATTERNS = {
    off:   { name: "消灯", dots: [] },
    two:   { name: "2個点灯テスト", dots: [[1, 1], [6, 6]] },
    heart: {
      name: "ハート",
      dots: [
        [1,1],[2,1],[5,1],[6,1],
        [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],
        [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],
        [1,4],[2,4],[3,4],[4,4],[5,4],[6,4],
        [2,5],[3,5],[4,5],[5,5],
        [3,6],[4,6]
      ]
    },
    smile: {
      name: "スマイル",
      dots: [
        [2,1],[3,1],[4,1],[5,1],
        [1,2],[6,2],
        [0,3],[2,3],[5,3],[7,3],
        [0,4],[7,4],
        [0,5],[2,5],[5,5],[7,5],
        [1,6],[3,6],[4,6],[6,6],
        [2,7],[3,7],[4,7],[5,7]
      ]
    }
  };

  // 7セグメント点灯マップ (a,b,c,d,e,f,g)
  const SEVEN_SEG_DIGITS = {
    off: [],
    "0": ["a","b","c","d","e","f"],
    "1": ["b","c"],
    "2": ["a","b","g","e","d"],
    "3": ["a","b","g","c","d"],
    "4": ["f","g","b","c"],
    "5": ["a","f","g","c","d"],
    "6": ["a","f","e","d","c","g"],
    "7": ["a","b","c"],
    "8": ["a","b","c","d","e","f","g"],
    "9": ["a","b","c","d","f","g"]
  };

  // ブレッドボード（30列・電源レール付き）の導通グループ定義
  function getBreadboardGroups(part) {
    const groups = [];
    const railXs = [];
    for (let block = 0; block < 5; block++) {
      const start = 1 + block * 6;
      for (let i = 0; i < 5; i++) railXs.push(start + i);
    }

    const railConfigs = [
      { id: "top-minus", gy: -3, kind: "minus" },
      { id: "top-plus",  gy: -2, kind: "plus"  },
      { id: "bot-plus",  gy: 13, kind: "plus"  },
      { id: "bot-minus", gy: 14, kind: "minus" }
    ];

    for (const rc of railConfigs) {
      const cells = railXs.map(lx => {
        const r = transformGrid(lx, rc.gy, part.rot, false);
        return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx, ly: rc.gy };
      });
      groups.push({ id: `${part.id}:${rc.id}`, kind: rc.kind, isRail: true, cells, lx1: 1, ly1: rc.gy, lx2: 29, ly2: rc.gy });
    }

    for (let col = 0; col < 30; col++) {
      const topCells = [0, 1, 2, 3, 4].map(ly => {
        const r = transformGrid(col, ly, part.rot, false);
        return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx: col, ly };
      });
      groups.push({ id: `${part.id}:c${col}:top`, kind: "strip", isRail: false, cells: topCells, lx1: col, ly1: 0, lx2: col, ly2: 4 });

      const botCells = [7, 8, 9, 10, 11].map(ly => {
        const r = transformGrid(col, ly, part.rot, false);
        return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx: col, ly };
      });
      groups.push({ id: `${part.id}:c${col}:bot`, kind: "strip", isRail: false, cells: botCells, lx1: col, ly1: 7, lx2: col, ly2: 11 });
    }
    return groups;
  }

  // 全部品のピン座標（ワールドグリッド座標）
  function getPartPinsWorld(part) {
    const flip = !!part.flipX && part.type !== "pico" && part.type !== "breadboard";
    let locals = [];

    if (part.type === "pico") {
      locals = PICO_PINS;
    } else if (part.type === "led") {
      const span = part.props?.span || 1;
      locals = [
        { name: "+ (アノード)", gx: 0, gy: 0 },
        { name: "- (カソード)", gx: span, gy: 0 }
      ];
    } else if (part.type === "resistor") {
      const span = part.props?.span || 4;
      locals = [
        { name: "端子1", gx: 0, gy: 0 },
        { name: "端子2", gx: span, gy: 0 }
      ];
    } else if (part.type === "tact_switch") {
      locals = [
        { name: "A1", gx: 0, gy: 0 },
        { name: "A2", gx: 2, gy: 0 },
        { name: "B1", gx: 0, gy: 3 },
        { name: "B2", gx: 2, gy: 3 }
      ];
    } else if (part.type === "toggle_switch") {
      locals = [
        { name: "端子1", gx: 0, gy: 0 },
        { name: "COM",  gx: 1, gy: 0 },
        { name: "端子2", gx: 2, gy: 0 }
      ];
    } else if (part.type === "potentiometer") {
      const step = part.props?.step || 1;
      locals = [
        { name: "端子1", gx: 0, gy: 0 },
        { name: "中(ADC)", gx: step, gy: 0 },
        { name: "端子3", gx: step * 2, gy: 0 }
      ];
    } else if (part.type === "buzzer") {
      const span = part.props?.span || 3;
      locals = [
        { name: "+", gx: 0, gy: 0 },
        { name: "-", gx: span, gy: 0 }
      ];
    } else if (part.type === "matrix_1088bs") {
      for (let i = 0; i < 8; i++) {
        locals.push({ name: `Pin ${i + 1}`, gx: i, gy: 0 });
      }
    } else if (part.type === "matrix_max7219") {
      locals = [
        { name: "VCC", kind: "pwr", gx: 1, gy: 0 },
        { name: "GND", kind: "gnd", gx: 2, gy: 0 },
        { name: "DIN", kind: "gpio", gx: 3, gy: 0 },
        { name: "CS",  kind: "gpio", gx: 4, gy: 0 },
        { name: "CLK", kind: "gpio", gx: 5, gy: 0 }
      ];
    } else if (part.type === "seven_seg") {
      locals = [
        { name: "VDD",   kind: "pwr", gx: 0, gy: 0 },
        { name: "GND",   kind: "gnd", gx: 1, gy: 0 },
        { name: "SDI",   kind: "gpio", gx: 2, gy: 0 },
        { name: "SCK",   kind: "gpio", gx: 3, gy: 0 },
        { name: "LATCH", kind: "gpio", gx: 4, gy: 0 }
      ];
    }

    return locals.map(p => {
      const r = transformGrid(p.gx, p.gy, part.rot, flip);
      return { ...p, worldGx: part.gx + r.gx, worldGy: part.gy + r.gy };
    });
  }

  // ==================== 各部品のSVG描画 ====================

  function renderBreadboard(part, isSelected) {
    const G = GRID;
    const x0 = -1.2 * G;
    const y0 = -4.0 * G;
    const width = 31.4 * G;
    const height = 19.0 * G;

    const railXs = [];
    for (let block = 0; block < 5; block++) {
      const start = 1 + block * 6;
      for (let i = 0; i < 5; i++) railXs.push(start + i);
    }

    let holes = "";
    for (const ry of [-3, -2, 13, 14]) {
      for (const rx of railXs) {
        holes += `<rect x="${rx * G - 3.5}" y="${ry * G - 3.5}" width="7" height="7" rx="1.2" fill="#334155" />`;
      }
    }
    for (let col = 0; col < 30; col++) {
      for (const ly of [0, 1, 2, 3, 4, 7, 8, 9, 10, 11]) {
        holes += `<rect x="${col * G - 3.5}" y="${ly * G - 3.5}" width="7" height="7" rx="1.2" fill="#334155" />`;
      }
    }

    let colNums = "";
    for (let col = 0; col < 30; col++) {
      const num = col + 1;
      const bold = (num === 1 || num % 5 === 0) ? "700" : "400";
      const fill = (num === 1 || num % 5 === 0) ? "#334155" : "#94a3b8";
      colNums += `<text x="${col * G}" y="${-0.85 * G}" text-anchor="middle" font-size="9" font-weight="${bold}" fill="${fill}">${num}</text>`;
      colNums += `<text x="${col * G}" y="${12.25 * G}" text-anchor="middle" font-size="9" font-weight="${bold}" fill="${fill}">${num}</text>`;
    }

    const rowLabels = [
      ["a", 0], ["b", 1], ["c", 2], ["d", 3], ["e", 4],
      ["f", 7], ["g", 8], ["h", 9], ["i", 10], ["j", 11]
    ];
    let rowTexts = "";
    for (const [ch, ly] of rowLabels) {
      rowTexts += `<text x="${-0.75 * G}" y="${ly * G + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#475569">${ch}</text>`;
      rowTexts += `<text x="${29.75 * G}" y="${ly * G + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#475569">${ch}</text>`;
    }

    const stroke = isSelected ? "#2563eb" : "#cbd5e1";
    const strokeW = isSelected ? 2.5 : 1.5;

    return `
      <rect x="${x0}" y="${y0}" width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeW}" />
      <rect x="${x0 + 4}" y="${5.1 * G}" width="${width - 8}" height="${0.8 * G}" rx="3" fill="#e2e8f0" />
      <line x1="${0.3 * G}" y1="${-3.55 * G}" x2="${29.7 * G}" y2="${-3.55 * G}" stroke="#2563eb" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${-1.45 * G}" x2="${29.7 * G}" y2="${-1.45 * G}" stroke="#ef4444" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${12.45 * G}" x2="${29.7 * G}" y2="${12.45 * G}" stroke="#ef4444" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${14.55 * G}" x2="${29.7 * G}" y2="${14.55 * G}" stroke="#2563eb" stroke-width="2" />
      <text x="${-0.45 * G}" y="${-3 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#2563eb">−</text>
      <text x="${-0.45 * G}" y="${-2 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#ef4444">＋</text>
      <text x="${-0.45 * G}" y="${13 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#ef4444">＋</text>
      <text x="${-0.45 * G}" y="${14 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#2563eb">−</text>
      ${colNums}
      ${rowTexts}
      ${holes}
    `;
  }

  function renderPico(part, isSelected) {
    const G = GRID;
    const x0 = -0.6 * G;
    const y0 = -0.6 * G;
    const w = 20.2 * G;
    const h = 8.2 * G;
    const modelName = part.props?.model || "Raspberry Pi Pico";
    const chipName = modelName.includes("2") ? "RP2350" : "RP2040";
    const stroke = isSelected ? "#facc15" : "#065f46";
    const strokeW = isSelected ? 3 : 1.5;

    let pinsSvg = "";
    for (const p of PICO_PINS) {
      const cx = p.gx * G;
      const cy = p.gy * G;
      pinsSvg += `
        <circle cx="${cx}" cy="${cy}" r="6.5" fill="#eab308" stroke="#ca8a04" stroke-width="1" />
        <rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" rx="1" fill="#334155" />
        <circle cx="${cx}" cy="${cy}" r="1.5" fill="#e2e8f0" />
      `;
    }

    return `
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5" fill="#0f766e" stroke="${stroke}" stroke-width="${strokeW}" />
      <rect x="${x0 - 8}" y="${2.4 * G}" width="26" height="${2.2 * G}" rx="3" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5" />
      <text x="${x0 + 5}" y="${3.65 * G}" text-anchor="middle" font-size="8" font-weight="700" fill="#334155">USB</text>
      <rect x="${2.8 * G}" y="${2.5 * G}" width="26" height="18" rx="3" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2" />
      <text x="${2.8 * G + 13}" y="${2.5 * G + 28}" text-anchor="middle" font-size="7.5" fill="#ccfbf1">BOOTSEL</text>
      <rect x="${2.0 * G}" y="${1.1 * G}" width="10" height="7" rx="1.5" fill="#86efac" stroke="#15803d" stroke-width="0.8" />
      <rect x="${8.2 * G}" y="${2.2 * G}" width="${2.6 * G}" height="${2.6 * G}" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.2" />
      <text x="${9.5 * G}" y="${3.65 * G}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#e2e8f0">${chipName}</text>
      <text x="${14.8 * G}" y="${3.4 * G}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">${modelName}</text>
      <text x="${14.8 * G}" y="${4.3 * G}" text-anchor="middle" font-size="8.5" fill="#99f6e4">Pin 1 (左下) 〜 Pin 40 (左上)</text>
      <polygon points="${0},${6.1 * G} ${-4},${6.5 * G} ${4},${6.5 * G}" fill="#fde047" />
      ${pinsSvg}
    `;
  }

  function renderPicoLabels(part, mode, usedPinKeys) {
    if (mode === "none") return "";
    const G = GRID;
    const worldPins = getPartPinsWorld(part);
    let html = "";

    for (const p of worldPins) {
      const key = `${p.worldGx},${p.worldGy}`;
      const isUsed = usedPinKeys.has(key);
      if (mode === "used" && !isUsed) continue;

      const color = PIN_KIND_COLORS[p.kind] || "#334155";
      const localDir = p.side === "top" ? { gx: 0, gy: -1 } : { gx: 0, gy: 1 };
      const dir = transformGrid(localDir.gx, localDir.gy, part.rot, false);
      const px = p.worldGx * G;
      const py = p.worldGy * G;

      if (mode === "used") {
        const dist = 30;
        const lx = px + dir.gx * dist;
        const ly = py + dir.gy * dist;
        const text = `${p.num} ${p.label}`;
        const boxW = Math.max(54, text.length * 7.5 + 14);
        const boxH = 22;
        const bx = dir.gx > 0 ? lx : (dir.gx < 0 ? lx - boxW : lx - boxW / 2);
        const by = dir.gy > 0 ? ly : (dir.gy < 0 ? ly - boxH : ly - boxH / 2);

        html += `
          <g class="pico-pin-badge">
            <circle cx="${px}" cy="${py}" r="8" fill="none" stroke="${color}" stroke-width="2.5" />
            <line x1="${px + dir.gx * 8}" y1="${py + dir.gy * 8}" x2="${lx}" y2="${ly}" stroke="${color}" stroke-width="2" />
            <rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="11" fill="${color}" stroke="#ffffff" stroke-width="2" />
            <text x="${bx + boxW / 2}" y="${by + 15}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">${text}</text>
          </g>
        `;
      } else {
        const isVerticalPinRow = dir.gy !== 0;
        const text = `${p.num}:${p.label}`;
        const badgeLen = 58;
        const badgeThick = 15;
        const offset = 13;

        if (isVerticalPinRow) {
          const cy = dir.gy < 0 ? py - offset - badgeLen / 2 : py + offset + badgeLen / 2;
          html += `
            <g transform="translate(${px}, ${cy}) rotate(-90)">
              <rect x="${-badgeLen / 2}" y="${-badgeThick / 2}" width="${badgeLen}" height="${badgeThick}" rx="3" fill="${color}" stroke="${isUsed ? '#facc15' : '#ffffff'}" stroke-width="${isUsed ? 2 : 1}" />
              <text x="0" y="3.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">${text}</text>
            </g>
          `;
        } else {
          const cx = dir.gx < 0 ? px - offset - badgeLen / 2 : px + offset + badgeLen / 2;
          html += `
            <g transform="translate(${cx}, ${py})">
              <rect x="${-badgeLen / 2}" y="${-badgeThick / 2}" width="${badgeLen}" height="${badgeThick}" rx="3" fill="${color}" stroke="${isUsed ? '#facc15' : '#ffffff'}" stroke-width="${isUsed ? 2 : 1}" />
              <text x="0" y="3.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">${text}</text>
            </g>
          `;
        }
      }
    }
    return html;
  }

  // LED（脚幅 1〜5マス対応・長短脚＆極性強調・反転対応）
  function renderLed(part, isSelected) {
    const G = GRID;
    const span = part.props?.span || 1;
    const totalW = span * G;
    const midX = totalW / 2;
    const flip = !!part.flipX;
    const c = LED_COLORS[part.props?.color || "red"] || LED_COLORS.red;
    const showPolarity = part.props?.showPolarity !== false;

    const selRing = isSelected
      ? `<rect x="-16" y="-50" width="${totalW + 32}" height="60" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    // クリックしやすくする透明ヒット領域
    const hitArea = `<rect x="-12" y="-48" width="${totalW + 24}" height="54" fill="transparent" />`;

    return `
      ${hitArea}
      ${selRing}
      <!-- 長い脚（アノード＋：x=0、屈曲を入れて長さを強調） -->
      <path d="M 0,0 L 0,-11 L ${midX - 5},-18 L ${midX - 5},-25" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <!-- 短い脚（カソード−：x=totalW） -->
      <path d="M ${totalW},0 L ${totalW},-16 L ${midX + 5},-18 L ${midX + 5},-25" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <!-- LEDドーム本体（中央配置・右端フラットカット） -->
      <path d="M ${midX - 11},-24 L ${midX - 11},-35 A 11.5,11.5 0 0 1 ${midX + 10.5},-35 L ${midX + 10.5},-24 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="1.6" />
      <rect x="${midX - 13}" y="-26" width="25" height="4.5" rx="1.5" fill="${c.body}" stroke="${c.dark}" stroke-width="1.2" />
      <ellipse cx="${midX - 4}" cy="-35" rx="3" ry="5" fill="${c.glow}" opacity="0.85" />
      <!-- 端子接続点 -->
      <circle cx="0" cy="0" r="3.8" fill="#dc2626" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.8" fill="#1e293b" stroke="#ffffff" stroke-width="1" />
      ${showPolarity ? `
        <g ${unflipAttr(-11, -12, flip)}>
          <circle cx="-11" cy="-12" r="7.5" fill="#dc2626" />
          <text x="-11" y="-8.5" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">+</text>
          <text x="-11" y="-23" text-anchor="middle" font-size="8.5" font-weight="700" fill="#b91c1c">長</text>
        </g>
        <g ${unflipAttr(totalW + 11, -12, flip)}>
          <circle cx="${totalW + 11}" cy="-12" r="7.5" fill="#1e293b" />
          <text x="${totalW + 11}" y="-8.5" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">−</text>
          <text x="${totalW + 11}" y="-23" text-anchor="middle" font-size="8.5" font-weight="700" fill="#334155">短</text>
        </g>
      ` : ""}
    `;
  }

  // 抵抗（任意値パース＆カラーコード自動計算）
  function renderResistor(part, isSelected) {
    const G = GRID;
    const span = part.props?.span || 4;
    const totalW = span * G;
    const flip = !!part.flipX;
    const info = parseResistance(part.props?.value ?? "220");
    const showLabel = part.props?.showLabel !== false;

    const bodyW = Math.min(44, totalW - 14);
    const bodyX = (totalW - bodyW) / 2;
    const bodyH = 14;
    const bodyY = -bodyH / 2;

    const b0 = bodyX + bodyW * 0.16;
    const b1 = bodyX + bodyW * 0.34;
    const b2 = bodyX + bodyW * 0.52;
    const b3 = bodyX + bodyW * 0.78;
    const labelW = Math.max(42, info.label.length * 7.5 + 12);

    const selRing = isSelected
      ? `<rect x="-8" y="-26" width="${totalW + 16}" height="40" rx="6" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      <rect x="-6" y="-24" width="${totalW + 12}" height="36" fill="transparent" />
      ${selRing}
      <line x1="0" y1="0" x2="${totalW}" y2="0" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />
      <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="5" fill="#f3d5a5" stroke="#a16207" stroke-width="1.4" />
      <rect x="${b0}" y="${bodyY + 0.7}" width="4" height="${bodyH - 1.4}" fill="${info.bands[0]}" />
      <rect x="${b1}" y="${bodyY + 0.7}" width="4" height="${bodyH - 1.4}" fill="${info.bands[1]}" />
      <rect x="${b2}" y="${bodyY + 0.7}" width="4" height="${bodyH - 1.4}" fill="${info.bands[2]}" />
      <rect x="${b3}" y="${bodyY + 0.7}" width="3.5" height="${bodyH - 1.4}" fill="${info.bands[3]}" />
      <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      ${showLabel ? `
        <g ${unflipAttr(totalW / 2, -18, flip)}>
          <rect x="${totalW / 2 - labelW / 2}" y="-26" width="${labelW}" height="15" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
          <text x="${totalW / 2}" y="-15" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b">${info.label}</text>
        </g>
      ` : ""}
    `;
  }

  // タクトスイッチ（4本脚・ブレッドボード中央の溝またぎ 2×3マス）
  function renderTactSwitch(part, isSelected) {
    const G = GRID;
    const w = 2 * G;
    const h = 3 * G;
    const bc = BUTTON_COLORS[part.props?.btnColor || "black"] || BUTTON_COLORS.black;
    const selRing = isSelected
      ? `<rect x="-10" y="-10" width="${w + 20}" height="${h + 20}" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- 4本脚リード -->
      <line x1="0" y1="0" x2="0" y2="${h}" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />
      <line x1="${w}" y1="0" x2="${w}" y2="${h}" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />
      <!-- 外枠（銀色金属プレート） -->
      <rect x="-4" y="6" width="${w + 8}" height="${h - 12}" rx="5" fill="#e2e8f0" stroke="#64748b" stroke-width="1.6" />
      <!-- 内側プラスチック -->
      <rect x="0" y="10" width="${w}" height="${h - 20}" rx="3" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" />
      <!-- 四隅のリベット -->
      <circle cx="3" cy="13" r="2.2" fill="#475569" />
      <circle cx="${w - 3}" cy="13" r="2.2" fill="#475569" />
      <circle cx="3" cy="${h - 13}" r="2.2" fill="#475569" />
      <circle cx="${w - 3}" cy="${h - 13}" r="2.2" fill="#475569" />
      <!-- 内部導通ガイド（上2本・下2本がそれぞれ内部で常時接続） -->
      <line x1="2" y1="0" x2="${w - 2}" y2="0" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 2" />
      <line x1="2" y1="${h}" x2="${w - 2}" y2="${h}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 2" />
      <!-- 中央プッシュボタン -->
      <circle cx="${w / 2}" cy="${h / 2}" r="12" fill="${bc.fill}" stroke="${bc.stroke}" stroke-width="1.8" />
      <circle cx="${w / 2 - 3}" cy="${h / 2 - 3}" r="3" fill="#ffffff" opacity="0.28" />
      <!-- 端子点 -->
      <circle cx="0" cy="0" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${w}" cy="0" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="0" cy="${h}" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${w}" cy="${h}" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
    `;
  }

  // トグルスイッチ（3端子・COM明記・レバー左右切替）
  function renderToggleSwitch(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const leverLeft = (part.props?.lever || "left") === "left";
    const selRing = isSelected
      ? `<rect x="-12" y="-44" width="${2 * G + 24}" height="62" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    const leverEndX = leverLeft ? G - 12 : G + 12;

    return `
      <rect x="-10" y="-42" width="${2 * G + 20}" height="56" fill="transparent" />
      ${selRing}
      <!-- 3本端子脚 -->
      <line x1="0" y1="0" x2="0" y2="-10" stroke="#94a3b8" stroke-width="3" />
      <line x1="${G}" y1="0" x2="${G}" y2="-10" stroke="#eab308" stroke-width="3.5" />
      <line x1="${2 * G}" y1="0" x2="${2 * G}" y2="-10" stroke="#94a3b8" stroke-width="3" />
      <!-- ボディ -->
      <rect x="-6" y="-26" width="${2 * G + 12}" height="18" rx="3" fill="#334155" stroke="#0f172a" stroke-width="1.5" />
      <!-- スライド／トグルレバー -->
      <line x1="${G}" y1="-26" x2="${leverEndX}" y2="-39" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round" />
      <circle cx="${leverEndX}" cy="-39" r="4" fill="#94a3b8" stroke="#475569" stroke-width="1" />
      <!-- 接続方向インジケーター -->
      <text x="${G}" y="-14" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fde047" ${unflipAttr(G, -17, flip)}>COM</text>
      <!-- 端子点 -->
      <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${G}" cy="0" r="4" fill="#eab308" stroke="#ffffff" stroke-width="1" />
      <circle cx="${2 * G}" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <!-- 端子ラベル -->
      <g ${unflipAttr(G, 12, flip)}>
        <rect x="${G - 14}" y="5" width="28" height="12" rx="3" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.9" />
        <text x="${G}" y="14" text-anchor="middle" font-size="8.5" font-weight="800" fill="#854d0e">COM</text>
      </g>
    `;
  }

  // 可変抵抗（B5K・3端子）
  function renderPotentiometer(part, isSelected) {
    const G = GRID;
    const step = part.props?.step || 1;
    const totalW = step * 2 * G;
    const midX = totalW / 2;
    const flip = !!part.flipX;
    const label = part.props?.label || "B5K";
    const knobPos = Number(part.props?.knobPos ?? 50); // 0..100
    const angle = -135 + (knobPos / 100) * 270;

    const selRing = isSelected
      ? `<rect x="${midX - 28}" y="-56" width="56" height="72" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      <rect x="${midX - 26}" y="-54" width="52" height="66" fill="transparent" />
      ${selRing}
      <!-- 3本端子脚 -->
      <line x1="0" y1="0" x2="0" y2="-12" stroke="#94a3b8" stroke-width="3" />
      <line x1="${midX}" y1="0" x2="${midX}" y2="-12" stroke="#2563eb" stroke-width="3.2" />
      <line x1="${totalW}" y1="0" x2="${totalW}" y2="-12" stroke="#94a3b8" stroke-width="3" />
      <!-- 本体（青ケース） -->
      <rect x="${midX - 22}" y="-50" width="44" height="40" rx="6" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.6" />
      <!-- つまみ -->
      <circle cx="${midX}" cy="-32" r="14" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <g transform="translate(${midX}, -32) rotate(${angle})">
        <line x1="0" y1="0" x2="0" y2="-11" stroke="#dc2626" stroke-width="3" stroke-linecap="round" />
      </g>
      <circle cx="${midX}" cy="-32" r="3" fill="#475569" />
      <!-- B5K 表記 -->
      <text x="${midX}" y="-12" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffffff" ${unflipAttr(midX, -15, flip)}>${label}</text>
      <!-- 端子点 -->
      <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${midX}" cy="0" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <g ${unflipAttr(midX, 12, flip)}>
        <rect x="${midX - 15}" y="5" width="30" height="12" rx="3" fill="#dbeafe" stroke="#2563eb" stroke-width="0.9" />
        <text x="${midX}" y="14" text-anchor="middle" font-size="8" font-weight="800" fill="#1d4ed8">ADC</text>
      </g>
    `;
  }

  // ブザー（＋／−極性マーク付き・パッシブ／アクティブ切替・脚幅調整）
  function renderBuzzer(part, isSelected) {
    const G = GRID;
    const span = part.props?.span || 3;
    const totalW = span * G;
    const midX = totalW / 2;
    const flip = !!part.flipX;
    const showPolarity = part.props?.showPolarity !== false;
    const typeLabel = part.props?.buzzerType === "active" ? "アクティブ" : "パッシブ";

    const selRing = isSelected
      ? `<rect x="${Math.min(-14, midX - 28)}" y="-56" width="${Math.max(totalW + 28, 56)}" height="68" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      <rect x="${Math.min(-10, midX - 26)}" y="-54" width="${Math.max(totalW + 20, 52)}" height="62" fill="transparent" />
      ${selRing}
      <!-- リード線 -->
      <path d="M 0,0 L 0,-12 L ${midX - 10},-22" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
      <path d="M ${totalW},0 L ${totalW},-12 L ${midX + 10},-22" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <!-- 円筒ブザー本体 -->
      <circle cx="${midX}" cy="-28" r="23" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
      <circle cx="${midX}" cy="-28" r="19" fill="none" stroke="#475569" stroke-width="1" />
      <!-- 中央の放音穴 -->
      <circle cx="${midX}" cy="-28" r="5.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2" />
      <!-- 種類表記 -->
      <text x="${midX}" y="-12" text-anchor="middle" font-size="7.5" font-weight="700" fill="#cbd5e1" ${unflipAttr(midX, -15, flip)}>${typeLabel}</text>
      <!-- 端子点 -->
      <circle cx="0" cy="0" r="3.8" fill="#dc2626" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.8" fill="#1e293b" stroke="#ffffff" stroke-width="1" />
      ${showPolarity ? `
        <g ${unflipAttr(-11, -10, flip)}>
          <circle cx="-11" cy="-10" r="7.5" fill="#dc2626" />
          <text x="-11" y="-6.5" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">+</text>
        </g>
        <g ${unflipAttr(totalW + 11, -10, flip)}>
          <circle cx="${totalW + 11}" cy="-10" r="7.5" fill="#1e293b" />
          <text x="${totalW + 11}" y="-6.5" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">−</text>
        </g>
      ` : ""}
    `;
  }

  // 8x8 マトリクスLED（1088BS単体・文字側8本ピン差し表現）
  function renderMatrix1088BS(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const pat = MATRIX_PATTERNS[part.props?.pattern || "two"] || MATRIX_PATTERNS.two;
    const litSet = new Set(pat.dots.map(([c, r]) => `${c},${r}`));

    const boxX = -0.6 * G;
    const boxY = -8.6 * G;
    const boxW = 8.2 * G;
    const boxH = 8.2 * G;

    let dotsSvg = "";
    const cell = (boxW - 16) / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cx = boxX + 8 + (c + 0.5) * cell;
        const cy = boxY + 8 + (r + 0.5) * cell;
        const isLit = litSet.has(`${c},${r}`);
        dotsSvg += `<circle cx="${cx}" cy="${cy}" r="${cell * 0.36}" fill="${isLit ? '#ef4444' : '#e2e8f0'}" stroke="${isLit ? '#991b1b' : '#94a3b8'}" stroke-width="0.9" />`;
      }
    }

    let pinsSvg = "";
    for (let i = 0; i < 8; i++) {
      const px = i * G;
      pinsSvg += `
        <line x1="${px}" y1="0" x2="${px}" y2="-8" stroke="#94a3b8" stroke-width="3" />
        <circle cx="${px}" cy="0" r="3.6" fill="#475569" stroke="#ffffff" stroke-width="1" />
        <text x="${px}" y="12" text-anchor="middle" font-size="8.5" font-weight="700" fill="#334155" ${unflipAttr(px, 9, flip)}>${i + 1}</text>
      `;
    }

    const selRing = isSelected
      ? `<rect x="${boxX - 6}" y="${boxY - 6}" width="${boxW + 12}" height="${boxH + 28}" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- 上側の浮いている側（反対側8ピンは挿さない目印） -->
      <g ${unflipAttr(3.5 * G, boxY - 8, flip)}>
        <text x="${3.5 * G}" y="${boxY - 6}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">↑ 反対側（挿さない）</text>
      </g>
      <!-- マトリクス本体 -->
      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
      ${dotsSvg}
      <!-- 文字側ラベル帯 -->
      <g ${unflipAttr(3.5 * G, -14, flip)}>
        <rect x="${boxX + 12}" y="-21" width="${boxW - 24}" height="14" rx="3" fill="#fef2f2" stroke="#dc2626" stroke-width="1.2" />
        <text x="${3.5 * G}" y="-11" text-anchor="middle" font-size="8.5" font-weight="800" fill="#b91c1c">1088BS 文字側（8本差し）</text>
      </g>
      ${pinsSvg}
    `;
  }

  // MAX7219搭載 8x8マトリクスLED（SPI 5本ピン：VCC/GND/DIN/CS/CLK）
  function renderMatrixMax7219(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const pat = MATRIX_PATTERNS[part.props?.pattern || "smile"] || MATRIX_PATTERNS.smile;
    const litSet = new Set(pat.dots.map(([c, r]) => `${c},${r}`));

    const pcbX = -0.5 * G;
    const pcbY = -8.6 * G;
    const pcbW = 7.0 * G;
    const pcbH = 8.4 * G;

    const matX = pcbX + 8;
    const matY = pcbY + 8;
    const matSize = pcbW - 16;
    const cell = matSize / 8;

    let dotsSvg = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cx = matX + (c + 0.5) * cell;
        const cy = matY + (r + 0.5) * cell;
        const isLit = litSet.has(`${c},${r}`);
        dotsSvg += `<circle cx="${cx}" cy="${cy}" r="${cell * 0.36}" fill="${isLit ? '#ef4444' : '#e2e8f0'}" stroke="${isLit ? '#991b1b' : '#94a3b8'}" stroke-width="0.8" />`;
      }
    }

    const spiPins = [
      { gx: 1, name: "VCC", color: "#dc2626" },
      { gx: 2, name: "GND", color: "#1e293b" },
      { gx: 3, name: "DIN", color: "#2563eb" },
      { gx: 4, name: "CS",  color: "#16a34a" },
      { gx: 5, name: "CLK", color: "#f97316" }
    ];

    let pinsSvg = "";
    for (const p of spiPins) {
      const px = p.gx * G;
      pinsSvg += `
        <line x1="${px}" y1="0" x2="${px}" y2="-8" stroke="#94a3b8" stroke-width="3" />
        <circle cx="${px}" cy="0" r="4" fill="${p.color}" stroke="#ffffff" stroke-width="1.2" />
        <g ${unflipAttr(px, -16, flip)}>
          <rect x="${px - 9.5}" y="-23" width="19" height="12" rx="2.5" fill="${p.color}" />
          <text x="${px}" y="-14" text-anchor="middle" font-size="7.5" font-weight="800" fill="#ffffff">${p.name}</text>
        </g>
      `;
    }

    const selRing = isSelected
      ? `<rect x="${pcbX - 6}" y="${pcbY - 6}" width="${pcbW + 12}" height="${pcbH + 16}" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- PCB基板 -->
      <rect x="${pcbX}" y="${pcbY}" width="${pcbW}" height="${pcbH}" rx="5" fill="#15803d" stroke="#14532d" stroke-width="1.8" />
      <!-- 8x8マトリクス本体 -->
      <rect x="${matX}" y="${matY}" width="${matSize}" height="${matSize}" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
      ${dotsSvg}
      <!-- 基板名 -->
      <text x="${3 * G}" y="${matY + matSize + 13}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#dcfce7" ${unflipAttr(3 * G, matY + matSize + 10, flip)}>MAX7219 (SPI)</text>
      ${pinsSvg}
    `;
  }

  // 7セグメントLEDモジュール（AE-7SEG-BOARD / 74HC595）
  function renderSevenSeg(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const digit = part.props?.digit ?? "8";
    const activeSegs = new Set(SEVEN_SEG_DIGITS[digit] || []);
    const dpOn = !!part.props?.dp;

    const pcbX = -0.6 * G;
    const pcbY = -5.8 * G;
    const pcbW = 5.2 * G;
    const pcbH = 5.5 * G;

    const dispX = pcbX + 20;
    const dispY = pcbY + 12;
    const dispW = pcbW - 40;
    const dispH = 62;

    const on = "#ef4444";
    const off = "#334155";
    const segColor = (s) => activeSegs.has(s) ? on : off;

    const pins = [
      { gx: 0, name: "VDD",   color: "#dc2626" },
      { gx: 1, name: "GND",   color: "#1e293b" },
      { gx: 2, name: "SDI",   color: "#2563eb" },
      { gx: 3, name: "SCK",   color: "#f97316" },
      { gx: 4, name: "LATCH", color: "#16a34a" }
    ];

    let pinsSvg = "";
    for (const p of pins) {
      const px = p.gx * G;
      pinsSvg += `
        <line x1="${px}" y1="0" x2="${px}" y2="-8" stroke="#94a3b8" stroke-width="3" />
        <circle cx="${px}" cy="0" r="3.8" fill="${p.color}" stroke="#ffffff" stroke-width="1.2" />
        <g ${unflipAttr(px, -16, flip)}>
          <rect x="${px - 9.5}" y="-22" width="19" height="11" rx="2" fill="${p.color}" />
          <text x="${px}" y="-14" text-anchor="middle" font-size="6.5" font-weight="800" fill="#ffffff">${p.name}</text>
        </g>
      `;
    }

    const selRing = isSelected
      ? `<rect x="${pcbX - 6}" y="${pcbY - 6}" width="${pcbW + 12}" height="${pcbH + 16}" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- 基板（緑） -->
      <rect x="${pcbX}" y="${pcbY}" width="${pcbW}" height="${pcbH}" rx="5" fill="#047857" stroke="#064e3b" stroke-width="1.8" />
      <!-- 7セグ黒ケース（数字部分は反転時にも読めるよう正立） -->
      <g ${unflipAttr(dispX + dispW / 2, dispY + dispH / 2, flip)}>
        <rect x="${dispX}" y="${dispY}" width="${dispW}" height="${dispH}" rx="3" fill="#0f172a" stroke="#475569" stroke-width="1.2" />
        <!-- 各セグメント a..g -->
        <rect x="${dispX + 14}" y="${dispY + 6}"  width="28" height="5.5" rx="2.5" fill="${segColor('a')}" />
        <rect x="${dispX + 41}" y="${dispY + 11}" width="5.5" height="18" rx="2.5" fill="${segColor('b')}" />
        <rect x="${dispX + 41}" y="${dispY + 33}" width="5.5" height="18" rx="2.5" fill="${segColor('c')}" />
        <rect x="${dispX + 14}" y="${dispY + 50}" width="28" height="5.5" rx="2.5" fill="${segColor('d')}" />
        <rect x="${dispX + 9}"  y="${dispY + 33}" width="5.5" height="18" rx="2.5" fill="${segColor('e')}" />
        <rect x="${dispX + 9}"  y="${dispY + 11}" width="5.5" height="18" rx="2.5" fill="${segColor('f')}" />
        <rect x="${dispX + 14}" y="${dispY + 28}" width="28" height="5.5" rx="2.5" fill="${segColor('g')}" />
        <circle cx="${dispX + 54}" cy="${dispY + 52}" r="3.5" fill="${dpOn ? on : off}" />
      </g>
      <text x="${2 * G}" y="-28" text-anchor="middle" font-size="8" font-weight="800" fill="#d1fae5" ${unflipAttr(2 * G, -31, flip)}>AE-7SEG (74HC595)</text>
      ${pinsSvg}
    `;
  }

  return {
    GRID,
    PICO_PINS,
    LED_COLORS,
    BUTTON_COLORS,
    WIRE_COLORS,
    MATRIX_PATTERNS,
    SEVEN_SEG_DIGITS,
    transformGrid,
    parseResistance,
    getBreadboardGroups,
    getPartPinsWorld,
    renderBreadboard,
    renderPico,
    renderPicoLabels,
    renderLed,
    renderResistor,
    renderTactSwitch,
    renderToggleSwitch,
    renderPotentiometer,
    renderBuzzer,
    renderMatrix1088BS,
    renderMatrixMax7219,
    renderSevenSeg
  };
})();
