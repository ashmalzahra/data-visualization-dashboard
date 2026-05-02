function UKEthnicitybyRegion() {
  this.name = 'UK Ethnicity by Region';
  this.id = 'uk-ethnicity';
  this.title = 'Ethnicity by Region (Census 2021)';

  // Layout
  this.layout = {
    marginSize: 48,
    leftMargin: 120,
    rightMargin: width - 350,
    topMargin: 96,
    bottomMargin: height - 70,
    plotWidth() { return this.rightMargin - this.leftMargin; },
    plotHeight() { return this.bottomMargin - this.topMargin; }
  };

  // Data
  const DATA_PATH = './data/population/population-by-ethnicity-and-region-2021.csv';
  this.table = null;
  this.rowsAll = [];

  this.granularity = 'ONS 2021 5+1';
  this.ethnicity = null;
  this.metric = '% of region';

  this.regions = [
    'North East',
    'Yorkshire and The Humber',
    'North West',
    'East Midlands',
    'East of England',
    'West Midlands',
    'London',
    'South East',
    'South West',
    'Wales'
  ];

  this.hexPos = {
    'North East': [2, -3],
    'Yorkshire and The Humber': [1, -2],
    'North West': [0, -2],
    'East Midlands': [1, -1],
    'East of England': [2, -1],
    'West Midlands': [0, -1],
    'London': [2, 0],
    'South East': [3, 0],
    'South West': [-1, 0],
    'Wales': [-1, -1]
  };

  this.target = {};
  this.current = {};
  this.domain = [];
  this.tweenSpeed = 0.12;

  this.colors = [
    color('#fde0dd'),
    color('#fcc5c0'),
    color('#fa9fb5'),
    color('#f768a1'),
    color('#dd3497'),
    color('#ae017e')
  ];
  this.bins = [];

  this.selGran = null;
  this.selEth = null;
  this.selMet = null;
  this.hover = null;

  this.hexSize = 46;
  this.hexCenters = {};
  this.hexPolys = {};

  // Compare state
  this.picked = null; // primary selected region
  this.compare = null; // second region when comparing
  this.compareLinkAlpha = 0; // dash link fade-in

  // DOM bindings
  this._canvasEl = null;
  this._onDown = null;
  this._onKey = null;


  const REVEAL_DURATION_MS = 520;   // fade and pop per hex
  const REVEAL_STAGGER_MS = 80;
  this._revealStartMs = 0;
  this._revealAt = {};

  // lifecycle
  this.preload = function () { this.table = loadTable(DATA_PATH, 'csv', 'header'); };

  this.setup = function () {
    textFont('Helvetica');
    frameRate(30);
    this._parseCSV();
    this._buildUI();
    this._placeUI();
    this._recompute(true);

    this._scheduleReveal();

    // Native mousedown listener so clicks always work
    this._canvasEl = document.querySelector('canvas');
    if (this._canvasEl) {
      this._onDown = (e) => {
        const r = this._canvasEl.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;

        const hit = this._pickRegionAt(x, y);
        if (!hit) {
          this.picked = null;
          this.compare = null;
          return;
        }

        if (e.shiftKey) {
          if (!this.picked) this.picked = hit;
          else if (hit === this.picked) this.compare = null;
          else { this.compare = hit; this.compareLinkAlpha = 0; }
        } else {
          this.picked = hit;
          this.compare = null;
        }
      };
      this._canvasEl.addEventListener('mousedown', this._onDown);
    }
  };

  this.destroy = function () {
    if (this.selGran) { this.selGran.remove(); this.selGran = null; }
    if (this.selEth) { this.selEth.remove(); this.selEth = null; }
    if (this.selMet) { this.selMet.remove(); this.selMet = null; }
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
    if (this._canvasEl && this._onDown) this._canvasEl.removeEventListener('mousedown', this._onDown);
  };

  // Parse CSV
  this._parseCSV = function () {
    const rows = [];
    for (let i = 0; i < this.table.getRowCount(); i++) {
      const r = this.table.getRow(i);
      if (r.getNum('Time') !== 2021) continue;
      const geo = r.getString('Geography');
      if (geo === 'All - England And Wales') continue;
      rows.push({
        region: geo,
        type: r.getString('Ethnicity_type'),
        ethnicity: r.getString('Ethnicity'),
        value1: r.getNum('Value1'),
        value2: r.getNum('Value2'),
        regionalPop: r.getNum('Regional Population'),
        ethnicPop: r.getNum('Ethnic Population'),
        totalEthPop: r.getNum('Total Ethnic Population')
      });
    }
    this.rowsAll = rows;

    const opts = this._ethnicitiesFor(this.granularity);
    const pref = ['Asian', 'Black', 'White', 'Mixed', 'Other', 'Arab'];
    this.ethnicity = (pref.find(p => opts.includes(p)) || opts[0] || null);
  };

  this._ethnicitiesFor = function (gran) {
    const set = new Set();
    this.rowsAll.forEach(r => { if (r.type === gran && r.ethnicity !== 'All') set.add(r.ethnicity); });
    return Array.from(set).sort();
  };

  // UI
  this._buildUI = function () {
    if (this.selGran) this.selGran.remove();
    if (this.selEth) this.selEth.remove();
    if (this.selMet) this.selMet.remove();

    this.selGran = createSelect();
    this.selGran.option('ONS 2021 5+1');
    this.selGran.option('ONS 2021 19+1');
    this.selGran.selected(this.granularity);
    this.selGran.changed(() => { this.granularity = this.selGran.value(); this._rebuildEth(); this._recompute(true); this._scheduleReveal(true); });

    this.selEth = createSelect();
    this._rebuildEth();
    this.selEth.changed(() => { this.ethnicity = this.selEth.value(); this._recompute(true); this._scheduleReveal(true); });

    this.selMet = createSelect();
    this.selMet.option('% of region');
    this.selMet.option('% of ethnic group');
    this.selMet.selected(this.metric);
    this.selMet.changed(() => { this.metric = this.selMet.value(); this._recompute(true); this._scheduleReveal(true); });

    [this.selGran, this.selEth, this.selMet].forEach(el => {
      el.style('position', 'absolute');
      el.style('padding', '8px');
      el.style('border', '1px solid #ccd1d9');
      el.style('border-radius', '8px');
      el.style('background', '#fff');
      el.style('font-size', '12px');
      el.style('box-shadow', '0 1px 3px rgba(0,0,0,0.06)');
      el.style('z-index', '10');
    });

    this._onKey = (e) => {
      const activeTag = (document.activeElement && document.activeElement.tagName) || '';
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(activeTag)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const L = this._ethnicitiesFor(this.granularity);
        if (!L.length) return;
        let i = L.indexOf(this.ethnicity);
        if (i < 0) i = 0;
        i = (e.key === 'ArrowRight') ? (i + 1) % L.length : (i - 1 + L.length) % L.length;
        this.ethnicity = L[i];
        this.selEth.value(this.ethnicity);
        this._recompute(true);
        this._scheduleReveal(true);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        this.metric = (this.metric === '% of region') ? '% of ethnic group' : '% of region';
        this.selMet.value(this.metric);
        this._recompute(true);
        this._scheduleReveal(true);
      }
    };
    window.addEventListener('keydown', this._onKey);
  };

  this._rebuildEth = function () {
    const options = this._ethnicitiesFor(this.granularity);
    this.selEth.elt.innerHTML = '';
    options.forEach(o => this.selEth.option(o));
    if (!this.ethnicity || !options.includes(this.ethnicity)) this.ethnicity = options[0] || null;
    this.selEth.value(this.ethnicity);
  };

  this._placeUI = function () {
    const cnv = document.querySelector('canvas');
    if (!cnv) return;
    const rect = cnv.getBoundingClientRect();
    const pageLeft = rect.left + window.scrollX;
    const pageTop = rect.top + window.scrollY;

    const legendColX = this.layout.rightMargin + 30;
    const padRight = 180;
    const x = pageLeft + legendColX + padRight;
    const y0 = pageTop + (this.layout.topMargin - 14);
    this.selGran.position(x, y0);
    this.selEth.position(x, y0 + 40);
    this.selMet.position(x, y0 + 80);
  };

  // Selection
  this._recompute = function (resetAnim) {
    const metricKey = (this.metric === '% of region') ? 'value1' : 'value2';
    const map = {};
    this.domain = [];

    for (const reg of this.regions) {
      const row = this.rowsAll.find(r => r.region === reg && r.type === this.granularity && r.ethnicity === this.ethnicity);
      const v = row ? (row[metricKey] || 0) : NaN;
      map[reg] = v;
      if (isFinite(v)) this.domain.push(v);
    }
    this.target = map;
    if (resetAnim || Object.keys(this.current).length === 0) {
      this.current = Object.assign({}, this.target);
    }
    this._computeBins();
  };

  this._computeBins = function () {
    const a = this.domain.slice().sort((x, y) => x - y);
    const n = max(1, a.length);
    const q = (p) => a[min(n - 1, max(0, floor(p * (n - 1))))];
    this.bins = [q(0.00), q(0.20), q(0.40), q(0.60), q(0.80), q(1.00)];
  };

  this._binIndex = function (v) {
    if (!isFinite(v)) return -1;
    const b = this.bins;
    if (b[0] === b[b.length - 1]) return 5;
    if (v <= b[1]) return 0;
    if (v <= b[2]) return 1;
    if (v <= b[3]) return 2;
    if (v <= b[4]) return 3;
    return 5;
  };

  // Geometry helpers
  this._axialToPixel = function (q, r, size, originX, originY) {
    const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = size * (3 / 2 * r);
    return { x: originX + x, y: originY + y };
  };

  this._hexPolygon = function (cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = -PI / 2 + i * PI / 3;
      pts.push({ x: cx + size * cos(ang), y: cy + size * sin(ang) });
    }
    return pts;
  };

  this._pointInPoly = function (poly, mx, my) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const inter = ((yi > my) != (yj > my)) && (mx < (xj - xi) * (my - yi) / (yj - yi + 1e-9) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  };

  this._pickRegionAt = function (x, y) {
    for (const reg of this.regions) {
      const poly = this.hexPolys[reg];
      if (poly && this._pointInPoly(poly, x, y)) return reg;
    }
    return null;
  };

  // Data access helpers
  this._raw = function (reg) {
    return this.rowsAll.find(r => r.region === reg && r.type === this.granularity && r.ethnicity === this.ethnicity) || null;
  };

  this._value = function (reg) {
    const r = this._raw(reg);
    if (!r) return NaN;
    return (this.metric === '% of region') ? (r.value1 || 0) : (r.value2 || 0);
  };

  this._miniCompare = function (cx, cy, hexSize, v1, v2, maxRef) {
    if (!isFinite(v1) || !isFinite(v2)) return;

    const w = hexSize * 1.2;
    const h = 10;
    const gap = 3;
    const x0 = cx - w / 2;
    const y0 = cy + hexSize * 0.55;

    noStroke(); fill(255, 210); rect(x0, y0 - 2, w, h * 2 + gap + 4, 4);

    const maxv = max(1e-6, maxRef);
    const w1 = (v1 / maxv) * (w - 6);
    const w2 = (v2 / maxv) * (w - 6);

    fill(30, 160); rect(x0 + 3, y0 + 2, w1, h, 3);
    fill(30, 90); rect(x0 + 3, y0 + 2 + h + gap, w2, h, 3);
  };

  // Reveal
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  this._scheduleReveal = function (resetClock = false) {
    const pw = this.layout.plotWidth(), ph = this.layout.plotHeight();
    const colsSpan = 5.5, rowsSpan = 4.5;
    const sizeByW = pw / (colsSpan * Math.sqrt(3));
    const sizeByH = ph / (rowsSpan * 1.6);
    const hexSizeTmp = min(56, max(34, min(sizeByW, sizeByH)));

    const centers = [];
    for (const reg of this.regions) {
      const [q, r] = this.hexPos[reg];
      centers.push({ reg, pt: this._axialToPixel(q, r, hexSizeTmp, 0, 0) });
    }
    const minX = min(...centers.map(p => p.pt.x));
    const maxX = max(...centers.map(p => p.pt.x));
    const minY = min(...centers.map(p => p.pt.y));
    const maxY = max(...centers.map(p => p.pt.y));
    const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
    const plotCx = this.layout.leftMargin + pw / 2;
    const plotCy = this.layout.topMargin + ph / 2;

    const placed = centers.map(({ reg, pt }) => {
      const p = { x: pt.x + (plotCx - cx0), y: pt.y + (plotCy - cy0) };
      return { reg, x: p.x, y: p.y };
    });

    // sort by row (y), then by column (x)
    placed.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    const now = millis();
    if (resetClock) this._revealStartMs = now;
    const base = this._revealStartMs || now;

    placed.forEach((it, idx) => {
      this._revealAt[it.reg] = base + idx * REVEAL_STAGGER_MS;
    });
    if (!this._revealStartMs) this._revealStartMs = now;
  };

  // Draw
  this.draw = function () {
    background(255);
    this._placeUI();
    this._drawTitle();

    const pw = this.layout.plotWidth(), ph = this.layout.plotHeight();
    const colsSpan = 5.5, rowsSpan = 4.5;
    const sizeByW = pw / (colsSpan * Math.sqrt(3));
    const sizeByH = ph / (rowsSpan * 1.6);
    this.hexSize = min(56, max(34, min(sizeByW, sizeByH)));

    const centers = [];
    for (const reg of this.regions) {
      const [q, r] = this.hexPos[reg];
      centers.push(this._axialToPixel(q, r, this.hexSize, 0, 0));
    }
    const minX = min(...centers.map(p => p.x));
    const maxX = max(...centers.map(p => p.x));
    const minY = min(...centers.map(p => p.y));
    const maxY = max(...centers.map(p => p.y));
    const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
    const plotCx = this.layout.leftMargin + pw / 2;
    const plotCy = this.layout.topMargin + ph / 2;

    for (const k in this.current) {
      const c = this.current[k], t = this.target[k];
      this.current[k] = isFinite(c) && isFinite(t) ? c + (t - c) * this.tweenSpeed : t;
    }

    this.hover = null;

    for (const reg of this.regions) {
      const [q, r] = this.hexPos[reg];
      const p = this._axialToPixel(q, r, this.hexSize, plotCx - cx0, plotCy - cy0);
      this.hexCenters[reg] = p;
      const poly = this._hexPolygon(p.x, p.y, this.hexSize - 2);
      this.hexPolys[reg] = poly;

      const v = this.current[reg] || 0;
      const bi = this._binIndex(v);
      const col = (bi < 0 ? color('#efefef') : this.colors[bi]);
      col.setAlpha(255);

      const start = this._revealAt[reg] ?? (this._revealStartMs || millis());
      const t = constrain((millis() - start) / REVEAL_DURATION_MS, 0, 1);
      const prog = easeOutCubic(t);
      const alpha = 255 * prog;
      const scalePop = 0.94 + 0.06 * prog;  // subtle pop-in

      push();
      translate(p.x, p.y);
      scale(scalePop);
      noStroke();
      const sh = color(0, 28); sh.setAlpha(28 * prog);
      fill(sh);
      beginShape(); for (const pt of this._hexPolygon(3, 3, this.hexSize - 2)) vertex(pt.x, pt.y); endShape(CLOSE);

      stroke(220 * prog);
      strokeWeight(1.2);
      const face = color(col); face.setAlpha(alpha);
      fill(face);
      beginShape(); for (const pt of this._hexPolygon(0, 0, this.hexSize - 2)) vertex(pt.x, pt.y); endShape(CLOSE);
      pop();

      // label
      const labelLines = this._wrapLabel(reg.toUpperCase(), this.hexSize * 1.55);
      textAlign(CENTER, CENTER);
      const baseSize = (labelLines.length >= 3) ? 9 : 10;
      textSize(baseSize);
      const lum = (red(col) * 0.2126 + green(col) * 0.7152 + blue(col) * 0.0722) / 255;
      const labelCol = (lum < 0.6) ? 255 : 30;
      const strokeA = 110 * prog;
      push();
      translate(p.x, p.y);
      scale(scalePop);
      stroke((lum < 0.6) ? color(0, strokeA) : color(255, strokeA));
      strokeWeight(2);
      const lbl = color(labelCol); lbl.setAlpha(255 * prog);
      fill(lbl);

      const lineGap = 12;
      const yStart = - ((labelLines.length - 1) * lineGap) / 2;
      for (let i = 0; i < labelLines.length; i++) {
        text(labelLines[i], 0, yStart + i * lineGap);
      }
      pop();

      // hover detection
      if (prog >= 0.98 && this._pointInPoly(poly, mouseX, mouseY)) {
        const row = this._raw(reg);
        this.hover = {
          region: reg, value1: row?.value1, value2: row?.value2,
          regionalPop: row?.regionalPop, ethnicPop: row?.ethnicPop
        };
      }
    }

    // Compare overlays
    if (this.picked && this.hexCenters[this.picked]) {
      const a = this.picked;
      const aVal = this._value(a);

      if (this.compare && this.hexCenters[this.compare]) {
        const b = this.compare;
        const pA = this.hexCenters[a], pB = this.hexCenters[b];

        // dashed connector
        this.compareLinkAlpha = min(1, this.compareLinkAlpha + 0.08);
        stroke(30, 120 * this.compareLinkAlpha);
        strokeWeight(2);
        drawingContext.setLineDash([6, 6]);
        line(pA.x, pA.y, pB.x, pB.y);
        drawingContext.setLineDash([]);

        const bVal = this._value(b);
        const refMax = max(aVal, bVal);
        this._miniCompare(pA.x, pA.y, this.hexSize, aVal, bVal, refMax);
        this._miniCompare(pB.x, pB.y, this.hexSize, bVal, aVal, refMax);
      } else {
        const ref = max(...this.domain);
        const pA = this.hexCenters[a];
        this._miniCompare(pA.x, pA.y, this.hexSize, aVal, 0, ref);
      }
    }

    this._drawLegend();
    this._drawTips();

    const ttip = (this.picked ? {
      region: this.picked,
      value1: this._raw(this.picked)?.value1,
      value2: this._raw(this.picked)?.value2,
      regionalPop: this._raw(this.picked)?.regionalPop,
      ethnicPop: this._raw(this.picked)?.ethnicPop
    } : this.hover);
    if (ttip) this._tooltip(ttip);
  };

  // Helpers
  this._wrapLabel = function (text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = words[0] || '';
    textSize(10);
    for (let i = 1; i < words.length; i++) {
      const test = line + ' ' + words[i];
      if (textWidth(test) <= maxWidth) line = test;
      else { lines.push(line); line = words[i]; }
    }
    lines.push(line);
    if (lines.length > 3) {
      const merged = lines.slice(0, 2);
      merged.push(lines.slice(2).join(' '));
      return merged;
    }
    return lines;
  };

  this._drawTitle = function () {
    noStroke(); fill('#222'); textAlign(CENTER, CENTER);
    textSize(18);
    text(this.title,
      (this.layout.leftMargin + this.layout.rightMargin) / 2,
      this.layout.topMargin - this.layout.marginSize);
    textSize(12); fill('#555');
    text(`Granularity: ${this.granularity} • Ethnicity: ${this.ethnicity} • Metric: ${this.metric}`,
      (this.layout.leftMargin + this.layout.rightMargin) / 2,
      this.layout.topMargin - this.layout.marginSize + 22);
  };

  this._drawLegend = function () {
    const x = this.layout.rightMargin + 30;
    let y = this.layout.topMargin + 110;
    textAlign(LEFT, CENTER); textSize(12);
    noStroke(); fill('#333'); text('Legend', x, y - 20);
    const sw = 18, sh = 14, g = 8;

    for (let i = 0; i < 6; i++) {
      const c = this.colors[i]; c.setAlpha(255);
      stroke('#777'); strokeWeight(1);
      fill(c); rect(x, y + i * (sh + g) - 6, sw, sh, 3);

      noStroke(); fill('#444'); textSize(11);
      const lo = (i === 0) ? this.bins[0] : this.bins[i];
      const hi = (i === 5) ? this.bins[5] : this.bins[i + 1];
      text(`${nf(lo, 1, 1)}–${nf(hi, 1, 1)}%`, x + sw + 10, y + i * (sh + g) + 2 - 6);
    }
  };

  this._drawTips = function () {
    const x = this.layout.rightMargin + 30;
    let y = this.layout.topMargin + 240;

    fill('#555'); textSize(11); noStroke(); textAlign(LEFT, TOP);

    text('• Click a region. • Shift+Click another to compare.', x, y);
    y += 14;
    text('• Click empty space to clear compare.', x, y);
    y += 14;
    text(' ← / → switch ethnicities  and  ↑/↓ toggle metric', x, y);
  };

  this._tooltip = function (h) {
    const vline = (this.metric === '% of region') ? `${nf(h.value1 || 0, 1, 1)}% of region`
      : `${nf(h.value2 || 0, 1, 1)}% of group`;
    const lines = [
      h.region,
      `${this.ethnicity}: ${vline}`,
      `Region pop: ${nfc(h.regionalPop || 0, 0)}`,
      `${this.ethnicity} in region: ${nfc(h.ethnicPop || 0, 0)}`
    ];

    if (this.picked && this.compare && h.region === this.picked) {
      const a = this._value(this.picked);
      const b = this._value(this.compare);
      const diff = a - b;
      lines.push(
        `${this.compare}: ${nf(b || 0, 1, 1)}%`,
        `Δ: ${nf(diff, 1, 1)} pp`
      );
    }

    textSize(12);
    let w = 0; for (const s of lines) w = max(w, textWidth(s));
    const pad = 8, bw = w + pad * 2, bh = lines.length * 18 + pad;
    let tx = constrain(mouseX + 16, 8, width - bw - 8), ty = constrain(mouseY - bh - 12, 8, height - bh - 8);
    noStroke(); fill(0, 40); rect(tx + 2, ty + 2, bw, bh, 7);
    stroke(0, 140); fill(255); rect(tx, ty, bw, bh, 7);
    noStroke(); fill(20); textAlign(LEFT, TOP);
    let yy = ty + 8; for (const s of lines) { text(s, tx + pad, yy); yy += 18; }
  };

  this.windowResized = function () { this._placeUI(); };
}
