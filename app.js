(() => {
  const {
    GRID, LED_COLORS, RESISTOR_VALUES, WIRE_COLORS,
    rotateGrid, getBreadboardGroups, getPartPinsWorld,
    renderBreadboard, renderPico, renderPicoLabels, renderLed, renderResistor
  } = window.PARTS_CATALOG;

  // アプリケーション状態
  let state = {
    parts: [],
    wires: [],
    settings: {
      picoPinMode: "used",      // 'used' | 'all' | 'none'
      showContinuity: true
    }
  };

  let history = [];
  let selected = null; // { kind: 'part' | 'wire', id: string }
  let mode = "select"; // 'select' | 'wire'
  let wireDraft = null; // { start: {gx, gy}, hover: {gx, gy}, color: string }

  // ビューポート（ズーム・パン）
  let view = { x: 80, y: 80, scale: 1.0 };

  // ドラッグ状態
  let dragState = null;

  // DOM参照
  const svg = document.getElementById("canvas-svg");
  const viewport = document.getElementById("viewport");
  const layerBoards = document.getElementById("layer-boards");
  const layerContinuity = document.getElementById("layer-continuity");
  const layerParts = document.getElementById("layer-parts");
  const layerWires = document.getElementById("layer-wires");
  const layerLabels = document.getElementById("layer-labels");
  const layerUI = document.getElementById("layer-ui");
  const propContent = document.getElementById("property-content");
  const modeBanner = document.getElementById("mode-banner");
  const zoomLabel = document.getElementById("zoom-label");

  // ユーティリティ
  const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

  function saveHistory() {
    history.push(JSON.stringify(state));
    if (history.length > 40) history.shift();
  }

  function undo() {
    if (history.length === 0) return;
    state = JSON.parse(history.pop());
    selected = null;
    syncToolbarFromState();
    render();
  }

  // スクリーン座標 → ワールドSVG座標
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

  // Lチカ回路の初期サンプル（Pico＋ブレッドボード＋220Ω抵抗＋赤LED＋配線）
  function loadSampleCircuit() {
    saveHistory();
    state = {
      parts: [
        { id: "bb_1", type: "breadboard", gx: 2, gy: 13, rot: 0, props: {} },
        { id: "pico_1", type: "pico", gx: 3, gy: 1, rot: 0, props: { model: "Raspberry Pi Pico" } },
        { id: "res_1", type: "resistor", gx: 14, gy: 15, rot: 0, props: { value: "220", span: 4, showLabel: true } },
        { id: "led_1", type: "led", gx: 18, gy: 16, rot: 0, props: { color: "red", showPolarity: true } }
      ],
      wires: [
        {
          id: "w_1",
          color: "#ef4444",
          points: [
            { gx: 22, gy: 8 },  // Pico Pin 20 (GP15)
            { gx: 22, gy: 11 },
            { gx: 14, gy: 11 },
            { gx: 14, gy: 13 }  // ブレッドボード列13上段（抵抗と同じ列）
          ]
        },
        {
          id: "w_2",
          color: "#1e293b",
          points: [
            { gx: 19, gy: 13 }, // LEDカソード（短い脚）と同じ列
            { gx: 19, gy: 10 },
            { gx: 20, gy: 10 },
            { gx: 20, gy: 8 }   // Pico Pin 18 (GND)
          ]
        }
      ],
      settings: {
        picoPinMode: "used",
        showContinuity: true
      }
    };
    selected = null;
    view = { x: 80, y: 65, scale: 1.0 };
    syncToolbarFromState();
    render();
  }

  // 新規（空）
  function clearCircuit() {
    saveHistory();
    state.parts = [];
    state.wires = [];
    selected = null;
    render();
  }

  // 導通計算＆使用中Picoピン判定
  function computeConnectivity() {
    const nonBoardPinPoints = new Map(); // "gx,gy" -> count of non-pico pins + wire ends
    const picoPinPoints = new Set();     // "gx,gy"
    const allConnectionPoints = new Set();

    // 部品ピン収集
    for (const part of state.parts) {
      if (part.type === "breadboard") continue;
      const pins = getPartPinsWorld(part);
      for (const p of pins) {
        const key = `${p.worldGx},${p.worldGy}`;
        allConnectionPoints.add(key);
        if (part.type === "pico") {
          picoPinPoints.add(key);
        } else {
          nonBoardPinPoints.set(key, (nonBoardPinPoints.get(key) || 0) + 1);
        }
      }
    }

    // ジャンパ線両端収集
    for (const wire of state.wires) {
      if (wire.points.length < 2) continue;
      const ends = [wire.points[0], wire.points[wire.points.length - 1]];
      for (const pt of ends) {
        const key = `${pt.gx},${pt.gy}`;
        allConnectionPoints.add(key);
        nonBoardPinPoints.set(key, (nonBoardPinPoints.get(key) || 0) + 1);
      }
    }

    // ブレッドボード導通グループのアクティブ判定
    const activeGroups = [];
    const usedPicoPinKeys = new Set();

    // 直接ワイヤーや他部品と重なっているPicoピン
    for (const key of picoPinPoints) {
      if (nonBoardPinPoints.has(key)) {
        usedPicoPinKeys.add(key);
      }
    }

    for (const part of state.parts) {
      if (part.type !== "breadboard") continue;
      const groups = getBreadboardGroups(part);
      for (const grp of groups) {
        let hasAny = false;
        let hasNonPico = false;
        const picoKeysInGroup = [];

        for (const c of grp.cells) {
          const key = `${c.gx},${c.gy}`;
          if (allConnectionPoints.has(key)) hasAny = true;
          if (nonBoardPinPoints.has(key)) hasNonPico = true;
          if (picoPinPoints.has(key)) picoKeysInGroup.push(key);
        }

        if (hasAny) {
          activeGroups.push({ part, grp });
        }
        // Pico直刺し時に同じ横5穴へ別部品/線が入っていれば使用中ピン扱い
        if (hasNonPico && picoKeysInGroup.length > 0) {
          for (const k of picoKeysInGroup) usedPicoPinKeys.add(k);
        }
      }
    }

    return { activeGroups, usedPicoPinKeys };
  }

  // メイン描画
  function render() {
    viewport.setAttribute("transform", `translate(${view.x}, ${view.y}) scale(${view.scale})`);
    zoomLabel.textContent = `${Math.round(view.scale * 100)}%`;

    const { activeGroups, usedPicoPinKeys } = computeConnectivity();

    // 1. ブレッドボード描画
    layerBoards.innerHTML = "";
    for (const part of state.parts) {
      if (part.type !== "breadboard") continue;
      const isSel = selected?.kind === "part" && selected.id === part.id;
      const g = createSvgEl("g", {
        class: "selectable",
        "data-part-id": part.id,
        transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})`
      });
      g.innerHTML = renderBreadboard(part, isSel);
      layerBoards.appendChild(g);
    }

    // 2. 導通ハイライト（青い帯）描画
    layerContinuity.innerHTML = "";
    if (state.settings.showContinuity) {
      for (const { part, grp } of activeGroups) {
        const g = createSvgEl("g", {
          transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})`,
          "pointer-events": "none"
        });
        let fill = "rgba(56, 189, 248, 0.38)";
        let stroke = "rgba(2, 132, 199, 0.7)";
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

    // 3. Pico・電子部品描画
    layerParts.innerHTML = "";
    for (const part of state.parts) {
      if (part.type === "breadboard") continue;
      const isSel = selected?.kind === "part" && selected.id === part.id;
      const g = createSvgEl("g", {
        class: "selectable",
        "data-part-id": part.id,
        transform: `translate(${part.gx * GRID}, ${part.gy * GRID}) rotate(${part.rot})`
      });
      if (part.type === "pico") g.innerHTML = renderPico(part, isSel);
      else if (part.type === "led") g.innerHTML = renderLed(part, isSel);
      else if (part.type === "resistor") g.innerHTML = renderResistor(part, isSel);
      layerParts.appendChild(g);
    }

    // 4. ジャンパ線描画
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

    // 5. Picoピンラベル描画（最前面）
    layerLabels.innerHTML = "";
    for (const part of state.parts) {
      if (part.type !== "pico") continue;
      const g = createSvgEl("g", { "pointer-events": "none" });
      g.innerHTML = renderPicoLabels(part, state.settings.picoPinMode, usedPicoPinKeys);
      layerLabels.appendChild(g);
    }

    // 6. UIオーバーレイ（選択中ワイヤーの編集ハンドル・配線プレビュー）
    layerUI.innerHTML = "";
    if (selected?.kind === "wire") {
      const wire = state.wires.find(w => w.id === selected.id);
      if (wire) renderWireHandles(wire);
    }

    if (mode === "wire" && wireDraft) {
      const pts = makeOrthogonalPoints(wireDraft.start, wireDraft.hover);
      const ptsStr = pts.map(p => `${p.gx * GRID},${p.gy * GRID}`).join(" ");
      layerUI.innerHTML += `
        <polyline points="${ptsStr}" fill="none" stroke="#2563eb" stroke-width="4" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />
        <circle cx="${wireDraft.start.gx * GRID}" cy="${wireDraft.start.gy * GRID}" r="5" fill="#2563eb" pointer-events="none" />
        <circle cx="${wireDraft.hover.gx * GRID}" cy="${wireDraft.hover.gy * GRID}" r="5" fill="#2563eb" opacity="0.7" pointer-events="none" />
      `;
    }

    renderPropertyPanel();
  }

  // ワイヤー頂点＆中間「＋」ハンドル描画
  function renderWireHandles(wire) {
    // 各辺の中点に「＋」ハンドル（クリックで経由点挿入）
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

    // 各頂点ハンドル（ドラッグで移動、経由点ダブルクリックで削除）
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

  function makeOrthogonalPoints(a, b, flip = false) {
    if (a.gx === b.gx || a.gy === b.gy) {
      return [{ gx: a.gx, gy: a.gy }, { gx: b.gx, gy: b.gy }];
    }
    const corner = flip ? { gx: a.gx, gy: b.gy } : { gx: b.gx, gy: a.gy };
    return [{ gx: a.gx, gy: a.gy }, corner, { gx: b.gx, gy: b.gy }];
  }

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // 右プロパティパネル更新
  function renderPropertyPanel() {
    if (!selected) {
      propContent.innerHTML = `<p class="empty-note">部品やジャンパ線をクリックすると、色や数値、向きを変更できます。</p>`;
      return;
    }

    if (selected.kind === "part") {
      const part = state.parts.find(p => p.id === selected.id);
      if (!part) return;

      const names = {
        pico: "Raspberry Pi Pico",
        breadboard: "ブレッドボード",
        led: "LED",
        resistor: "抵抗"
      };

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
        `;
      } else if (part.type === "led") {
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
            <label class="toggle-label">
              <input type="checkbox" id="prop-led-pol" ${part.props.showPolarity !== false ? "checked" : ""} />
              極性（＋長／−短）を表示
            </label>
          </div>
        `;
      } else if (part.type === "resistor") {
        extra += `
          <div class="prop-row">
            <label>抵抗値</label>
            <select id="prop-res-val">
              ${Object.entries(RESISTOR_VALUES).map(([k, v]) => `
                <option value="${k}" ${part.props.value === k ? "selected" : ""}>${v.label}</option>
              `).join("")}
            </select>
          </div>
          <div class="prop-row">
            <label>脚の間隔: ${part.props.span || 4} マス</label>
            <input type="range" id="prop-res-span" min="2" max="6" value="${part.props.span || 4}" />
          </div>
          <div class="prop-row">
            <label class="toggle-label">
              <input type="checkbox" id="prop-res-label" ${part.props.showLabel !== false ? "checked" : ""} />
              数値ラベルを表示
            </label>
          </div>
        `;
      }

      propContent.innerHTML = `
        <div class="prop-row"><strong>${names[part.type] || part.type}</strong></div>
        <div class="prop-row">
          <label>向き (${part.rot}°)</label>
          <button id="prop-rotate" class="btn" style="width:100%">↻ 90°回転 (R)</button>
        </div>
        ${extra}
        <button id="prop-delete" class="btn btn-danger">削除 (Delete)</button>
      `;

      document.getElementById("prop-rotate")?.addEventListener("click", () => rotateSelectedPart());
      document.getElementById("prop-delete")?.addEventListener("click", () => deleteSelected());

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

      document.getElementById("prop-led-pol")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.showPolarity = e.target.checked;
        render();
      });

      document.getElementById("prop-res-val")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.value = e.target.value;
        render();
      });

      document.getElementById("prop-res-span")?.addEventListener("input", (e) => {
        part.props.span = Number(e.target.value);
        render();
      });

      document.getElementById("prop-res-label")?.addEventListener("change", (e) => {
        saveHistory();
        part.props.showLabel = e.target.checked;
        render();
      });

    } else if (selected.kind === "wire") {
      const wire = state.wires.find(w => w.id === selected.id);
      if (!wire) return;

      propContent.innerHTML = `
        <div class="prop-row"><strong>ジャンパ線</strong></div>
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
          render();
        });
      });
      document.getElementById("prop-delete")?.addEventListener("click", () => deleteSelected());
    }
  }

  // モード切替
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
    // 画面中央付近のグリッド座標に配置
    const rect = svg.getBoundingClientRect();
    const centerW = clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const g = worldToGrid(centerW.x, centerW.y);

    const defaults = {
      pico:       { gx: g.gx - 10, gy: g.gy - 4, props: { model: "Raspberry Pi Pico" } },
      breadboard: { gx: g.gx - 15, gy: g.gy - 5, props: {} },
      led:        { gx: g.gx,      gy: g.gy,     props: { color: "red", showPolarity: true } },
      resistor:   { gx: g.gx - 2,  gy: g.gy,     props: { value: "220", span: 4, showLabel: true } }
    };
    const d = defaults[type];
    const part = { id: uid(type), type, gx: d.gx, gy: d.gy, rot: 0, props: { ...d.props } };
    state.parts.push(part);
    selected = { kind: "part", id: part.id };
    render();
  }

  // マウスイベント（SVGキャンバス）
  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const wPos = clientToWorld(e.clientX, e.clientY);
    const gPos = worldToGrid(wPos.x, wPos.y);

    // 配線モード
    if (mode === "wire") {
      if (!wireDraft) {
        wireDraft = { start: gPos, hover: gPos, color: "#ef4444" };
      } else {
        if (wireDraft.start.gx !== gPos.gx || wireDraft.start.gy !== gPos.gy) {
          saveHistory();
          const newWire = {
            id: uid("w"),
            color: wireDraft.color,
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

    // ワイヤー中点「＋」クリック → 経由点挿入して即ドラッグ可能に
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

    // ワイヤー頂点ハンドルドラッグ
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

    // ワイヤー選択
    const wireEl = e.target.closest("[data-wire-id]");
    if (wireEl) {
      selected = { kind: "wire", id: wireEl.dataset.wireId };
      render();
      return;
    }

    // 部品選択＆ドラッグ開始
    const partEl = e.target.closest("[data-part-id]");
    if (partEl) {
      const part = state.parts.find(p => p.id === partEl.dataset.partId);
      if (part) {
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
      }
      return;
    }

    // 空白クリック → 選択解除＋キャンバスパン開始
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
        render();
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
        render();
      }
    } else if (dragState.kind === "wire-pt") {
      const pt = dragState.wire.points[dragState.ptIndex];
      if (pt.gx !== gPos.gx || pt.gy !== gPos.gy) {
        pt.gx = gPos.gx;
        pt.gy = gPos.gy;
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

  // ワイヤー途中頂点のダブルクリック削除
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

  // ホイールズーム
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
    render();
  }, { passive: false });

  // キーボードショートカット
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelected();
    } else if (e.key.toLowerCase() === "r") {
      rotateSelectedPart();
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
          parts: parsed.parts,
          wires: parsed.wires,
          settings: {
            picoPinMode: parsed.settings?.picoPinMode || "used",
            showContinuity: parsed.settings?.showContinuity !== false
          }
        };
        selected = null;
        syncToolbarFromState();
        render();
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
      const scale = 2.5; // スライド用高解像度
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
  }

  // ツールバー・ボタン接続
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
    render();
  });

  document.getElementById("toggle-continuity").addEventListener("change", (e) => {
    state.settings.showContinuity = e.target.checked;
    render();
  });

  document.querySelectorAll("[data-add-part]").forEach(btn => {
    btn.addEventListener("click", () => addPart(btn.dataset.addPart));
  });

  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    view.scale = Math.min(2.5, view.scale * 1.15);
    render();
  });
  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    view.scale = Math.max(0.4, view.scale / 1.15);
    render();
  });
  document.getElementById("btn-zoom-reset").addEventListener("click", () => {
    view = { x: 80, y: 65, scale: 1.0 };
    render();
  });

  // 初期起動
  loadSampleCircuit();
})();
