window.PARTS_CATALOG = (() => {
  const GRID = 20; // 2.54mm ピッチ = 20px

  // 座標回転（SVG の rotate(rot) と一致する時計回り回転）
  function rotateGrid(gx, gy, rot) {
    const r = ((rot % 360) + 360) % 360;
    if (r === 90) return { gx: -gy, gy: gx };
    if (r === 180) return { gx: -gx, gy: -gy };
    if (r === 270) return { gx: gy, gy: -gx };
    return { gx, gy };
  }

  // Raspberry Pi Pico / Pico 2 W（USB左向き基準、全40ピン）
  // 下段: Pin 1..20 (gx=0..19, gy=7) / 上段: Pin 40..21 (gx=0..19, gy=0)
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

  // 抵抗値＆カラーコード（4本帯）
  const RESISTOR_VALUES = {
    "220": { label: "220Ω", bands: ["#dc2626", "#dc2626", "#92400e", "#eab308"] },
    "330": { label: "330Ω", bands: ["#f97316", "#f97316", "#92400e", "#eab308"] },
    "1k":  { label: "1kΩ",  bands: ["#92400e", "#111827", "#dc2626", "#eab308"] },
    "10k": { label: "10kΩ", bands: ["#92400e", "#111827", "#f97316", "#eab308"] }
  };

  // ジャンパ線の色リスト
  const WIRE_COLORS = [
    { id: "#ef4444", name: "赤" },
    { id: "#1e293b", name: "黒" },
    { id: "#2563eb", name: "青" },
    { id: "#16a34a", name: "緑" },
    { id: "#f97316", name: "橙" },
    { id: "#eab308", name: "黄" },
    { id: "#9333ea", name: "紫" },
    { id: "#f8fafc", name: "白" }
  ];

  // ブレッドボード（30列・電源レール付き）の導通グループ定義
  function getBreadboardGroups(part) {
    const groups = [];
    // 上電源レール (gy=-3: 青−, gy=-2: 赤+) / 下電源レール (gy=13: 赤+, gy=14: 青−)
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
        const r = rotateGrid(lx, rc.gy, part.rot);
        return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx, ly: rc.gy };
      });
      groups.push({ id: `${part.id}:${rc.id}`, kind: rc.kind, isRail: true, cells, lx1: 1, ly1: rc.gy, lx2: 29, ly2: rc.gy });
    }

    // 中央エリア（30列 × 上段a-e / 下段f-j）
    for (let col = 0; col < 30; col++) {
      // 上段 a..e (gy = 0..4)
      const topCells = [0, 1, 2, 3, 4].map(ly => {
        const r = rotateGrid(col, ly, part.rot);
        return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx: col, ly };
      });
      groups.push({ id: `${part.id}:c${col}:top`, kind: "strip", isRail: false, cells: topCells, lx1: col, ly1: 0, lx2: col, ly2: 4 });

      // 下段 f..j (gy = 7..11)
      const botCells = [7, 8, 9, 10, 11].map(ly => {
        const r = rotateGrid(col, ly, part.rot);
        return { gx: part.gx + r.gx, gy: part.gy + r.gy, lx: col, ly };
      });
      groups.push({ id: `${part.id}:c${col}:bot`, kind: "strip", isRail: false, cells: botCells, lx1: col, ly1: 7, lx2: col, ly2: 11 });
    }
    return groups;
  }

  // 全部品のピン座標（ワールドグリッド座標）を取得
  function getPartPinsWorld(part) {
    if (part.type === "pico") {
      return PICO_PINS.map(p => {
        const r = rotateGrid(p.gx, p.gy, part.rot);
        return { ...p, worldGx: part.gx + r.gx, worldGy: part.gy + r.gy };
      });
    }
    if (part.type === "led") {
      const locals = [
        { name: "+ (アノード)", gx: 0, gy: 0 },
        { name: "- (カソード)", gx: 1, gy: 0 }
      ];
      return locals.map(p => {
        const r = rotateGrid(p.gx, p.gy, part.rot);
        return { ...p, worldGx: part.gx + r.gx, worldGy: part.gy + r.gy };
      });
    }
    if (part.type === "resistor") {
      const span = part.props?.span || 4;
      const locals = [
        { name: "端子1", gx: 0, gy: 0 },
        { name: "端子2", gx: span, gy: 0 }
      ];
      return locals.map(p => {
        const r = rotateGrid(p.gx, p.gy, part.rot);
        return { ...p, worldGx: part.gx + r.gx, worldGy: part.gy + r.gy };
      });
    }
    return [];
  }

  // SVG描画：ブレッドボード
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
    // 電源レール穴
    for (const ry of [-3, -2, 13, 14]) {
      for (const rx of railXs) {
        holes += `<rect x="${rx * G - 3.5}" y="${ry * G - 3.5}" width="7" height="7" rx="1.2" fill="#334155" />`;
      }
    }
    // 中央穴 (30列 × a..e, f..j)
    for (let col = 0; col < 30; col++) {
      for (const ly of [0, 1, 2, 3, 4, 7, 8, 9, 10, 11]) {
        holes += `<rect x="${col * G - 3.5}" y="${ly * G - 3.5}" width="7" height="7" rx="1.2" fill="#334155" />`;
      }
    }

    // 列番号 (1, 5, 10, 15, 20, 25, 30 と全行小さく)
    let colNums = "";
    for (let col = 0; col < 30; col++) {
      const num = col + 1;
      const bold = (num === 1 || num % 5 === 0) ? "700" : "400";
      const fill = (num === 1 || num % 5 === 0) ? "#334155" : "#94a3b8";
      colNums += `<text x="${col * G}" y="${-0.85 * G}" text-anchor="middle" font-size="9" font-weight="${bold}" fill="${fill}">${num}</text>`;
      colNums += `<text x="${col * G}" y="${12.25 * G}" text-anchor="middle" font-size="9" font-weight="${bold}" fill="${fill}">${num}</text>`;
    }

    // 行記号 (a..j)
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
      <!-- 中央の溝 -->
      <rect x="${x0 + 4}" y="${5.1 * G}" width="${width - 8}" height="${0.8 * G}" rx="3" fill="#e2e8f0" />
      <!-- 電源レールライン -->
      <line x1="${0.3 * G}" y1="${-3.55 * G}" x2="${29.7 * G}" y2="${-3.55 * G}" stroke="#2563eb" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${-1.45 * G}" x2="${29.7 * G}" y2="${-1.45 * G}" stroke="#ef4444" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${12.45 * G}" x2="${29.7 * G}" y2="${12.45 * G}" stroke="#ef4444" stroke-width="2" />
      <line x1="${0.3 * G}" y1="${14.55 * G}" x2="${29.7 * G}" y2="${14.55 * G}" stroke="#2563eb" stroke-width="2" />
      <!-- 電源レール記号 -->
      <text x="${-0.45 * G}" y="${-3 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#2563eb">−</text>
      <text x="${-0.45 * G}" y="${-2 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#ef4444">＋</text>
      <text x="${-0.45 * G}" y="${13 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#ef4444">＋</text>
      <text x="${-0.45 * G}" y="${14 * G + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#2563eb">−</text>
      ${colNums}
      ${rowTexts}
      ${holes}
    `;
  }

  // SVG描画：Raspberry Pi Pico / Pico 2 W
  function renderPico(part, isSelected) {
    const G = GRID;
    const x0 = -0.6 * G;
    const y0 = -0.6 * G;
    const w = 20.2 * G;
    const h = 8.2 * G;
    const modelName = part.props?.model || "Raspberry Pi Pico";
    const stroke = isSelected ? "#facc15" : "#065f46";
    const strokeW = isSelected ? 3 : 1.5;

    let pinsSvg = "";
    for (const p of PICO_PINS) {
      const cx = p.gx * G;
      const cy = p.gy * G;
      // ランド（金色）＋ピンヘッダ（黒＋銀）
      pinsSvg += `
        <circle cx="${cx}" cy="${cy}" r="6.5" fill="#eab308" stroke="#ca8a04" stroke-width="1" />
        <rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" rx="1" fill="#334155" />
        <circle cx="${cx}" cy="${cy}" r="1.5" fill="#e2e8f0" />
      `;
    }

    return `
      <!-- PCB基板本体 -->
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5" fill="#0f766e" stroke="${stroke}" stroke-width="${strokeW}" />
      <!-- USB端子（左側） -->
      <rect x="${x0 - 8}" y="${2.4 * G}" width="26" height="${2.2 * G}" rx="3" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5" />
      <text x="${x0 + 5}" y="${3.65 * G}" text-anchor="middle" font-size="8" font-weight="700" fill="#334155">USB</text>
      <!-- BOOTSELボタン -->
      <rect x="${2.8 * G}" y="${2.5 * G}" width="26" height="18" rx="3" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2" />
      <text x="${2.8 * G + 13}" y="${2.5 * G + 28}" text-anchor="middle" font-size="7.5" fill="#ccfbf1">BOOTSEL</text>
      <!-- オンボードLED -->
      <rect x="${2.0 * G}" y="${1.1 * G}" width="10" height="7" rx="1.5" fill="#86efac" stroke="#15803d" stroke-width="0.8" />
      <!-- RP2040 / RP2350 チップ -->
      <rect x="${8.2 * G}" y="${2.2 * G}" width="${2.6 * G}" height="${2.6 * G}" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.2" />
      <text x="${9.5 * G}" y="${3.65 * G}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#e2e8f0">RP2040</text>
      <!-- 基板ロゴ文字 -->
      <text x="${14.8 * G}" y="${3.4 * G}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">${modelName}</text>
      <text x="${14.8 * G}" y="${4.3 * G}" text-anchor="middle" font-size="8.5" fill="#99f6e4">Pin 1 (左下) 〜 Pin 40 (左上)</text>
      <!-- Pin 1 目印三角 -->
      <polygon points="${0},${6.1 * G} ${-4},${6.5 * G} ${4},${6.5 * G}" fill="#fde047" />
      ${pinsSvg}
    `;
  }

  // Picoのピンラベル（別レイヤーに最前面描画：回転しても読みやすい配置）
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
      // ピンから外側への方向ベクトル（ローカルでは top=-Y, bottom=+Y）
      const localDir = p.side === "top" ? { gx: 0, gy: -1 } : { gx: 0, gy: 1 };
      const dir = rotateGrid(localDir.gx, localDir.gy, part.rot);
      const px = p.worldGx * G;
      const py = p.worldGy * G;

      if (mode === "used") {
        // 使用中ピンを大きく強調表示（吹き出し型ピルラベル）
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
        // 全ピン表示（重ならない縦向き／横向きコンパクトタグ）
        const isVerticalPinRow = dir.gy !== 0; // 通常横向き配置のPico
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

  // SVG描画：LED（長い脚＋アノード／短い脚−カソードを強調）
  function renderLed(part, isSelected) {
    const G = GRID;
    const c = LED_COLORS[part.props?.color || "red"] || LED_COLORS.red;
    const showPolarity = part.props?.showPolarity !== false;
    const selRing = isSelected
      ? `<rect x="-14" y="-48" width="${G + 28}" height="58" rx="8" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- 長い脚（アノード＋：左 x=0、曲がりを入れて長さを強調） -->
      <path d="M 0,0 L 0,-12 L 4,-18 L 4,-25" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <!-- 短い脚（カソード−：右 x=20、直線） -->
      <path d="M ${G},0 L ${G},-18 L ${G - 4},-18 L ${G - 4},-25" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <!-- LEDドーム本体（右側をフラットカットしてカソード側を明示） -->
      <path d="M -2,-24 L -2,-35 A 12,12 0 0 1 20,-35 L 20,-24 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="1.6" />
      <!-- リム（下縁） -->
      <rect x="-4" y="-26" width="25" height="4.5" rx="1.5" fill="${c.body}" stroke="${c.dark}" stroke-width="1.2" />
      <!-- 光沢ハイライト -->
      <ellipse cx="5" cy="-35" rx="3" ry="5" fill="${c.glow}" opacity="0.85" />
      <!-- 端子接続点 -->
      <circle cx="0" cy="0" r="3.5" fill="#dc2626" stroke="#ffffff" stroke-width="1" />
      <circle cx="${G}" cy="0" r="3.5" fill="#1e293b" stroke="#ffffff" stroke-width="1" />
      ${showPolarity ? `
        <g>
          <circle cx="-10" cy="-12" r="7.5" fill="#dc2626" />
          <text x="-10" y="-8.5" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">+</text>
          <text x="-10" y="-23" text-anchor="middle" font-size="8.5" font-weight="700" fill="#b91c1c">長</text>

          <circle cx="${G + 10}" cy="-12" r="7.5" fill="#1e293b" />
          <text x="${G + 10}" y="-8.5" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">−</text>
          <text x="${G + 10}" y="-23" text-anchor="middle" font-size="8.5" font-weight="700" fill="#334155">短</text>
        </g>
      ` : ""}
    `;
  }

  // SVG描画：抵抗（カラーコード4本帯＋数値ラベル）
  function renderResistor(part, isSelected) {
    const G = GRID;
    const span = part.props?.span || 4;
    const totalW = span * G;
    const valKey = part.props?.value || "220";
    const info = RESISTOR_VALUES[valKey] || RESISTOR_VALUES["220"];
    const showLabel = part.props?.showLabel !== false;

    const bodyW = Math.min(44, totalW - 14);
    const bodyX = (totalW - bodyW) / 2;
    const bodyH = 14;
    const bodyY = -bodyH / 2;

    const b0 = bodyX + bodyW * 0.18;
    const b1 = bodyX + bodyW * 0.36;
    const b2 = bodyX + bodyW * 0.54;
    const b3 = bodyX + bodyW * 0.78;

    const selRing = isSelected
      ? `<rect x="-8" y="-24" width="${totalW + 16}" height="38" rx="6" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" />`
      : "";

    return `
      ${selRing}
      <!-- リード線 -->
      <line x1="0" y1="0" x2="${totalW}" y2="0" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />
      <!-- 抵抗本体（ベージュ） -->
      <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="5" fill="#f3d5a5" stroke="#a16207" stroke-width="1.4" />
      <!-- カラーコード帯 -->
      <rect x="${b0}" y="${bodyY + 0.7}" width="4" height="${bodyH - 1.4}" fill="${info.bands[0]}" />
      <rect x="${b1}" y="${bodyY + 0.7}" width="4" height="${bodyH - 1.4}" fill="${info.bands[1]}" />
      <rect x="${b2}" y="${bodyY + 0.7}" width="4" height="${bodyH - 1.4}" fill="${info.bands[2]}" />
      <rect x="${b3}" y="${bodyY + 0.7}" width="3.5" height="${bodyH - 1.4}" fill="${info.bands[3]}" />
      <!-- 両端ピン -->
      <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      <circle cx="${totalW}" cy="0" r="3.5" fill="#475569" stroke="#ffffff" stroke-width="1" />
      ${showLabel ? `
        <rect x="${totalW / 2 - 20}" y="-25" width="40" height="15" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
        <text x="${totalW / 2}" y="-14" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b">${info.label}</text>
      ` : ""}
    `;
  }

  return {
    GRID,
    PICO_PINS,
    LED_COLORS,
    RESISTOR_VALUES,
    WIRE_COLORS,
    rotateGrid,
    getBreadboardGroups,
    getPartPinsWorld,
    renderBreadboard,
    renderPico,
    renderPicoLabels,
    renderLed,
    renderResistor
  };
})();
