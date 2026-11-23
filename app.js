(() => {
  const {
    GRID, LED_COLORS, BUTTON_COLORS, WIRE_COLORS, MATRIX_PATTERNS, SEVEN_SEG_DIGITS,
    parseResistance, getBreadboardGroups, getPartPinsWorld,
    renderBreadboard, renderPico, renderPicoLabels, renderLed, renderResistor,
    renderTactSwitch, renderToggleSwitch, renderPotentiometer, renderBuzzer,
    renderMatrix1088BS, renderMatrixMax7219, renderSevenSeg
  } = window.PARTS_CATALOG;

  const GND_COLOR = "#1e293b"; // GND共通カラー（黒）

  // アプリケーション状態
  let state = {
    parts: [],
    wires: [],
    settings: {
      picoPinMode: "used",      // 'used' | 'all' | 'none'
      showContinuity: true,
      transparentPico: false,   // Pico半透明モード
      lockBoards: true          // ブレッドボード固定ON
    }
  };

  let history = [];
  let selected = null;
  let mode = "select";
  let wireDraft = null;
  let lastWireColor = "#ef4444";
  let lastConnectivity = {
    activeGroups: [],
    picoOverlayGroups: [],
    usedPicoPinKeys: new Set(),
    mountedPicoIds: new Set(),
    gndGridKeys: new Set()
  };

  let view = { x: 80, y: 40, scale: 0.9 };
  let dragState = null;

  // DOM参照
  const svg = document.getElementById("canvas-svg");
  const viewport = document.getElementById("viewport");
  const layerBoards = document.getElementById("layer-boards");
  const layerContinuity = document.getElementById("layer-continuity");
  const layerParts = document.getElementById("layer-parts");
  const layerContinuityOver = document.getElementById("layer-continuity-over");
  const layerWires = document.getElementById("layer-wires");
  const layerLabels = document.getElementById("layer-labels");
  const layerUI = document.getElementById("layer-ui");
  const propContent = document.getElementById("property-content");
  const modeBanner = document.getElementById("mode-banner");
  const zoomLabel = document.getElementById("zoom-label");

  const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

  function saveHistory() {
    history.push(JSON.stringify(state));
    if (history.length > 50) history.shift();
  }

  function undo() {
    if (history.length === 0) return;
    state = JSON.parse(history.pop());
    selected = null;
    syncToolbarFromState();
    render();
  }

  function clientToWorld(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = viewport.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const w = pt.matrixTransform(ctm.inverse());
    return { x: w.x, y: w.y };
  }

  function worldToGrid(x, y) {
    return { gx: Math.round(x / GRID), gy: Math.round(y / GRID) };
  }

  // キャンバス全体が画面中央に収まるよう自動調整
  function fitToView() {
    const exportRoot = document.getElementById("export-root");
    const bbox = exportRoot.getBBox();
    const rect = svg.getBoundingClientRect();
    if (!bbox.width || !bbox.height || !rect.width || !rect.height) {
      view = { x: 100, y: 40, scale: 0.9 };
      renderCanvas();
      return;
    }
    const pad = 60;
    const scaleX = (rect.width - pad * 2) / bbox.width;
    const scaleY = (rect.height - pad * 2) / bbox.height;
    const scale = Math.min(1.1, Math.max(0.45, Math.min(scaleX, scaleY)));
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    view.scale = scale;
    view.x = rect.width / 2 - cx * scale;
    view.y = rect.height / 2 - cy * scale;
    renderCanvas();
  }

  // デフォルト初期表示：縦置きブレッドボード＋縦置きPico直刺し（1〜20行目、h列・c列）
  function loadInitialBoard(recordHistory = true) {
    if (recordHistory) saveHistory();
    state = {
      parts: [
        { id: "bb_1", type: "breadboard", gx: 16, gy: 5, rot: 90, flipX: false, props: {} },
        { id: "pico_1", type: "pico", gx: 14, gy: 5, rot: 90, flipX: false, props: { model: "Raspberry Pi Pico" } }
      ],
      wires: [],
      settings: {
        picoPinMode: "used",
        showContinuity: true,
        transparentPico: false,
        lockBoards: true
      }
    };
    selected = null;
    syncToolbarFromState();
    render();
    fitToView();
  }

  // サンプル：Lチカ回路（既存のまま）
  function loadSampleCircuit() {
    saveHistory();
    state = {
      parts: [
        { id: "bb_1", type: "breadboard", gx: 2, gy: 13, rot: 0, flipX: false, props: {} },
        { id: "pico_1", type: "pico", gx: 3, gy: 1, rot: 0, flipX: false, props: { model: "Raspberry Pi Pico" } },
        { id: "res_1", type: "resistor", gx: 14, gy: 15, rot: 0, flipX: false, props: { value: "220", span: 4, showLabel: true } },
        { id: "led_1", type: "led", gx: 18, gy: 16, rot: 0, flipX: false, props: { color: "red", span: 1, showPolarity: true } }
      ],
      wires: [
        {
          id: "w_1",
          color: "#ef4444",
          points: [
            { gx: 22, gy: 8 },
            { gx: 22, gy: 11 },
            { gx: 14, gy: 11 },
            { gx: 14, gy: 13 }
          ]
        },
        {
          id: "w_2",
          color: GND_COLOR,
          points: [
            { gx: 19, gy: 13 },
            { gx: 19, gy: 10 },
            { gx: 20, gy: 10 },
            { gx: 20, gy: 8 }
          ]
        }
      ],
      settings: {
        picoPinMode: "used",
        showContinuity: true,
        transparentPico: false,
        lockBoards: true
      }
    };
    selected = null;
    syncToolbarFromState();
    render();
    fitToView();
  }

  function clearCircuit() {
    saveHistory();
    state.parts = [];
    state.wires = [];
    selected = null;
    render();
  }

  // 導通・使用中Picoピン・直刺し判定・GNDネット計算
  function computeConnectivity() {
    const nonPicoPinPoints = new Map();
    const picoPinPoints = new Set();
    const picoPinToPartId = new Map();
    const allConnectionPoints = new Set();
    const directGndSeeds = new Set();

    // 1. 部品ピン収集
    for (const part of state.parts) {
      if (part.type === "breadboard") continue;
      const pins = getPartPinsWorld(part);
      for (const p of pins) {
        const key = `${p.worldGx},${p.worldGy}`;
        allConnectionPoints.add(key);
        if (p.kind === "gnd") directGndSeeds.add(key);
        if (part.type === "pico") {
          picoPinPoints.add(key);
          picoPinToPartId.set(key, part.id);
        } else {
          nonPicoPinPoints.set(key, (nonPicoPinPoints.get(key) || 0) + 1);
        }
      }
    }

    // 2. ジャンパ線両端収集
    const adj = new Map();
    const addEdge = (k1, k2) => {
      if (!adj.has(k1)) adj.set(k1, []);
      if (!adj.has(k2)) adj.set(k2, []);
      adj.get(k1).push(k2);
      adj.get(k2).push(k1);
    };

    for (const wire of state.wires) {
      if (wire.points.length < 2) continue;
      const p0 = wire.points[0];
      const p1 = wire.points[wire.points.length - 1];
      const k0 = `${p0.gx},${p0.gy}`;
      const k1 = `${p1.gx},${p1.gy}`;
      allConnectionPoints.add(k0);
      allConnectionPoints.add(k1);
      nonPicoPinPoints.set(k0, (nonPicoPinPoints.get(k0) || 0) + 1);
      nonPicoPinPoints.set(k1, (nonPicoPinPoints.get(k1) || 0) + 1);
      addEdge(k0, k1);
    }

    // 3. ブレッドボード導通グループ＆直刺し判定
    const activeGroups = [];
    const picoOverlayGroups = []; // Picoと外部配線が繋がっている列（Picoの上にも薄く表示）
    const usedPicoPinKeys = new Set();
    const mountedPicoIds = new Set();
    const allBoardGroups = [];

    for (const key of picoPinPoints) {
      if (nonPicoPinPoints.has(key)) usedPicoPinKeys.add(key);
    }

    for (const part of state.parts) {
      if (part.type !== "breadboard") continue;
      const groups = getBreadboardGroups(part);
      for (const grp of groups) {
        allBoardGroups.push(grp);
        let hasNonPico = false;
        const picoKeysInGroup = [];

        for (const c of grp.cells) {
          const key = `${c.gx},${c.gy}`;
          if (grp.kind === "minus") directGndSeeds.add(key);
          if (nonPicoPinPoints.has(key)) hasNonPico = true;
          if (picoPinPoints.has(key)) {
            picoKeysInGroup.push(key);
            mountedPicoIds.add(picoPinToPartId.get(key));
          }
        }

        // Picoだけが刺さっている未使用行は青帯を出さず、線や部品が刺さった行だけすっきりハイライト
        if (hasNonPico) {
          activeGroups.push({ part, grp });
          if (picoKeysInGroup.length > 0) {
            for (const k of picoKeysInGroup) usedPicoPinKeys.add(k);
            picoOverlayGroups.push({ part, grp });
          }
        }
      }
    }

    // 4. GNDネットの伝播
    const cellToGroup = new Map();
    for (const grp of allBoardGroups) {
      for (const c of grp.cells) {
        cellToGroup.set(`${c.gx},${c.gy}`, grp);
      }
    }

    const gndGridKeys = new Set(directGndSeeds);
    const queue = Array.from(directGndSeeds);
    const visitedGroups = new Set();

    while (queue.length > 0) {
      const cur = queue.shift();
      const grp = cellToGroup.get(cur);
      if (grp && !visitedGroups.has(grp.id)) {
        visitedGroups.add(grp.id);
        for (const c of grp.cells) {
          const ck = `${c.gx},${c.gy}`;
          if (!gndGridKeys.has(ck)) {
            gndGridKeys.add(ck);
            queue.push(ck);
          }
        }
      }
      const neighbors = adj.get(cur) || [];
      for (const nxt of neighbors) {
        if (!gndGridKeys.has(nxt)) {
          gndGridKeys.add(nxt);
          queue.push(nxt);
        }
      }
    }

    return { activeGroups, picoOverlayGroups, usedPicoPinKeys, mountedPicoIds, gndGridKeys };
  }

  function isGndGrid(pt) {
    return lastConnectivity.gndGridKeys.has(`${pt.gx},${pt.gy}`);
  }

  function isWireConnectedToGnd(wire) {
    if (!wire || wire.points.length < 2) return false;
    return isGndGrid(wire.points[0]) || isGndGrid(wire.points[wire.points.length - 1]);
  }

  function renderCanvas() {
    viewport.setAttribute("transform", `translate(${view.x}, ${view.y}) scale(${view.scale})`);
    zoomLabel.textContent = `${Math.round(view.scale * 100)}%`;

    lastConnectivity = computeConnectivity();
    const { activeGroups, picoOverlayGroups, usedPicoPinKeys, mountedPicoIds } = lastConnectivity;

    // 1. ブレッドボード
    layerBoards.innerHTML = "";
    for (const part of state.parts) {
      if (part.type !== "breadboard") continue;
      const isSel = selected?.kind === "part" && selected.id === part.id;
      const attrs = {
        class: state.settings.lockBoards ? "" : "selectable",
        "data-part-id": part.id,
        transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})`
      };
      if (state.settings.lockBoards) attrs["pointer-events"] = "none";
      const g = createSvgEl("g", attrs);
      g.innerHTML = renderBreadboard(part, isSel);
      layerBoards.appendChild(g);
    }

    // 2. 導通ハイライト（ボード上）
    layerContinuity.innerHTML = "";
    if (state.settings.showContinuity) {
      for (const { part, grp } of activeGroups) {
        const g = createSvgEl("g", {
          transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})`,
          "pointer-events": "none"
        });
        let fill = "rgba(56, 189, 248, 0.40)";
        let stroke = "rgba(2, 132, 199, 0.75)";
        if (grp.kind === "plus") {
          fill = "rgba(248, 113, 113, 0.28)";
          stroke = "rgba(220, 38, 38, 0.65)";
        } else if (grp.kind === "minus") {
          fill = "rgba(96, 165, 250, 0.28)";
          stroke = "rgba(37, 99, 235, 0.65)";
        }

        const x = Math.min(grp.lx1, grp.lx2) * GRID - 7.5;
        const y = Math.min(grp.ly1, grp.ly2) * GRID - 7.5;
        const w = Math.abs(grp.lx2 - grp.lx1) * GRID + 15;
        const h = Math.abs(grp.ly2 - grp.ly1) * GRID + 15;

        g.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;
        layerContinuity.appendChild(g);
      }
    }

    // 3. Pico・電子部品
    layerParts.innerHTML = "";
    for (const part of state.parts) {
      if (part.type === "breadboard") continue;
      const isSel = selected?.kind === "part" && selected.id === part.id;
      const flipScale = (part.flipX && part.type !== "pico") ? " scale(-1, 1)" : "";
      const g = createSvgEl("g", {
        class: "selectable",
        "data-part-id": part.id,
        transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})${flipScale}`
      });

      if (part.type === "pico") g.innerHTML = renderPico(part, isSel, state.settings.transparentPico);
      else if (part.type === "led") g.innerHTML = renderLed(part, isSel);
      else if (part.type === "resistor") g.innerHTML = renderResistor(part, isSel);
      else if (part.type === "tact_switch") g.innerHTML = renderTactSwitch(part, isSel);
      else if (part.type === "toggle_switch") g.innerHTML = renderToggleSwitch(part, isSel);
      else if (part.type === "potentiometer") g.innerHTML = renderPotentiometer(part, isSel);
      else if (part.type === "buzzer") g.innerHTML = renderBuzzer(part, isSel);
      else if (part.type === "matrix_1088bs") g.innerHTML = renderMatrix1088BS(part, isSel);
      else if (part.type === "matrix_max7219") g.innerHTML = renderMatrixMax7219(part, isSel);
      else if (part.type === "seven_seg") g.innerHTML = renderSevenSeg(part, isSel);
      layerParts.appendChild(g);
    }

    // 3.5. Pico直刺し行の導通透かしオーバーレイ（下の横5穴とのつながりをPico上にも可視化）
    layerContinuityOver.innerHTML = "";
    if (state.settings.showContinuity) {
      for (const { part, grp } of picoOverlayGroups) {
        const g = createSvgEl("g", {
          transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})`,
          "pointer-events": "none"
        });
        const x = Math.min(grp.lx1, grp.lx2) * GRID - 7.5;
        const y = Math.min(grp.ly1, grp.ly2) * GRID - 7.5;
        const w = Math.abs(grp.lx2 - grp.lx1) * GRID + 15;
        const h = Math.abs(grp.ly2 - grp.ly1) * GRID + 15;
        g.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="rgba(56, 189, 248, 0.22)" stroke="rgba(14, 165, 233, 0.85)" stroke-width="1.5" stroke-dasharray="3 2" />`;
        layerContinuityOver.appendChild(g);
      }
    }

    // 4. ジャンパ線
    layerWires.innerHTML = "";
    for (const wire of state.wires) {
      const isSel = selected?.kind === "wire" && selected.id === wire.id;
      const pts = wire.points.map(p => `${p.gx * GRID},${p.gy * GRID}`).join(" ");
      const g = createSvgEl("g", { class: "selectable", "data-wire-id": wire.id });
      const outlineColor = isSel ? "#2563eb" : (wire.color === "#f8fafc" ? "#64748b" : "#ffffff");
      const outlineW = isSel ? 9.5 : 7;

      g.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="transparent" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="${pts}" fill="none" stroke="${outlineColor}" stroke-width="${outlineW}" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="${pts}" fill="none" stroke="${wire.color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${wire.points[0].gx * GRID}" cy="${wire.points[0].gy * GRID}" r="4.5" fill="${wire.color}" stroke="#1e293b" stroke-width="1.2" />
        <circle cx="${wire.points[wire.points.length - 1].gx * GRID}" cy="${wire.points[wire.points.length - 1].gy * GRID}" r="4.5" fill="${wire.color}" stroke="#1e293b" stroke-width="1.2" />
      `;
      layerWires.appendChild(g);
    }

    // 5. Picoピンラベル（直刺し時はブレッドボード外側へ自動退避）
    layerLabels.innerHTML = "";
    for (const part of state.parts) {
      if (part.type !== "pico") continue;
      const isMounted = mountedPicoIds.has(part.id);
      const g = createSvgEl("g", { "pointer-events": "none" });
      g.innerHTML = renderPicoLabels(part, state.settings.picoPinMode, usedPicoPinKeys, isMounted);
      layerLabels.appendChild(g);
    }

    // 6. UIオーバーレイ
    layerUI.innerHTML = "";
    if (selected?.kind === "wire") {
      const wire = state.wires.find(w => w.id === selected.id);
      if (wire) renderWireHandles(wire);
    }

    if (mode === "wire" && wireDraft) {
      const willBeGnd = isGndGrid(wireDraft.start) || isGndGrid(wireDraft.hover);
      const previewColor = willBeGnd ? GND_COLOR : lastWireColor;
      const pts = makeOrthogonalPoints(wireDraft.start, wireDraft.hover);
      const ptsStr = pts.map(p => `${p.gx * GRID},${p.gy * GRID}`).join(" ");
      layerUI.innerHTML += `
        <polyline points="${ptsStr}" fill="none" stroke="${previewColor}" stroke-width="4.5" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />
        <circle cx="${wireDraft.start.gx * GRID}" cy="${wireDraft.start.gy * GRID}" r="5" fill="${previewColor}" pointer-events="none" />
        <circle cx="${wireDraft.hover.gx * GRID}" cy="${wireDraft.hover.gy * GRID}" r="5" fill="${previewColor}" opacity="0.7" pointer-events="none" />
      `;
    }
  }

  function render() {
    renderCanvas();
    renderPropertyPanel();
  }

  function renderWireHandles(wire) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      const a = wire.points[i];
      const b = wire.points[i + 1];
      const mx = ((a.gx + b.gx) / 2) * GRID;
      const my = ((a.gy + b.gy) / 2) * GRID;
      const mid = createSvgEl("g", {
        class: "wire-mid-handle",
        "data-wire-id": wire.id,
        "data-seg-index": i
      });
      mid.innerHTML = `
        <circle cx="${mx}" cy="${my}" r="6.5" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5" />
        <text x="${mx}" y="${my + 3.5}" text-anchor="middle" font-size="11" font-weight="800" fill="#2563eb" pointer-events="none">+</text>
      `;
      layerUI.appendChild(mid);
    }

    wire.points.forEach((p, idx) => {
      const isEnd = idx === 0 || idx === wire.points.length - 1;
      const c = createSvgEl("circle", {
        class: "wire-handle",
        cx: p.gx * GRID,
        cy: p.gy * GRID,
        r: isEnd ? 6.5 : 5.5,
        fill: isEnd ? "#2563eb" : "#ffffff",
        stroke: "#2563eb",
        "stroke-width": 2,
        "data-wire-id": wire.id,
        "data-pt-index": idx
      });
      layerUI.appendChild(c);
    });
  }

  function makeOrthogonalPoints(a, b) {
    if (a.gx === b.gx || a.gy === b.gy) {
      return [{ gx: a.gx, gy: a.gy }, { gx: b.gx, gy: b.gy }];
    }
    return [{ gx: a.gx, gy: a.gy }, { gx: b.gx, gy: a.gy }, { gx: b.gx, gy: b.gy }];
  }

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // 右プロパティパネル
  function renderPropertyPanel() {
    if (!selected) {
      propContent.innerHTML = `
        <p class="empty-note">部品やジャンパ線をクリックすると、色・数値・脚幅・向き・反転を変更できます。</p>
        <div class="prop-row" style="margin-top:14px;">
          <label>新規配線の基本色（※GND接続時は自動で黒）</label>
          <div class="color-swatches">
            ${WIRE_COLORS.map(c => `
              <div class="swatch ${lastWireColor === c.id ? "active" : ""}" style="background:${c.id}" title="${c.name}" data-default-wire-color="${c.id}"></div>
            `).join("")}
          </div>
        </div>
      `;
      propContent.querySelectorAll("[data-default-wire-color]").forEach(el => {
        el.addEventListener("click", () => {
          lastWireColor = el.dataset.defaultWireColor;
          renderPropertyPanel();
        });
      });
      return;
    }

    if (selected.kind === "part") {
      const part = state.parts.find(p => p.id === selected.id);
      if (!part) return;

      const names = {
        pico: "Raspberry Pi Pico",
        breadboard: "ブレッドボード",
        led: "LED",
        resistor: "抵抗",
        tact_switch: "タクトスイッチ (4本脚)",
        toggle_switch: "トグルスイッチ (3端子)",
        potentiometer: "可変抵抗 (B5K)",
        buzzer: "ブザー（無極性）",
        matrix_1088bs: "8×8マトリクス (1088BS)",
        matrix_max7219: "MAX7219 SPIモジュール",
        seven_seg: "7セグLED (AE-7SEG)"
      };

      const canFlip = part.type !== "pico" && part.type !== "breadboard";

      let extra = "";
      if (part.type === "pico") {
        extra += `
          <div class="prop-row">
            <label>基板表記</label>
            <select id="prop-pico-model">
              <option value="Raspberry Pi Pico" ${part.props.model === "Raspberry Pi Pico" ? "selected" : ""}>Raspberry Pi Pico</option>
              <option value="Raspberry Pi Pico 2 W" ${part.props.model === "Raspberry Pi Pico 2 W" ? "selected" : ""}>Raspberry Pi Pico 2 W</option>
            </select>
          </div>
          <p class="empty-note">上部バーの「👁 Pico透過」をONにすると、Picoの下のブレッドボード穴や配線が透けて見えます。</p>
        `;
      } else if (part.type === "led") {
        const span = part.props.span || 1;
        extra += `
          <div class="prop-row">
            <label>LEDの色</label>
            <div class="color-swatches">
              ${Object.entries(LED_COLORS).map(([k, v]) => `
                <div class="swatch ${part.props.color === k ? "active" : ""}" style="background:${v.body}" title="${v.name}" data-led-color="${k}"></div>
              `).join("")}
            </div>
          </div>
          <div class="prop-row">
            <label>脚の間隔: <span id="led-span-val">${span}</span> マス（溝またぎは3マス）</label>
            <input type="range" id="prop-led-span" min="1" max="5" value="${span}" />
            <div class="preset-row">
              <button class="btn btn-sm" data-led-span-preset="1">通常 (1)</button>
              <button class="btn btn-sm" data-led-span-preset="2">広め (2)</button>
              <button class="btn btn-sm" data-led-span-preset="3">溝またぎ (3)</button>
            </div>
          </div>
          <div class="prop-row">
            <label class="toggle-label">
              <input type="checkbox" id="prop-led-pol" ${part.props.showPolarity !== false ? "checked" : ""} />
              極性（＋長／−短）を表示
            </label>
          </div>
        `;
      } else if (part.type === "resistor") {
        const parsed = parseResistance(part.props.value ?? "220");
        extra += `
          <div class="prop-row">
            <label>抵抗値（自由入力：例 220, 4.7k, 10k, 1M）</label>
            <input type="text" id="prop-res-input" value="${part.props.value ?? "220"}" placeholder="例: 220, 330, 1k, 10k" />
            <div class="preset-row">
              <button class="btn btn-sm" data-res-preset="220">220Ω</button>
              <button class="btn btn-sm" data-res-preset="330">330Ω</button>
              <button class="btn btn-sm" data-res-preset="1k">1kΩ</button>
              <button class="btn btn-sm" data-res-preset="10k">10kΩ</button>
            </div>
            <p class="empty-note" style="margin-top:4px;">表示: <strong id="res-parsed-preview">${parsed.label}</strong></p>
          </div>
          <div class="prop-row">
            <label>脚の間隔: <span id="res-span-val">${part.props.span || 4}</span> マス</label>
            <input type="range" id="prop-res-span" min="2" max="6" value="${part.props.span || 4}" />
          </div>
          <div class="prop-row">
            <label class="toggle-label">
              <input type="checkbox" id="prop-res-label" ${part.props.showLabel !== false ? "checked" : ""} />
              数値ラベルを表示
            </label>
          </div>
        `;
      } else if (part.type === "tact_switch") {
        extra += `
          <div class="prop-row">
            <label>ボタンの色</label>
            <div class="color-swatches">
              ${Object.entries(BUTTON_COLORS).map(([k, v]) => `
                <div class="swatch ${part.props.btnColor === k ? "active" : ""}" style="background:${v.fill}" title="${v.name}" data-btn-color="${k}"></div>
              `).join("")}
            </div>
          </div>
          <p class="empty-note">縦置きボードの中央溝を跨ぐときは <b>R</b> キーで90°回転してください。</p>
        `;
      } else if (part.type === "toggle_switch") {
        extra += `
          <div class="prop-row">
            <label>レバーの向き</label>
            <div class="prop-btn-row">
              <button class="btn ${(part.props.lever || "left") === "left" ? "active" : ""}" data-lever="left">← 左側ON</button>
              <button class="btn ${part.props.lever === "right" ? "active" : ""}" data-lever="right">右側ON →</button>
            </div>
          </div>
        `;
      } else if (part.type === "potentiometer") {
        extra += `
          <div class="prop-row">
            <label>型番表記</label>
            <input type="text" id="prop-pot-label" value="${part.props.label || "B5K"}" />
          </div>
          <div class="prop-row">
            <label>つまみ位置: ${part.props.knobPos ?? 50}%</label>
            <input type="range" id="prop-pot-knob" min="0" max="100" value="${part.props.knobPos ?? 50}" />
          </div>
          <div class="prop-row">
            <label>端子間隔</label>
            <div class="prop-btn-row">
              <button class="btn ${(part.props.step || 1) === 1 ? "active" : ""}" data-pot-step="1">1マス間隔</button>
              <button class="btn ${part.props.step === 2 ? "active" : ""}" data-pot-step="2">2マス間隔</button>
            </div>
          </div>
        `;
      } else if (part.type === "buzzer") {
        const span = part.props.span || 3;
        extra += `
          <div class="prop-row">
            <label>ブザーの種類</label>
            <select id="prop-buzzer-type">
              <option value="passive" ${part.props.buzzerType !== "active" ? "selected" : ""}>パッシブブザー（音階演奏）</option>
              <option value="active" ${part.props.buzzerType === "active" ? "selected" : ""}>アクティブブザー</option>
            </select>
          </div>
          <div class="prop-row">
            <label>脚の間隔: <span id="buz-span-val">${span}</span> マス</label>
            <input type="range" id="prop-buz-span" min="2" max="4" value="${span}" />
          </div>
        `;
      } else if (part.type === "matrix_1088bs" || part.type === "matrix_max7219") {
        extra += `
          <div class="prop-row">
            <label>ドット点灯表示</label>
            <select id="prop-matrix-pat">
              ${Object.entries(MATRIX_PATTERNS).map(([k, v]) => `
                <option value="${k}" ${part.props.pattern === k ? "selected" : ""}>${v.name}</option>
              `).join("")}
            </select>
          </div>
        `;
      } else if (part.type === "seven_seg") {
        extra += `
          <div class="prop-row">
            <label>表示する数字</label>
            <select id="prop-7seg-digit">
              ${Object.keys(SEVEN_SEG_DIGITS).map(k => `
                <option value="${k}" ${String(part.props.digit ?? "8") === k ? "selected" : ""}>${k === "off" ? "消灯" : k}</option>
              `).join("")}
            </select>
          </div>
          <div class="prop-row">
            <label class="toggle-label">
              <input type="checkbox" id="prop-7seg-dp" ${part.props.dp ? "checked" : ""} />
              小数点（DP）を点灯
            </label>
          </div>
        `;
      }

      propContent.innerHTML = `
        <div class="prop-row"><strong>${names[part.type] || part.type}</strong></div>
        <div class="prop-row">
          <label>向き (${part.rot}°${part.flipX ? "・反転中" : ""})</label>
          <div class="prop-btn-row">
            <button id="prop-rotate" class="btn">↻ 90°回転 (R)</button>
            ${canFlip ? `<button id="prop-flip" class="btn ${part.flipX ? "active" : ""}">⇄ 反転 (F)</button>` : ""}
          </div>
        </div>
        ${extra}
        <button id="prop-delete" class="btn btn-danger">削除 (Delete)</button>
      `;

      document.getElementById("prop-rotate")?.addEventListener("click", rotateSelectedPart);
      document.getElementById("prop-flip")?.addEventListener("click", flipSelectedPart);
      document.getElementById("prop-delete")?.addEventListener("click", deleteSelected);

      document.getElementById("prop-pico-model")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.model = e.target.value;
        render();
      });

      propContent.querySelectorAll("[data-led-color]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          part.props.color = el.dataset.ledColor;
          render();
        });
      });
      document.getElementById("prop-led-span")?.addEventListener("input", (e) => {
        part.props.span = Number(e.target.value);
        const spanVal = document.getElementById("led-span-val");
        if (spanVal) spanVal.textContent = part.props.span;
        renderCanvas();
      });
      propContent.querySelectorAll("[data-led-span-preset]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          part.props.span = Number(el.dataset.ledSpanPreset);
          render();
        });
      });
      document.getElementById("prop-led-pol")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.showPolarity = e.target.checked;
        render();
      });

      const resInput = document.getElementById("prop-res-input");
      if (resInput) {
        resInput.addEventListener("input", (e) => {
          part.props.value = e.target.value;
          const preview = document.getElementById("res-parsed-preview");
          if (preview) preview.textContent = parseResistance(part.props.value).label;
          renderCanvas();
        });
        resInput.addEventListener("change", () => saveHistory());
      }
      propContent.querySelectorAll("[data-res-preset]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          part.props.value = el.dataset.resPreset;
          render();
        });
      });
      document.getElementById("prop-res-span")?.addEventListener("input", (e) => {
        part.props.span = Number(e.target.value);
        const spanVal = document.getElementById("res-span-val");
        if (spanVal) spanVal.textContent = part.props.span;
        renderCanvas();
      });
      document.getElementById("prop-res-label")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.showLabel = e.target.checked;
        render();
      });

      propContent.querySelectorAll("[data-btn-color]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          part.props.btnColor = el.dataset.btnColor;
          render();
        });
      });

      propContent.querySelectorAll("[data-lever]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          part.props.lever = el.dataset.lever;
          render();
        });
      });

      document.getElementById("prop-pot-label")?.addEventListener("input", (e) => {
        part.props.label = e.target.value;
        renderCanvas();
      });
      document.getElementById("prop-pot-knob")?.addEventListener("input", (e) => {
        part.props.knobPos = Number(e.target.value);
        renderCanvas();
      });
      propContent.querySelectorAll("[data-pot-step]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          part.props.step = Number(el.dataset.potStep);
          render();
        });
      });

      document.getElementById("prop-buzzer-type")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.buzzerType = e.target.value;
        render();
      });
      document.getElementById("prop-buz-span")?.addEventListener("input", (e) => {
        part.props.span = Number(e.target.value);
        const spanVal = document.getElementById("buz-span-val");
        if (spanVal) spanVal.textContent = part.props.span;
        renderCanvas();
      });

      document.getElementById("prop-matrix-pat")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.pattern = e.target.value;
        render();
      });

      document.getElementById("prop-7seg-digit")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.digit = e.target.value;
        render();
      });
      document.getElementById("prop-7seg-dp")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.dp = e.target.checked;
        render();
      });

    } else if (selected.kind === "wire") {
      const wire = state.wires.find(w => w.id === selected.id);
      if (!wire) return;
      const gndConnected = isWireConnectedToGnd(wire);

      propContent.innerHTML = `
        <div class="prop-row">
          <strong>ジャンパ線</strong>
          ${gndConnected ? `<div><span class="gnd-badge">GND接続（共通カラー：黒）</span></div>` : ""}
        </div>
        <div class="prop-row">
          <label>線の色</label>
          <div class="color-swatches">
            ${WIRE_COLORS.map(c => `
              <div class="swatch ${wire.color === c.id ? "active" : ""}" style="background:${c.id}" title="${c.name}" data-wire-color="${c.id}"></div>
            `).join("")}
          </div>
        </div>
        <div class="prop-row">
          <p class="empty-note">・青い丸や白丸をドラッグして位置調整<br>・辺の「＋」をクリックで経由点を追加<br>・途中の白丸をダブルクリックで削除</p>
        </div>
        <button id="prop-delete" class="btn btn-danger">削除 (Delete)</button>
      `;

      propContent.querySelectorAll("[data-wire-color]").forEach(el => {
        el.addEventListener("click", () => {
          saveHistory();
          wire.color = el.dataset.wireColor;
          if (!gndConnected) lastWireColor = wire.color;
          render();
        });
      });
      document.getElementById("prop-delete")?.addEventListener("click", deleteSelected);
    }
  }

  function setMode(newMode) {
    mode = newMode;
    wireDraft = null;
    svg.classList.toggle("wire-mode", mode === "wire");
    modeBanner.classList.toggle("hidden", mode !== "wire");
    document.getElementById("btn-mode-select").classList.toggle("active", mode === "select");
    document.getElementById("btn-mode-wire").classList.toggle("active", mode === "wire");
    render();
  }

  function rotateSelectedPart() {
    if (selected?.kind !== "part") return;
    const part = state.parts.find(p => p.id === selected.id);
    if (!part) return;
    saveHistory();
    part.rot = (part.rot + 90) % 360;
    render();
  }

  function flipSelectedPart() {
    if (selected?.kind !== "part") return;
    const part = state.parts.find(p => p.id === selected.id);
    if (!part || part.type === "pico" || part.type === "breadboard") return;
    saveHistory();
    part.flipX = !part.flipX;
    render();
  }

  function deleteSelected() {
    if (!selected) return;
    saveHistory();
    if (selected.kind === "part") {
      state.parts = state.parts.filter(p => p.id !== selected.id);
    } else if (selected.kind === "wire") {
      state.wires = state.wires.filter(w => w.id !== selected.id);
    }
    selected = null;
    render();
  }

  function addPart(type) {
    saveHistory();
    setMode("select");
    const rect = svg.getBoundingClientRect();
    const centerW = clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const g = worldToGrid(centerW.x, centerW.y);

    if (type === "breadboard" && state.settings.lockBoards) {
      state.settings.lockBoards = false;
      syncToolbarFromState();
    }

    // Picoとブレッドボードは縦置き（rot: 90）をデフォルトにする
    const defaults = {
      pico:           { gx: g.gx + 3,  gy: g.gy - 10, rot: 90, props: { model: "Raspberry Pi Pico" } },
      breadboard:     { gx: g.gx + 5,  gy: g.gy - 15, rot: 90, props: {} },
      led:            { gx: g.gx,      gy: g.gy,      rot: 0,  props: { color: "red", span: 1, showPolarity: true } },
      resistor:       { gx: g.gx - 2,  gy: g.gy,      rot: 0,  props: { value: "220", span: 4, showLabel: true } },
      tact_switch:    { gx: g.gx - 1,  gy: g.gy - 1,  rot: 90, props: { btnColor: "black" } },
      toggle_switch:  { gx: g.gx - 1,  gy: g.gy,      rot: 0,  props: { lever: "left" } },
      potentiometer:  { gx: g.gx - 1,  gy: g.gy,      rot: 0,  props: { label: "B5K", knobPos: 50, step: 1 } },
      buzzer:         { gx: g.gx - 1,  gy: g.gy,      rot: 0,  props: { buzzerType: "passive", span: 3 } },
      matrix_1088bs:  { gx: g.gx - 4,  gy: g.gy + 2,  rot: 0,  props: { pattern: "two" } },
      matrix_max7219: { gx: g.gx - 3,  gy: g.gy + 2,  rot: 0,  props: { pattern: "smile" } },
      seven_seg:      { gx: g.gx - 2,  gy: g.gy + 1,  rot: 0,  props: { digit: "8", dp: false } }
    };
    const d = defaults[type];
    const part = { id: uid(type), type, gx: d.gx, gy: d.gy, rot: d.rot, flipX: false, props: { ...d.props } };
    state.parts.push(part);
    selected = { kind: "part", id: part.id };
    render();
  }

  // マウスイベント
  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const wPos = clientToWorld(e.clientX, e.clientY);
    const gPos = worldToGrid(wPos.x, wPos.y);

    if (mode === "wire") {
      if (!wireDraft) {
        wireDraft = { start: gPos, hover: gPos };
      } else {
        if (wireDraft.start.gx !== gPos.gx || wireDraft.start.gy !== gPos.gy) {
          saveHistory();
          const isGnd = isGndGrid(wireDraft.start) || isGndGrid(gPos);
          const newWire = {
            id: uid("w"),
            color: isGnd ? GND_COLOR : lastWireColor,
            points: makeOrthogonalPoints(wireDraft.start, gPos)
          };
          state.wires.push(newWire);
          selected = { kind: "wire", id: newWire.id };
        }
        wireDraft = null;
        setMode("select");
      }
      render();
      return;
    }

    const midEl = e.target.closest(".wire-mid-handle");
    if (midEl) {
      const wire = state.wires.find(w => w.id === midEl.dataset.wireId);
      const segIdx = Number(midEl.dataset.segIndex);
      if (wire) {
        saveHistory();
        const a = wire.points[segIdx];
        const b = wire.points[segIdx + 1];
        const newPt = { gx: Math.round((a.gx + b.gx) / 2), gy: Math.round((a.gy + b.gy) / 2) };
        wire.points.splice(segIdx + 1, 0, newPt);
        dragState = { kind: "wire-pt", wire, ptIndex: segIdx + 1 };
        render();
      }
      return;
    }

    const handleEl = e.target.closest(".wire-handle");
    if (handleEl) {
      const wire = state.wires.find(w => w.id === handleEl.dataset.wireId);
      const ptIndex = Number(handleEl.dataset.ptIndex);
      if (wire) {
        saveHistory();
        dragState = { kind: "wire-pt", wire, ptIndex };
      }
      return;
    }

    const wireEl = e.target.closest("[data-wire-id]");
    if (wireEl) {
      selected = { kind: "wire", id: wireEl.dataset.wireId };
      render();
      return;
    }

    const partEl = e.target.closest("[data-part-id]");
    if (partEl) {
      const part = state.parts.find(p => p.id === partEl.dataset.partId);
      if (part && !(part.type === "breadboard" && state.settings.lockBoards)) {
        selected = { kind: "part", id: part.id };
        dragState = {
          kind: "part",
          part,
          startMouseGrid: gPos,
          origGx: part.gx,
          origGy: part.gy,
          moved: false
        };
        render();
        return;
      }
    }

    selected = null;
    dragState = {
      kind: "pan",
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: view.x,
      origY: view.y
    };
    svg.classList.add("grabbing");
    render();
  });

  window.addEventListener("mousemove", (e) => {
    const wPos = clientToWorld(e.clientX, e.clientY);
    const gPos = worldToGrid(wPos.x, wPos.y);

    if (mode === "wire" && wireDraft) {
      if (wireDraft.hover.gx !== gPos.gx || wireDraft.hover.gy !== gPos.gy) {
        wireDraft.hover = gPos;
        renderCanvas();
      }
      return;
    }

    if (!dragState) return;

    if (dragState.kind === "part") {
      const dx = gPos.gx - dragState.startMouseGrid.gx;
      const dy = gPos.gy - dragState.startMouseGrid.gy;
      const nextGx = dragState.origGx + dx;
      const nextGy = dragState.origGy + dy;
      if (nextGx !== dragState.part.gx || nextGy !== dragState.part.gy) {
        if (!dragState.moved) {
          saveHistory();
          dragState.moved = true;
        }
        dragState.part.gx = nextGx;
        dragState.part.gy = nextGy;
        renderCanvas();
      }
    } else if (dragState.kind === "wire-pt") {
      const pt = dragState.wire.points[dragState.ptIndex];
      if (pt.gx !== gPos.gx || pt.gy !== gPos.gy) {
        pt.gx = gPos.gx;
        pt.gy = gPos.gy;
        const isEnd = dragState.ptIndex === 0 || dragState.ptIndex === dragState.wire.points.length - 1;
        if (isEnd && isGndGrid(pt)) {
          dragState.wire.color = GND_COLOR;
        }
        render();
      }
    } else if (dragState.kind === "pan") {
      view.x = dragState.origX + (e.clientX - dragState.startClientX);
      view.y = dragState.origY + (e.clientY - dragState.startClientY);
      viewport.setAttribute("transform", `translate(${view.x}, ${view.y}) scale(${view.scale})`);
    }
  });

  window.addEventListener("mouseup", () => {
    if (dragState?.kind === "pan") svg.classList.remove("grabbing");
    dragState = null;
  });

  svg.addEventListener("dblclick", (e) => {
    const handleEl = e.target.closest(".wire-handle");
    if (!handleEl) return;
    const wire = state.wires.find(w => w.id === handleEl.dataset.wireId);
    const idx = Number(handleEl.dataset.ptIndex);
    if (wire && idx > 0 && idx < wire.points.length - 1) {
      saveHistory();
      wire.points.splice(idx, 1);
      render();
    }
  });

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextScale = Math.min(2.5, Math.max(0.4, view.scale * factor));
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    view.x = mx - (mx - view.x) * (nextScale / view.scale);
    view.y = my - (my - view.y) * (nextScale / view.scale);
    view.scale = nextScale;
    renderCanvas();
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelected();
    } else if (e.key.toLowerCase() === "r") {
      rotateSelectedPart();
    } else if (e.key.toLowerCase() === "f") {
      flipSelectedPart();
    } else if (e.key.toLowerCase() === "w") {
      setMode("wire");
    } else if (e.key.toLowerCase() === "v" || e.key === "Escape") {
      setMode("select");
    }
  });

  // JSON保存・読込
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pico-circuit.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed.parts) || !Array.isArray(parsed.wires)) {
          throw new Error("不正な形式です");
        }
        saveHistory();
        state = {
          parts: parsed.parts.map(p => ({ ...p, flipX: !!p.flipX })),
          wires: parsed.wires,
          settings: {
            picoPinMode: parsed.settings?.picoPinMode || "used",
            showContinuity: parsed.settings?.showContinuity !== false,
            transparentPico: !!parsed.settings?.transparentPico,
            lockBoards: parsed.settings?.lockBoards !== false
          }
        };
        selected = null;
        syncToolbarFromState();
        render();
        fitToView();
      } catch (err) {
        alert("JSONファイルの読み込みに失敗しました: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // 自動トリミング＆高解像度PNG書き出し
  function exportPNG() {
    const exportRoot = document.getElementById("export-root");
    const bbox = exportRoot.getBBox();
    if (bbox.width === 0 || bbox.height === 0) {
      alert("書き出す部品がありません。");
      return;
    }

    const pad = 28;
    const vx = bbox.x - pad;
    const vy = bbox.y - pad;
    const vw = bbox.width + pad * 2;
    const vh = bbox.height + pad * 2;
    const bg = document.getElementById("select-export-bg").value;

    const clone = exportRoot.cloneNode(true);
    const bgRect = bg !== "transparent"
      ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}" />`
      : "";

    const svgStr = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}">
        <style>
          text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; }
        </style>
        ${bgRect}
        ${clone.innerHTML}
      </svg>
    `;

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 2.5;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vw * scale);
      canvas.height = Math.ceil(vh * scale);
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "pico-wiring-diagram.png";
      a.click();
    };
    img.src = url;
  }

  function syncToolbarFromState() {
    document.getElementById("select-pico-pins").value = state.settings.picoPinMode;
    document.getElementById("toggle-continuity").checked = state.settings.showContinuity;
    document.getElementById("toggle-pico-transparent").checked = state.settings.transparentPico;
    document.getElementById("toggle-lock-boards").checked = state.settings.lockBoards;
  }

  // ツールバー・イベント登録
  document.getElementById("btn-initial").addEventListener("click", () => loadInitialBoard(true));
  document.getElementById("btn-sample").addEventListener("click", loadSampleCircuit);
  document.getElementById("btn-clear").addEventListener("click", clearCircuit);
  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-mode-select").addEventListener("click", () => setMode("select"));
  document.getElementById("btn-mode-wire").addEventListener("click", () => setMode("wire"));
  document.getElementById("palette-wire-btn").addEventListener("click", () => setMode("wire"));
  document.getElementById("btn-save-json").addEventListener("click", exportJSON);
  document.getElementById("btn-export-png").addEventListener("click", exportPNG);

  const fileInput = document.getElementById("file-json-input");
  document.getElementById("btn-load-json").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    fileInput.value = "";
  });

  document.getElementById("select-pico-pins").addEventListener("change", (e) => {
    state.settings.picoPinMode = e.target.value;
    renderCanvas();
  });

  document.getElementById("toggle-continuity").addEventListener("change", (e) => {
    state.settings.showContinuity = e.target.checked;
    renderCanvas();
  });

  document.getElementById("toggle-pico-transparent").addEventListener("change", (e) => {
    state.settings.transparentPico = e.target.checked;
    renderCanvas();
  });

  document.getElementById("toggle-lock-boards").addEventListener("change", (e) => {
    state.settings.lockBoards = e.target.checked;
    if (state.settings.lockBoards && selected?.kind === "part") {
      const p = state.parts.find(x => x.id === selected.id);
      if (p?.type === "breadboard") selected = null;
    }
    render();
  });

  document.querySelectorAll("[data-add-part]").forEach(btn => {
    btn.addEventListener("click", () => addPart(btn.dataset.addPart));
  });

  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    view.scale = Math.min(2.5, view.scale * 1.15);
    renderCanvas();
  });
  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    view.scale = Math.max(0.4, view.scale / 1.15);
    renderCanvas();
  });
  document.getElementById("btn-zoom-reset").addEventListener("click", fitToView);

  // 初期起動：縦置きブレッドボード＋Pico直刺し
  loadInitialBoard(false);
})();
