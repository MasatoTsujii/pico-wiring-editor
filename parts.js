window.PARTS_CATALOG = (() => {
  const GRID = 20; // 2.54mm ピッチ = 20px

  // ローカル座標 → 回転＋左右反転（SVGの rotate(rot) scale(flipX?-1:1, 1) と一致）
  function transformGrid(lx, ly, rot, flipX = false) {
    const fx = flipX ? -lx : lx;
    const r = ((rot % 360) + 360) % 360;
    if (r === 90) return { gx: -ly, gy: fx };
    if (r === 180) return { gx: -fx, gy: -ly };
    if (r === 270) return { gx: ly, gy: -fx };
    return { gx: fx, gy: ly };
  }

  function unflipAttr(cx, cy, flipX) {
    return flipX ? `transform="translate(${cx}, ${cy}) scale(-1, 1) translate(${-cx}, ${-cy})"` : "";
  }

  function unrotateAttr(cx, cy, rot) {
    const r = ((rot % 360) + 360) % 360;
    return r !== 0 ? `transform="rotate(${-r}, ${cx}, ${cy})"` : "";
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

  // 吹き出しテーマ色
  const ANNOTATION_COLORS = [
    { id: "#2563eb", name: "青", bg: "#eff6ff", text: "#1e3a8a" },
    { id: "#dc2626", name: "赤", bg: "#fef2f2", text: "#991b1b" },
    { id: "#16a34a", name: "緑", bg: "#f0fdf4", text: "#14532d" },
    { id: "#ea580c", name: "橙", bg: "#fff7ed", text: "#9a3412" },
    { id: "#9333ea", name: "紫", bg: "#faf5ff", text: "#581c87" },
    { id: "#1e293b", name: "黒", bg: "#ffffff", text: "#0f172a" }
  ];

  const BAND_DIGIT_COLORS = [
    "#111827", "#92400e", "#dc2626", "#f97316", "#eab308",
    "#16a34a", "#2563eb", "#9333ea", "#64748b", "#f8fafc"
  ];

  // 抵抗値のパース＆4本帯カラーコード計算
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

    let label = "";
    if (num >= 1e6) label = `${+(num / 1e6).toFixed(2)}MΩ`;
    else if (num >= 1e3) label = `${+(num / 1e3).toFixed(2)}kΩ`;
    else label = `${+num.toFixed(2)}Ω`;

    if (num <= 0) {
      return { label: "0Ω", bands: ["#111827", "#111827", "#111827", "#eab308"], valid: true };
    }

    const exp = Math.floor(Math.log10(num));
    const sig = Math.round(num / Math.pow(10, exp - 1));
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
    else if (multExp === -1) multColor = "#eab308";
    else if (multExp === -2) multColor = "#cbd5e1";

    return {
      label,
      bands: [
        BAND_DIGIT_COLORS[Math.max(0, Math.min(9, d1))],
        BAND_DIGIT_COLORS[Math.max(0, Math.min(9, d2))],
        multColor,
        "#eab308"
      ],
      valid: true
    };
  }

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

  // ブレッドボードの行数から電源レール穴のX座標一覧（5穴ブロック単位）を計算
  function getBreadboardRailXs(rows) {
    const railXs = [];
    for (let block = 0; block < 10; block++) {
      const start = 1 + block * 6;
      if (start + 4 > rows - 1) break;
      for (let i = 0; i < 5; i++) railXs.push(start + i);
    }
    return railXs;
  }

  // ブレッドボード導通グループ定義（30〜63行の可変行数に対応）
  function getBreadboardGroups(part) {
    const rows = Math.max(20, Math.min(63, Number(part.props?.rows || 30)));
    const groups = [];
    const railXs = getBreadboardRailXs(rows);

    const railConfigs = [
      { id: "top-minus", gy: -3, kind: "minus" },
      { id: "top-plus",  gy: -2, kind: "plus"  },
      { id: "bot-plus",  gy: 13, kind: "plus"  },
      { id: "bot-minus", gy: 14, kind: "minus" }
    ];

    if (railXs.length > 0) {
      const firstX = railXs[0];
      const lastX = railXs[railXs.length - 1];
      for (const rc of railConfigs) {
        const cells = railXs.map(lx => {
          const r = transformGrid(lx, rc.gy, part.rot, false);
          return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx, ly: rc.gy };
        });
        groups.push({ id: `${part.id}:${rc.id}`, kind: rc.kind, isRail: true, cells, lx1: firstX, ly1: rc.gy, lx2: lastX, ly2: rc.gy });
      }
    }

    for (let col = 0; col < rows; col++) {
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
        { name: "端子1", gx: 0, gy: 0 },
        { name: "端子2", gx: span, gy: 0 }
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
    } else if (part.type === "rfid_rc522") {
      locals = [
        { name: "SDA",  kind: "gpio", gx: 0, gy: 0 },
        { name: "SCK",  kind: "gpio", gx: 1, gy: 0 },
        { name: "MOSI", kind: "gpio", gx: 2, gy: 0 },
        { name: "MISO", kind: "gpio", gx: 3, gy: 0 },
        { name: "IRQ",  kind: "sys",  gx: 4, gy: 0 },
        { name: "GND",  kind: "gnd",  gx: 5, gy: 0 },
        { name: "RST",  kind: "gpio", gx: 6, gy: 0 },
        { name: "3.3V", kind: "pwr",  gx: 7, gy: 0 }
      ];
    } else if (part.type === "servo_sg90") {
      locals = [
        { name: "GND(茶)", kind: "gnd",  gx: 0, gy: 0 },
        { name: "5V(赤)",  kind: "pwr",  gx: 1, gy: 0 },
        { name: "PWM(橙)", kind: "gpio", gx: 2, gy: 0 }
      ];
    } else if (part.type === "dht11") {
      const order = part.props?.pinOrder || "vcc_out_gnd";
      if (order === "out_vcc_gnd") {
        locals = [
          { name: "OUT",    kind: "gpio", gx: 0, gy: 0 },
          { name: "VCC(+)", kind: "pwr",  gx: 1, gy: 0 },
          { name: "GND(-)", kind: "gnd",  gx: 2, gy: 0 }
        ];
      } else {
        locals = [
          { name: "VCC(+)", kind: "pwr",  gx: 0, gy: 0 },
          { name: "OUT",    kind: "gpio", gx: 1, gy: 0 },
          { name: "GND(-)", kind: "gnd",  gx: 2, gy: 0 }
        ];
      }
    } else if (part.type === "fingerprint_as608") {
      const pinCount = Number(part.props?.pinCount || 4);
      locals = [
        { name: "3.3V", kind: "pwr",  gx: 0, gy: 0 },
        { name: "TX",   kind: "gpio", gx: 1, gy: 0 },
        { name: "RX",   kind: "gpio", gx: 2, gy: 0 },
        { name: "GND",  kind: "gnd",  gx: 3, gy: 0 }
      ];
      if (pinCount === 6) {
        locals.push(
          { name: "TCH", kind: "gpio", gx: 4, gy: 0 },
          { name: "VT",  kind: "pwr",  gx: 5, gy: 0 }
        );
      }
    }

    return locals.map(p => {
      const r = transformGrid(p.gx, p.gy, part.rot, flip);
      return { ...p, worldGx: part.gx + r.gx, worldGy: part.gy + r.gy };
    });
  }

  // ==================== 各部品のSVG描画 ====================

  // ブレッドボード（30〜63行の可変行数＋下端省略波線対応）
  function renderBreadboard(part, isSelected) {
    const G = GRID;
    const rot = part.rot || 0;
    const rows = Math.max(20, Math.min(63, Number(part.props?.rows || 30)));
    const showCut = part.props?.cutBottom !== undefined ? !!part.props.cutBottom : (rows < 60);

    const x0 = -1.2 * G;
    const y0 = -4.0 * G;
    const width = (rows + 1.4) * G;
    const height = 19.0 * G;
    const endX = x0 + width;

    const railXs = getBreadboardRailXs(rows);

    let holes = "";
    for (const ry of [-3, -2, 13, 14]) {
      for (const rx of railXs) {
        holes += `<rect x="${rx * G - 3.5}" y="${ry * G - 3.5}" width="7" height="7" rx="1.2" fill="#334155" />`;
      }
    }
    for (let col = 0; col < rows; col++) {
      for (const ly of [0, 1, 2, 3, 4, 7, 8, 9, 10, 11]) {
        holes += `<rect x="${col * G - 3.5}" y="${ly * G - 3.5}" width="7" height="7" rx="1.2" fill="#334155" />`;
      }
    }

    let colNums = "";
    for (let col = 0; col < rows; col++) {
      const num = col + 1;
      const bold = (num === 1 || num % 5 === 0) ? "700" : "500";
      const fill = (num === 1 || num % 5 === 0) ? "#1e293b" : "#94a3b8";
      const x = col * G;
      const y1 = -0.95 * G;
      const y2 = 11.95 * G;
      colNums += `<text x="${x}" y="${y1}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="${bold}" fill="${fill}" ${unrotateAttr(x, y1, rot)}>${num}</text>`;
      colNums += `<text x="${x}" y="${y2}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="${bold}" fill="${fill}" ${unrotateAttr(x, y2, rot)}>${num}</text>`;
    }

    const rowLabels = [
      ["a", 0], ["b", 1], ["c", 2], ["d", 3], ["e", 4],
      ["f", 7], ["g", 8], ["h", 9], ["i", 10], ["j", 11]
    ];
    let rowTexts = "";
    for (const [ch, ly] of rowLabels) {
      const y = ly * G;
      const x1 = -0.75 * G;
      const x2 = (rows - 0.25) * G;
      rowTexts += `<text x="${x1}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill="#475569" ${unrotateAttr(x1, y, rot)}>${ch}</text>`;
      rowTexts += `<text x="${x2}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill="#475569" ${unrotateAttr(x2, y, rot)}>${ch}</text>`;
    }

    const railSigns = [
      [-0.45 * G, -3 * G, "−", "#2563eb"],
      [-0.45 * G, -2 * G, "＋", "#ef4444"],
      [-0.45 * G, 13 * G, "＋", "#ef4444"],
      [-0.45 * G, 14 * G, "−", "#2563eb"]
    ];
    let signsSvg = "";
    for (const [sx, sy, ch, color] of railSigns) {
      signsSvg += `<text x="${sx}" y="${sy}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="${color}" ${unrotateAttr(sx, sy, rot)}>${ch}</text>`;
    }

    const stroke = isSelected ? "#2563eb" : "#cbd5e1";
    const strokeW = isSelected ? 2.5 : 1.5;
    const lineEnd = (rows - 0.3) * G;

    // ボード外枠（下端省略表示ONのときは右端＝縦置き時の下端をギザギザカット線で描画）
    let bodyShape = "";
    let cutHintSvg = "";
    if (showCut) {
      const zigSteps = 12;
      const stepH = height / zigSteps;
      let zig = "";
      for (let i = 1; i <= zigSteps; i++) {
        const py = y0 + stepH * i;
        const px = (i % 2 === 1) ? endX - 5 : endX;
        zig += ` L ${px},${py}`;
      }
      bodyShape = `
        <path d="M ${x0 + 8},${y0} L ${endX},${y0}${zig} L ${x0 + 8},${y0 + height} Q ${x0},${y0 + height} ${x0},${y0 + height - 8} L ${x0},${y0 + 8} Q ${x0},${y0} ${x0 + 8},${y0} Z"
              fill="#ffffff" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round" />
      `;
      const cx = endX + 12;
      const cy = 5.5 * G;
      cutHintSvg = `
        <g ${unrotateAttr(cx, cy, rot)}>
          <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="#94a3b8">…下に続く (${rows}行まで表示)</text>
        </g>
      `;
    } else {
      bodyShape = `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" rx="8" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeW}" />`;
    }

    return `
      ${bodyShape}
      <rect x="${x0 + 4}" y="${5.1 * G}" width="${width - 10}" height="${0.8 * G}" rx="3" fill="#e2e8f0" />
      <line x1="${0.3 * G}" y1="${-3.55 * G}" x2="${lineEnd}" y2="${-3.55 * G}" stroke="#2563eb" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${-1.45 * G}" x2="${lineEnd}" y2="${-1.45 * G}" stroke="#ef4444" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${12.45 * G}" x2="${lineEnd}" y2="${12.45 * G}" stroke="#ef4444" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${14.55 * G}" x2="${lineEnd}" y2="${14.55 * G}" stroke="#2563eb" stroke-width="2" />
      ${signsSvg}
      ${colNums}
      ${rowTexts}
      ${holes}
      ${cutHintSvg}
    `;
  }

  function renderPico(part, isSelected, isTransparent = false) {
    const G = GRID;
    const rot = ((part.rot || 0) % 360 + 360) % 360;
    const isVertical = rot === 90 || rot === 270;
    const x0 = -0.6 * G;
    const y0 = -0.6 * G;
    const w = 20.2 * G;
    const h = 8.2 * G;
    const modelName = part.props?.model || "Raspberry Pi Pico";
    const chipName = modelName.includes("2") ? "RP2350" : "RP2040";
    const stroke = isSelected ? "#facc15" : "#065f46";
    const strokeW = isSelected ? 3 : 1.6;
    const pcbFillOpacity = isTransparent ? 0.36 : 1.0;
    const subOpacity = isTransparent ? 0.55 : 1.0;

    let pinsSvg = "";
    for (const p of PICO_PINS) {
      const cx = p.gx * G;
      const cy = p.gy * G;
      const numY = p.side === "top" ? cy + 13 : cy - 13;
      const numColor = isTransparent ? "#0f172a" : "#ccfbf1";
      pinsSvg += `
        <circle cx="${cx}" cy="${cy}" r="6.5" fill="#eab308" stroke="#ca8a04" stroke-width="1" />
        <rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" rx="1" fill="#334155" />
        <circle cx="${cx}" cy="${cy}" r="1.5" fill="#e2e8f0" />
        <text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="central" font-size="7.5" font-weight="700" fill="${numColor}" ${unrotateAttr(cx, numY, rot)}>${p.num}</text>
      `;
    }

    const usbCx = x0 + 5;
    const usbCy = 3.5 * G;
    const chipCx = 9.5 * G;
    const chipCy = 3.5 * G;
    const logoCx = 14.8 * G;
    const logoCy = 3.5 * G;

    const logoText = isVertical
      ? `<g ${unrotateAttr(logoCx, logoCy, rot)}>
           <text x="${logoCx}" y="${logoCy - 7}" text-anchor="middle" dominant-baseline="central" font-size="10.5" font-weight="800" fill="${isTransparent ? '#064e3b' : '#ffffff'}">Raspberry Pi</text>
           <text x="${logoCx}" y="${logoCy + 7}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="${isTransparent ? '#064e3b' : '#ffffff'}">${modelName.replace('Raspberry Pi ', '')}</text>
         </g>`
      : `<g ${unrotateAttr(logoCx, logoCy, rot)}>
           <text x="${logoCx}" y="${logoCy - 5}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="${isTransparent ? '#064e3b' : '#ffffff'}">${modelName}</text>
           <text x="${logoCx}" y="${logoCy + 10}" text-anchor="middle" dominant-baseline="central" font-size="8" fill="${isTransparent ? '#0f766e' : '#99f6e4'}">Pin 1 〜 Pin 40</text>
         </g>`;

    return `
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5" fill="#0f766e" fill-opacity="${pcbFillOpacity}" stroke="${stroke}" stroke-width="${strokeW}" />
      <rect x="${x0 - 8}" y="${2.4 * G}" width="26" height="${2.2 * G}" rx="3" fill="#cbd5e1" fill-opacity="${subOpacity}" stroke="#64748b" stroke-width="1.5" />
      <text x="${usbCx}" y="${usbCy}" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="#334155" ${unrotateAttr(usbCx, usbCy, rot)}>USB</text>
      <rect x="${2.8 * G}" y="${2.5 * G}" width="26" height="18" rx="3" fill="#f8fafc" fill-opacity="${subOpacity}" stroke="#94a3b8" stroke-width="1.2" />
      <rect x="${2.0 * G}" y="${1.3 * G}" width="10" height="7" rx="1.5" fill="#86efac" fill-opacity="${subOpacity}" stroke="#15803d" stroke-width="0.8" />
      <rect x="${8.2 * G}" y="${2.2 * G}" width="${2.6 * G}" height="${2.6 * G}" rx="3" fill="#1e293b" fill-opacity="${subOpacity}" stroke="#475569" stroke-width="1.2" />
      <text x="${chipCx}" y="${chipCy}" text-anchor="middle" dominant-baseline="central" font-size="8.5" font-weight="700" fill="#e2e8f0" ${unrotateAttr(chipCx, chipCy, rot)}>${chipName}</text>
      ${logoText}
      <polygon points="${0},${5.95 * G} ${-4},${6.35 * G} ${4},${6.35 * G}" fill="#fde047" stroke="#854d0e" stroke-width="0.6" />
      ${pinsSvg}
    `;
  }

  function renderPicoLabels(part, mode, usedPinKeys, isMountedOnBoard = false) {
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
        const dist = isMountedOnBoard ? 138 : 30;
        const lx = px + dir.gx * dist;
        const ly = py + dir.gy * dist;
        const text = `${p.num} ${p.label}`;
        const boxW = Math.max(58, text.length * 7.5 + 14);
        const boxH = 22;
        const bx = dir.gx > 0 ? lx : (dir.gx < 0 ? lx - boxW : lx - boxW / 2);
        const by = dir.gy > 0 ? ly : (dir.gy < 0 ? ly - boxH : ly - boxH / 2);
        const dash = isMountedOnBoard ? `stroke-dasharray="4 3"` : "";

        html += `
          <g class="pico-pin-badge">
            <circle cx="${px}" cy="${py}" r="8" fill="none" stroke="${color}" stroke-width="2.5" />
            <line x1="${px + dir.gx * 8}" y1="${py + dir.gy * 8}" x2="${lx}" y2="${ly}" stroke="${color}" stroke-width="2" ${dash} />
            <rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="11" fill="${color}" stroke="#ffffff" stroke-width="2" />
            <text x="${bx + boxW / 2}" y="${by + 11.5}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#ffffff">${text}</text>
          </g>
        `;
      } else {
        const isVerticalPinRow = dir.gy !== 0;
        const text = `${p.num}:${p.label}`;
        const badgeLen = 64;
        const badgeThick = 16;
        const offset = isMountedOnBoard ? 134 : 14;

        if (isVerticalPinRow) {
          const edgeY = dir.gy < 0 ? py - offset : py + offset;
          const cy = dir.gy < 0 ? edgeY - badgeLen / 2 : edgeY + badgeLen / 2;
          html += `
            ${isMountedOnBoard ? `<line x1="${px}" y1="${py + dir.gy * 7}" x2="${px}" y2="${edgeY}" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.65" />` : ""}
            <g transform="translate(${px}, ${cy}) rotate(-90)">
              <rect x="${-badgeLen / 2}" y="${-badgeThick / 2}" width="${badgeLen}" height="${badgeThick}" rx="3" fill="${color}" stroke="${isUsed ? '#facc15' : '#ffffff'}" stroke-width="${isUsed ? 2 : 1}" />
              <text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="#ffffff">${text}</text>
            </g>
          `;
        } else {
          const edgeX = dir.gx < 0 ? px - offset : px + offset;
          const cx = dir.gx < 0 ? edgeX - badgeLen / 2 : edgeX + badgeLen / 2;
          html += `
            ${isMountedOnBoard ? `<line x1="${px + dir.gx * 7}" y1="${py}" x2="${edgeX}" y2="${py}" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.65" />` : ""}
            <g transform="translate(${cx}, ${py})">
              <rect x="${-badgeLen / 2}" y="${-badgeThick / 2}" width="${badgeLen}" height="${badgeThick}" rx="3" fill="${color}" stroke="${isUsed ? '#facc15' : '#ffffff'}" stroke-width="${isUsed ? 2 : 1}" />
              <text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="#ffffff">${text}</text>
            </g>
          `;
        }
      }
    }
    return html;
  }

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

    return `
      <rect x="-12" y="-48" width="${totalW + 24}" height="54" fill="transparent" />
      ${selRing}
      <path d="M 0,0 L 0,-11 L ${midX - 5},-18 L ${midX - 5},-25" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M ${totalW},0 L ${totalW},-16 L ${midX + 5},-18 L ${midX + 5},-25" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M ${midX - 11},-24 L ${midX - 11},-35 A 11.5,11.5 0 0 1 ${midX + 10.5},-35 L ${midX + 10.5},-24 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="1.6" />
      <rect x="${midX - 13}" y="-26" width="25" height="4.5" rx="1.5" fill="${c.body}" stroke="${c.dark}" stroke-width="1.2" />
      <ellipse cx="${midX - 4}" cy="-35" rx="3" ry="5" fill="${c.glow}" opacity="0.85" />
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
      <line x1="0" y1="0" x2="0" y2="${h}" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />
      <line x1="${w}" y1="0" x2="${w}" y2="${h}" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />
      <rect x="-4" y="6" width="${w + 8}" height="${h - 12}" rx="5" fill="#e2e8f0" stroke="#64748b" stroke-width="1.6" />
      <rect x="0" y="10" width="${w}" height="${h - 20}" rx="3" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" />
      <circle cx="3" cy="13" r="2.2" fill="#475569" />
      <circle cx="${w - 3}" cy="13" r="2.2" fill="#475569" />
      <circle cx="3" cy="${h - 13}" r="2.2" fill="#475569" />
      <circle cx="${w - 3}" cy="${h - 13}" r="2.2" fill="#475569" />
      <line x1="2" y1="0" x2="${w - 2}" y2="0" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 2" />
      <line x1="2" y1="${h}" x2="${w - 2}" y2="${h}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 2" />
      <circle cx="${w / 2}" cy="${h / 2}" r="12" fill="${bc.fill}" stroke="${bc.stroke}" stroke-width="1.8" />
      <circle cx="${w / 2 - 3}" cy="${h / 2 - 3}" r="3" fill="#ffffff" opacity="0.28" />
      <circle cx="0" cy="0" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${w}" cy="0" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="0" cy="${h}" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${w}" cy="${h}" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
    `;
  }

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
      <line x1="0" y1="0" x2="0" y2="-10" stroke="#94a3b8" stroke-width="3" />
      <line x1="${G}" y1="0" x2="${G}" y2="-10" stroke="#eab308" stroke-width="3.5" />
      <line x1="${2 * G}" y1="0" x2="${2 * G}" y2="-10" stroke="#94a3b8" stroke-width="3" />
      <rect x="-6" y="-26" width="${2 * G + 12}" height="18" rx="3" fill="#334155" stroke="#0f172a" stroke-width="1.5" />
      <line x1="${G}" y1="-26" x2="${leverEndX}" y2="-39" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round" />
      <circle cx="${leverEndX}" cy="-39" r="4" fill="#94a3b8" stroke="#475569" stroke-width="1" />
      <text x="${G}" y="-14" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fde047" ${unflipAttr(G, -17, flip)}>COM</text>
      <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${G}" cy="0" r="4" fill="#eab308" stroke="#ffffff" stroke-width="1" />
      <circle cx="${2 * G}" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <g ${unflipAttr(G, 12, flip)}>
        <rect x="${G - 14}" y="5" width="28" height="12" rx="3" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.9" />
        <text x="${G}" y="14" text-anchor="middle" font-size="8.5" font-weight="800" fill="#854d0e">COM</text>
      </g>
    `;
  }

  function renderPotentiometer(part, isSelected) {
    const G = GRID;
    const step = part.props?.step || 1;
    const totalW = step * 2 * G;
    const midX = totalW / 2;
    const flip = !!part.flipX;
    const label = part.props?.label || "B5K";
    const knobPos = Number(part.props?.knobPos ?? 50);
    const angle = -135 + (knobPos / 100) * 270;

    const selRing = isSelected
      ? `<rect x="${midX - 28}" y="-56" width="56" height="72" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      <rect x="${midX - 26}" y="-54" width="52" height="66" fill="transparent" />
      ${selRing}
      <line x1="0" y1="0" x2="0" y2="-12" stroke="#94a3b8" stroke-width="3" />
      <line x1="${midX}" y1="0" x2="${midX}" y2="-12" stroke="#2563eb" stroke-width="3.2" />
      <line x1="${totalW}" y1="0" x2="${totalW}" y2="-12" stroke="#94a3b8" stroke-width="3" />
      <rect x="${midX - 22}" y="-50" width="44" height="40" rx="6" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.6" />
      <circle cx="${midX}" cy="-32" r="14" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <g transform="translate(${midX}, -32) rotate(${angle})">
        <line x1="0" y1="0" x2="0" y2="-11" stroke="#dc2626" stroke-width="3" stroke-linecap="round" />
      </g>
      <circle cx="${midX}" cy="-32" r="3" fill="#475569" />
      <text x="${midX}" y="-12" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffffff" ${unflipAttr(midX, -15, flip)}>${label}</text>
      <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${midX}" cy="0" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <g ${unflipAttr(midX, 12, flip)}>
        <rect x="${midX - 15}" y="5" width="30" height="12" rx="3" fill="#dbeafe" stroke="#2563eb" stroke-width="0.9" />
        <text x="${midX}" y="14" text-anchor="middle" font-size="8" font-weight="800" fill="#1d4ed8">ADC</text>
      </g>
    `;
  }

  function renderBuzzer(part, isSelected) {
    const G = GRID;
    const span = part.props?.span || 3;
    const totalW = span * G;
    const midX = totalW / 2;
    const flip = !!part.flipX;
    const typeLabel = part.props?.buzzerType === "active" ? "アクティブ" : "パッシブ";

    const selRing = isSelected
      ? `<rect x="${Math.min(-10, midX - 28)}" y="-56" width="${Math.max(totalW + 20, 56)}" height="66" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      <rect x="${Math.min(-8, midX - 26)}" y="-54" width="${Math.max(totalW + 16, 52)}" height="60" fill="transparent" />
      ${selRing}
      <path d="M 0,0 L 0,-12 L ${midX - 10},-22" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" />
      <path d="M ${totalW},0 L ${totalW},-12 L ${midX + 10},-22" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" />
      <circle cx="${midX}" cy="-28" r="23" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
      <circle cx="${midX}" cy="-28" r="19" fill="none" stroke="#475569" stroke-width="1" />
      <circle cx="${midX}" cy="-28" r="5.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2" />
      <text x="${midX}" y="-12" text-anchor="middle" font-size="7.5" font-weight="700" fill="#cbd5e1" ${unflipAttr(midX, -15, flip)}>${typeLabel}</text>
      <circle cx="0" cy="0" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.8" fill="#475569" stroke="#ffffff" stroke-width="1" />
    `;
  }

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
      <g ${unflipAttr(3.5 * G, boxY - 8, flip)}>
        <text x="${3.5 * G}" y="${boxY - 6}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">↑ 反対側（挿さない）</text>
      </g>
      <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
      ${dotsSvg}
      <g ${unflipAttr(3.5 * G, -14, flip)}>
        <rect x="${3.5 * G - 26}" y="-22" width="52" height="15" rx="3.5" fill="#fef2f2" stroke="#dc2626" stroke-width="1.3" />
        <text x="${3.5 * G}" y="-11" text-anchor="middle" font-size="9.5" font-weight="800" fill="#b91c1c">文字側</text>
      </g>
      ${pinsSvg}
    `;
  }

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
      <rect x="${pcbX}" y="${pcbY}" width="${pcbW}" height="${pcbH}" rx="5" fill="#15803d" stroke="#14532d" stroke-width="1.8" />
      <rect x="${matX}" y="${matY}" width="${matSize}" height="${matSize}" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
      ${dotsSvg}
      <text x="${3 * G}" y="${matY + matSize + 13}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#dcfce7" ${unflipAttr(3 * G, matY + matSize + 10, flip)}>MAX7219 (SPI)</text>
      ${pinsSvg}
    `;
  }

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
      <rect x="${pcbX}" y="${pcbY}" width="${pcbW}" height="${pcbH}" rx="5" fill="#047857" stroke="#064e3b" stroke-width="1.8" />
      <g ${unflipAttr(dispX + dispW / 2, dispY + dispH / 2, flip)}>
        <rect x="${dispX}" y="${dispY}" width="${dispW}" height="${dispH}" rx="3" fill="#0f172a" stroke="#475569" stroke-width="1.2" />
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

  // ==================== 新規追加4部品 ====================

  // 1. RFID RC522（青基板・アンテナコイル・8ピン・3.3V専用表示）
  function renderRfidRc522(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const pcbX = -0.6 * G;
    const pcbY = -10.4 * G;
    const pcbW = 8.2 * G;
    const pcbH = 10.0 * G;
    const cx = 3.5 * G;

    const pins = [
      { gx: 0, name: "SDA",  color: "#16a34a" },
      { gx: 1, name: "SCK",  color: "#f97316" },
      { gx: 2, name: "MOSI", color: "#2563eb" },
      { gx: 3, name: "MISO", color: "#9333ea" },
      { gx: 4, name: "IRQ",  color: "#64748b" },
      { gx: 5, name: "GND",  color: "#1e293b" },
      { gx: 6, name: "RST",  color: "#ca8a04" },
      { gx: 7, name: "3.3V", color: "#dc2626" }
    ];

    let pinsSvg = "";
    for (const p of pins) {
      const px = p.gx * G;
      pinsSvg += `
        <line x1="${px}" y1="0" x2="${px}" y2="-9" stroke="#94a3b8" stroke-width="3" />
        <circle cx="${px}" cy="0" r="3.8" fill="${p.color}" stroke="#ffffff" stroke-width="1.2" />
        <g ${unflipAttr(px, -19, flip)}>
          <rect x="${px - 9.2}" y="-27" width="18.4" height="16" rx="2.5" fill="${p.color}" stroke="#ffffff" stroke-width="0.7" />
          <text x="${px}" y="-19" text-anchor="middle" dominant-baseline="central" font-size="6.4" font-weight="800" fill="#ffffff">${p.name}</text>
        </g>
      `;
    }

    const selRing = isSelected
      ? `<rect x="${pcbX - 6}" y="${pcbY - 6}" width="${pcbW + 12}" height="${pcbH + 18}" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- 青基板本体 -->
      <rect x="${pcbX}" y="${pcbY}" width="${pcbW}" height="${pcbH}" rx="6" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="2" />
      <!-- 四隅の取付穴 -->
      <circle cx="${pcbX + 9}" cy="${pcbY + 9}" r="3.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" />
      <circle cx="${pcbX + pcbW - 9}" cy="${pcbY + 9}" r="3.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" />
      <!-- アンテナコイル枠 -->
      <rect x="${pcbX + 12}" y="${pcbY + 14}" width="${pcbW - 24}" height="82" rx="6" fill="none" stroke="#93c5fd" stroke-width="1.8" />
      <rect x="${pcbX + 18}" y="${pcbY + 20}" width="${pcbW - 36}" height="70" rx="4" fill="none" stroke="#bfdbfe" stroke-width="1.3" />
      <rect x="${pcbX + 24}" y="${pcbY + 26}" width="${pcbW - 48}" height="58" rx="3" fill="none" stroke="#dbeafe" stroke-width="1" />
      <!-- RFID 電波シンボル -->
      <g ${unflipAttr(cx, pcbY + 55, flip)}>
        <circle cx="${cx}" cy="${pcbY + 62}" r="3.5" fill="#ffffff" />
        <path d="M ${cx - 10},${pcbY + 55} A 14,14 0 0 1 ${cx + 10},${pcbY + 55}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
        <path d="M ${cx - 17},${pcbY + 48} A 23,23 0 0 1 ${cx + 17},${pcbY + 48}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
        <path d="M ${cx - 24},${pcbY + 41} A 32,32 0 0 1 ${cx + 24},${pcbY + 41}" fill="none" stroke="#bfdbfe" stroke-width="2" stroke-linecap="round" />
      </g>
      <!-- MFRC522 ICチップ -->
      <rect x="${cx - 14}" y="${pcbY + 106}" width="28" height="28" rx="2" fill="#0f172a" stroke="#475569" stroke-width="1.2" />
      <!-- ラベル & 3.3V注意 -->
      <g ${unflipAttr(cx, pcbY + 150, flip)}>
        <text x="${cx}" y="${pcbY + 146}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#ffffff">RFID-RC522</text>
        <rect x="${cx - 34}" y="${pcbY + 152}" width="68" height="14" rx="3" fill="#fef2f2" stroke="#dc2626" stroke-width="1" />
        <text x="${cx}" y="${pcbY + 162}" text-anchor="middle" font-size="8" font-weight="800" fill="#b91c1c">※3.3V専用</text>
      </g>
      ${pinsSvg}
    `;
  }

  // 2. サーボモーター SG90（茶GND / 赤5V / 橙PWM + 可動ホーン角度）
  function renderServoSg90(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const angle = Number(part.props?.angle ?? 90);
    const hornRot = angle - 90; // 0°→-90°, 90°→0°(上), 180°→+90°
    const cx = G;

    const pins = [
      { gx: 0, name: "GND", wire: "#78350f", badge: "#1e293b" },
      { gx: 1, name: "5V",  wire: "#dc2626", badge: "#dc2626" },
      { gx: 2, name: "PWM", wire: "#f97316", badge: "#f97316" }
    ];

    let wiresSvg = "";
    for (const p of pins) {
      const px = p.gx * G;
      wiresSvg += `
        <path d="M ${px},0 L ${px},-18 C ${px},-26 ${cx + (p.gx - 1) * 5},-28 ${cx + (p.gx - 1) * 5},-38"
              fill="none" stroke="${p.wire}" stroke-width="3.6" stroke-linecap="round" />
        <circle cx="${px}" cy="0" r="3.8" fill="${p.wire}" stroke="#ffffff" stroke-width="1.2" />
        <g ${unflipAttr(px, -11, flip)}>
          <rect x="${px - 9.5}" y="-17" width="19" height="11" rx="2.5" fill="${p.badge}" />
          <text x="${px}" y="-11.5" text-anchor="middle" dominant-baseline="central" font-size="6.8" font-weight="800" fill="#ffffff">${p.name}</text>
        </g>
      `;
    }

    const selRing = isSelected
      ? `<rect x="${cx - 46}" y="-128" width="92" height="138" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      <rect x="${cx - 44}" y="-124" width="88" height="130" fill="transparent" />
      ${selRing}
      <!-- 3本リード線（茶・赤・橙） -->
      ${wiresSvg}
      <!-- コネクタハウジング -->
      <rect x="-7" y="-6" width="${2 * G + 14}" height="8" rx="2" fill="#1e293b" opacity="0.22" />
      <!-- 取付フランジ（左右の耳） -->
      <rect x="${cx - 40}" y="-86" width="80" height="10" rx="2.5" fill="#3b82f6" stroke="#1e40af" stroke-width="1.4" />
      <circle cx="${cx - 33}" cy="-81" r="2.6" fill="#f8fafc" />
      <circle cx="${cx + 33}" cy="-81" r="2.6" fill="#f8fafc" />
      <!-- サーボ本体（半透明ブルー） -->
      <rect x="${cx - 26}" y="-108" width="52" height="72" rx="5" fill="#2563eb" fill-opacity="0.9" stroke="#1e3a8a" stroke-width="1.8" />
      <!-- 内部ギアのうっすら表現 -->
      <rect x="${cx - 21}" y="-74" width="42" height="30" rx="3" fill="#1d4ed8" stroke="#60a5fa" stroke-width="0.8" />
      <!-- ラベル -->
      <g ${unflipAttr(cx, -59, flip)}>
        <text x="${cx}" y="-63" text-anchor="middle" font-size="9.5" font-weight="800" fill="#ffffff">SG90</text>
        <text x="${cx}" y="-51" text-anchor="middle" font-size="8" font-weight="700" fill="#bfdbfe">${angle}°</text>
      </g>
      <!-- ギア軸＆回転する白いサーボホーン -->
      <circle cx="${cx}" cy="-94" r="14" fill="#60a5fa" stroke="#1e3a8a" stroke-width="1.4" />
      <g transform="translate(${cx}, -94) rotate(${hornRot})">
        <path d="M -5,3 L -3,-28 A 3,3 0 0 1 3,-28 L 5,3 Z" fill="#f8fafc" stroke="#64748b" stroke-width="1.4" />
        <circle cx="0" cy="-21" r="1.4" fill="#64748b" />
        <circle cx="0" cy="-14" r="1.4" fill="#64748b" />
      </g>
      <circle cx="${cx}" cy="-94" r="6" fill="#ffffff" stroke="#475569" stroke-width="1.4" />
      <circle cx="${cx}" cy="-94" r="2.2" fill="#475569" />
    `;
  }

  // 3. 温度湿度センサー WWZMDiB DHT11（3ピンモジュール・ピン順切替可）
  function renderDht11(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const order = part.props?.pinOrder || "vcc_out_gnd";
    const cx = G;

    const pins = order === "out_vcc_gnd"
      ? [
          { gx: 0, name: "OUT", color: "#2563eb" },
          { gx: 1, name: "+",   color: "#dc2626" },
          { gx: 2, name: "−",   color: "#1e293b" }
        ]
      : [
          { gx: 0, name: "+",   color: "#dc2626" },
          { gx: 1, name: "OUT", color: "#2563eb" },
          { gx: 2, name: "−",   color: "#1e293b" }
        ];

    let pinsSvg = "";
    for (const p of pins) {
      const px = p.gx * G;
      pinsSvg += `
        <line x1="${px}" y1="0" x2="${px}" y2="-10" stroke="#94a3b8" stroke-width="3" />
        <circle cx="${px}" cy="0" r="3.8" fill="${p.color}" stroke="#ffffff" stroke-width="1.2" />
        <g ${unflipAttr(px, -17, flip)}>
          <rect x="${px - 9.2}" y="-23" width="18.4" height="12" rx="2.5" fill="${p.color}" />
          <text x="${px}" y="-17" text-anchor="middle" dominant-baseline="central" font-size="7.5" font-weight="800" fill="#ffffff">${p.name}</text>
        </g>
      `;
    }

    // 青い格子パターン（DHT11本体）
    let gridSvg = "";
    const bx = cx - 22;
    const by = -98;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        gridSvg += `<rect x="${bx + 6 + c * 9}" y="${by + 8 + r * 9}" width="6" height="6" rx="1" fill="#0369a1" />`;
      }
    }

    const selRing = isSelected
      ? `<rect x="${cx - 34}" y="-108" width="68" height="118" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- 下部モジュールPCB（青基板） -->
      <rect x="${cx - 28}" y="-62" width="56" height="54" rx="5" fill="#1e3a8a" stroke="#0f172a" stroke-width="1.6" />
      <!-- チップ抵抗・LEDの装飾 -->
      <rect x="${cx - 22}" y="-37" width="8" height="4" rx="1" fill="#facc15" />
      <circle cx="${cx + 18}" cy="-35" r="2.8" fill="#22c55e" stroke="#ffffff" stroke-width="0.6" />
      <!-- 水色のDHT11センサー本体 -->
      <rect x="${bx}" y="${by}" width="44" height="54" rx="4" fill="#38bdf8" stroke="#0284c7" stroke-width="1.8" />
      ${gridSvg}
      <!-- ラベル -->
      <g ${unflipAttr(cx, -34, flip)}>
        <text x="${cx}" y="-33" text-anchor="middle" font-size="9" font-weight="800" fill="#ffffff">DHT11</text>
      </g>
      ${pinsSvg}
    `;
  }

  // 4. 指紋リーダー AS608（光学窓＋4本/6本UARTピン）
  function renderFingerprintAs608(part, isSelected) {
    const G = GRID;
    const flip = !!part.flipX;
    const pinCount = Number(part.props?.pinCount || 4);
    const totalW = (pinCount - 1) * G;
    const cx = totalW / 2;

    const allPins = [
      { gx: 0, name: "3.3V", color: "#dc2626", wire: "#dc2626" },
      { gx: 1, name: "TX",   color: "#ca8a04", wire: "#eab308" },
      { gx: 2, name: "RX",   color: "#2563eb", wire: "#94a3b8" },
      { gx: 3, name: "GND",  color: "#1e293b", wire: "#1e293b" },
      { gx: 4, name: "TCH",  color: "#0891b2", wire: "#06b6d4" },
      { gx: 5, name: "VT",   color: "#16a34a", wire: "#22c55e" }
    ].slice(0, pinCount);

    let pinsSvg = "";
    for (const p of allPins) {
      const px = p.gx * G;
      pinsSvg += `
        <line x1="${px}" y1="0" x2="${px}" y2="-28" stroke="${p.wire}" stroke-width="3.2" stroke-linecap="round" />
        <circle cx="${px}" cy="0" r="3.8" fill="${p.color}" stroke="#ffffff" stroke-width="1.2" />
        <g ${unflipAttr(px, -15, flip)}>
          <rect x="${px - 9.2}" y="-21" width="18.4" height="12" rx="2.5" fill="${p.color}" stroke="#ffffff" stroke-width="0.6" />
          <text x="${px}" y="-15" text-anchor="middle" dominant-baseline="central" font-size="6.8" font-weight="800" fill="#ffffff">${p.name}</text>
        </g>
      `;
    }

    const boxW = Math.max(88, totalW + 26);
    const boxH = 104;
    const bx = cx - boxW / 2;
    const by = -132;

    const selRing = isSelected
      ? `<rect x="${bx - 6}" y="${by - 6}" width="${boxW + 12}" height="${boxH + 44}" rx="10" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- リード線＆ピン -->
      ${pinsSvg}
      <!-- AS608 黒い光学ユニット本体 -->
      <rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
      <!-- 光学ガラス窓（緑バックライト） -->
      <rect x="${cx - 26}" y="${by + 12}" width="52" height="56" rx="10" fill="#064e3b" stroke="#34d399" stroke-width="2" />
      <rect x="${cx - 21}" y="${by + 17}" width="42" height="46" rx="7" fill="#10b981" fill-opacity="0.28" />
      <!-- 指紋アイコン（同心アーチ） -->
      <g fill="none" stroke="#6ee7b7" stroke-width="1.6" stroke-linecap="round">
        <path d="M ${cx - 12},${by + 44} C ${cx - 12},${by + 27} ${cx + 12},${by + 27} ${cx + 12},${by + 44}" />
        <path d="M ${cx - 8},${by + 48} C ${cx - 8},${by + 33} ${cx + 8},${by + 33} ${cx + 8},${by + 48}" />
        <path d="M ${cx - 4},${by + 51} C ${cx - 4},${by + 39} ${cx + 4},${by + 39} ${cx + 4},${by + 51}" />
        <line x1="${cx}" y1="${by + 43}" x2="${cx}" y2="${by + 53}" />
      </g>
      <!-- ラベル -->
      <g ${unflipAttr(cx, by + 84, flip)}>
        <text x="${cx}" y="${by + 82}" text-anchor="middle" font-size="10" font-weight="800" fill="#ffffff">AS608 指紋</text>
        <text x="${cx}" y="${by + 95}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#94a3b8">UART / 3.3V</text>
      </g>
    `;
  }

  return {
    GRID,
    PICO_PINS,
    LED_COLORS,
    BUTTON_COLORS,
    ANNOTATION_COLORS,
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
    renderSevenSeg,
    renderRfidRc522,
    renderServoSg90,
    renderDht11,
    renderFingerprintAs608
  };
})();
