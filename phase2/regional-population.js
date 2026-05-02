function UKPopulation() {
  this.name = 'UK Population Growth and Density Patterns';
  this.id = 'uk-population';
  this.title = 'Population Growth and Density Patterns in the UK';

  this.layout = {
    marginSize: 48,
    leftMargin: 90,
    rightMargin: width - 350,
    topMargin: 60,
    bottomMargin: height + 70,
    plotWidth() { return this.rightMargin - this.leftMargin; },
    plotHeight() { return this.bottomMargin - this.topMargin; }
  };

  const DATA_PATH = './data/population/UK Regional Population Data.csv';
  this.table = null;
  this.rows = [];
  this.level = 'Region';
  this.metric = 'Population';
  this.years = [2001, 2011, 2021];

  this.rotX = radians(40);
  this.rotY = radians(35);
  this.targetRotX = this.rotX;
  this.targetRotY = this.rotY;
  this.zoom = 1.0;
  this.targetZoom = 1.0;
  this.dragging = false;
  this.prevMouse = { x: 0, y: 0 };
  this.inertia = { vx: 0, vy: 0 };

  this.grid = { cellX: 42, cellZ: 28, gap: 12, barW: 32, barD: 18, maxH: 220 };
  this.revealT = 0; this.revealDur = 70;

  // UI
  this.selLevel = null;
  this.selMetric = null;

  // Hover
  this.hover = null;

  const YEAR_COLS = ['#9bbcff', '#7a9cf7', '#5679e4'];
  this.colForYear = (y) => {
    const i = this.years.indexOf(y);
    return color(YEAR_COLS[i < 0 ? 0 : i]);
  };

  this.preload = function () { this.table = loadTable(DATA_PATH, 'csv', 'header'); };

  this.setup = function () {
    textFont('Helvetica');
    frameRate(30);
    this._parseTable();
    this._buildUI();
    this._placeUI();
    this.revealT = 0;
  };

  this.destroy = function () {
    if (this.selLevel) { this.selLevel.remove(); this.selLevel = null; }
    if (this.selMetric) { this.selMetric.remove(); this.selMetric = null; }
  };

  // Data
  this._parseTable = function () {
    const rows = [];
    for (let r = 0; r < this.table.getRowCount(); r++) {
      const row = this.table.getRow(r);
      const geo = row.getString('Geography') || '';
      const name = row.getString('Name');
      if (!/Country|Region/i.test(geo)) continue;

      const pop21 = parseFloat(row.getString('Estimated Population mid-2021'));
      const den21 = parseFloat(row.getString('2021 people per sq. km'));
      const pop11 = parseFloat(row.getString('Estimated Population mid-2011'));
      const den11 = parseFloat(row.getString('2011 people per sq. km'));
      const pop01 = parseFloat(row.getString('Estimated Population mid-2001'));
      const den01 = parseFloat(row.getString('2001 people per sq. km'));

      rows.push({
        name, geo,
        data: {
          2001: { pop: pop01, den: den01 },
          2011: { pop: pop11, den: den11 },
          2021: { pop: pop21, den: den21 }
        }
      });
    }
    rows.sort((a, b) => (b.data[2021].pop || 0) - (a.data[2021].pop || 0));
    this.rowsAll = rows;
    this._applyFilter();
  };

  this._applyFilter = function () {
    const lvl = this.level.toLowerCase();
    this.rows = this.rowsAll.filter(r => r.geo.toLowerCase() === lvl);
    this._resetReveal();
  };

  // UI
  this._buildUI = function () {
    if (this.selLevel) this.selLevel.remove();
    if (this.selMetric) this.selMetric.remove();

    this.selLevel = createSelect();
    this.selLevel.option('Region'); this.selLevel.option('Country');
    this.selLevel.selected(this.level);
    this.selLevel.changed(() => { this.level = this.selLevel.value(); this._applyFilter(); });

    this.selMetric = createSelect();
    this.selMetric.option('Population'); this.selMetric.option('Density');
    this.selMetric.selected(this.metric);
    this.selMetric.changed(() => { this.metric = this.selMetric.value(); this._resetReveal(); });

    [this.selLevel, this.selMetric].forEach(el => {
      el.style('position', 'absolute');
      el.style('padding', '8px');
      el.style('border', '1px solid #ccd1d9');
      el.style('border-radius', '8px');
      el.style('background', '#fff');
      el.style('font-size', '12px');
      el.style('box-shadow', '0 1px 3px rgba(0,0,0,0.06)');
      el.style('z-index', '10');
    });
  };

  // Place UI relative to the canvas
  this._placeUI = function () {
    const cnv = document.querySelector('canvas');
    if (!cnv || !this.selLevel || !this.selMetric) return;

    const rect = cnv.getBoundingClientRect();
    const pageLeft = rect.left + window.scrollX;
    const pageTop = rect.top + window.scrollY;

    const legendColX = this.layout.rightMargin - 5;
    const safePadRight = 30;

    const x = pageLeft + legendColX + safePadRight;
    const y = pageTop + (this.layout.topMargin - 14);

    this.selLevel.position(x, y);
    this.selMetric.position(x, y + 40);
  };

  this._resetReveal = function () { this.revealT = 0; };

  // Interaction
  this._handleCamera = function () {
    if (mouseIsPressed && this._inPlot(mouseX, mouseY)) {
      if (!this.dragging) {
        this.dragging = true; this.prevMouse.x = mouseX; this.prevMouse.y = mouseY;
      } else {
        const dx = mouseX - this.prevMouse.x;
        const dy = mouseY - this.prevMouse.y;
        this.targetRotY += dx * 0.01; this.targetRotX += dy * 0.01;
        this.prevMouse.x = mouseX; this.prevMouse.y = mouseY;
        this.inertia.vx = dx * 0.003; this.inertia.vy = dy * 0.003;
      }
    } else {
      this.dragging = false;
      this.targetRotY += this.inertia.vx; this.targetRotX += this.inertia.vy;
      this.inertia.vx *= 0.94; this.inertia.vy *= 0.94;
    }
    this.rotX += (this.targetRotX - this.rotX) * 0.15;
    this.rotY += (this.targetRotY - this.rotY) * 0.15;
    this.zoom += (this.targetZoom - this.zoom) * 0.15;
    this.targetRotX = constrain(this.targetRotX, radians(10), radians(80));
  };

  this.mouseWheel = function (e) {
    this.targetZoom = constrain(this.targetZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.7, 1.6);
    return false;
  };

  this._inPlot = function (mx, my) {
    return mx >= this.layout.leftMargin && mx <= this.layout.rightMargin &&
      my >= this.layout.topMargin && my <= this.layout.bottomMargin;
  };

  // 3D Projection
  this._projectPoint = function (px, py, pz) {
    const cx = cos(this.rotX), sx = sin(this.rotX);
    const cy = cos(this.rotY), sy = sin(this.rotY);

    let y = py * cx - pz * sx;
    let z = py * sx + pz * cx;
    let x = px;

    const x2 = x * cy + z * sy;
    const z2 = -x * sy + z * cy;

    const dist = 900;
    const perspective = dist / (dist - z2);
    const s = this.zoom * perspective;

    const cx2 = this.layout.leftMargin + this.layout.plotWidth() / 2;
    const cy2 = this.layout.topMargin + this.layout.plotHeight() / 2;

    return { x: cx2 + x2 * s, y: cy2 - y * s, s };
  };

  this._barVertsAndFaces = function (cx, cz, h) {
    const w = this.grid.barW, d = this.grid.barD;
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const y0 = 0, y1 = h;
    const V = [
      { x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 },
      { x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }
    ].map(p => this._projectPoint(p.x, p.y, p.z));
    const faces = { top: [4, 5, 6, 7], right: [1, 2, 6, 5], front: [2, 3, 7, 6], left: [0, 3, 7, 4] };
    return { V, faces };
  };

  this._drawBar = function (cx, cz, h, col) {
    const { V, faces } = this._barVertsAndFaces(cx, cz, h);

    const base = color(col);
    const cTop = color(red(base), green(base), blue(base), 220);
    const cRight = lerpColor(base, color(0), 0.15);
    const cFront = lerpColor(base, color(0), 0.25);
    const cLeft = lerpColor(base, color(0), 0.35);

    noStroke();
    fill(cLeft); this._quad(V, faces.left);
    fill(cFront); this._quad(V, faces.front);
    fill(cRight); this._quad(V, faces.right);
    fill(cTop); this._quad(V, faces.top);

    return { V, faces };
  };

  this._quad = function (V, idx) { beginShape(); for (let i of idx) vertex(V[i].x, V[i].y); endShape(CLOSE); };

  this._pointInQuad = function (V, idx, mx, my) {
    const a = V[idx[0]], b = V[idx[1]], c = V[idx[2]], d = V[idx[3]];
    return this._pointInTri(a, b, c, mx, my) || this._pointInTri(a, c, d, mx, my);
  };
  this._pointInTri = function (p1, p2, p3, mx, my) {
    const s = (p1.x - p3.x) * (my - p3.y) - (p1.y - p3.y) * (mx - p3.x);
    const t = (p2.x - p1.x) * (my - p1.y) - (p2.y - p1.y) * (mx - p1.x);
    const u = (p3.x - p2.x) * (my - p2.y) - (p3.y - p2.y) * (mx - p2.x);
    const hasNeg = (s < 0) || (t < 0) || (u < 0);
    const hasPos = (s > 0) || (t > 0) || (u > 0);
    return !(hasNeg && hasPos);
  };

  // Draw
  this.draw = function () {
    background(255);
    this._handleCamera();
    this._placeUI();          // keep dropdowns aligned every frame
    this._drawTitle();

    const domainMax = this._domainMax(this.rows);
    this._drawAxesFloor();

    if (this.revealT < 1) this.revealT += 1 / this.revealDur;
    const T = 1 - pow(1 - this.revealT, 3);

    const n = this.rows.length;
    const cols = min(n, 12);
    const rowsN = ceil(n / cols);
    const startX = -((cols - 1) * (this.grid.cellX + this.grid.gap)) / 2;
    const startZ = -((rowsN - 1) * (this.grid.cellZ * 4 + this.grid.gap)) / 2;

    this.hover = null;

    let lastLabelX = -1e9;
    const labelMinDist = 40;

    for (let i = 0; i < n; i++) {
      const r = this.rows[i];
      const gx = i % cols;
      const gz = floor(i / cols);

      const baseX = startX + gx * (this.grid.cellX + this.grid.gap);
      const baseZ = startZ + gz * (this.grid.cellZ * 4 + this.grid.gap);

      let tallestH = 0;

      for (let yi = 0; yi < this.years.length; yi++) {
        const year = this.years[yi];
        const v = this.metric === 'Population' ? (r.data[year].pop || 0) : (r.data[year].den || 0);
        const h = this._mapHeight(v, domainMax) * T;
        tallestH = max(tallestH, h);

        const cz = baseZ + (yi - 1) * this.grid.cellZ;
        const col = this.colForYear(year);

        const { V, faces } = this._drawBar(baseX, cz, h, col);

        if (v > 0 && (
          this._pointInQuad(V, faces.top, mouseX, mouseY) ||
          this._pointInQuad(V, faces.front, mouseX, mouseY) ||
          this._pointInQuad(V, faces.right, mouseX, mouseY)
        )) {
          this.hover = { name: r.name, year, value: v, pop: r.data[year].pop, density: r.data[year].den };
        }
      }

      // label above tallest bar
      const labelAnchor = this._projectPoint(baseX, tallestH + 8, baseZ);
      if (abs(labelAnchor.x - lastLabelX) >= labelMinDist) {
        const txt = r.name; textSize(10);
        const tw = textWidth(txt), padX = 6, padY = 3;

        noStroke(); fill(0, 35); rect(labelAnchor.x - tw / 2 - padX + 2, labelAnchor.y - 10 + 2, tw + 2 * padX, 16, 8);
        stroke(220); fill(255); rect(labelAnchor.x - tw / 2 - padX, labelAnchor.y - 10, tw + 2 * padX, 16, 8);
        noStroke(); fill('#222'); textAlign(CENTER, CENTER); text(txt, labelAnchor.x, labelAnchor.y - 2);

        lastLabelX = labelAnchor.x;
      }
    }

    this._drawLegend();
    if (this.hover) this._drawTooltip(this.hover);
  };

  // Helpers
  this._domainMax = function (rows) {
    let maxV = 0;
    for (const r of rows) for (const y of this.years) {
      const v = (this.metric === 'Population') ? (r.data[y].pop || 0) : (r.data[y].den || 0);
      if (v > maxV) maxV = v;
    }
    return maxV || 1;
  };

  this._mapHeight = function (v, maxV) { return this.grid.maxH * (v / maxV); };

  this._drawTitle = function () {
    noStroke(); fill('#222'); textAlign(CENTER, CENTER);
    textSize(18);
    text(this.title, (this.layout.leftMargin + this.layout.rightMargin) / 2, this.layout.topMargin - this.layout.marginSize);
    textSize(12); fill('#555');
    text(`${this.level}s • Metric: ${this.metric} • Years: ${this.years.join(', ')}`,
      (this.layout.leftMargin + this.layout.rightMargin) / 2,
      this.layout.topMargin - this.layout.marginSize + 22);
  };

  this._drawAxesFloor = function () {
    const W = this.layout.plotWidth() * 0.86;
    const H = this.layout.plotHeight() * 0.7;

    const floorPts = [
      { x: -W / 2, y: 0, z: -H / 3 }, { x: W / 2, y: 0, z: -H / 3 },
      { x: W / 2, y: 0, z: H / 3 }, { x: -W / 2, y: 0, z: H / 3 }
    ].map(p => this._projectPoint(p.x, p.y, p.z));

    noStroke(); fill(245);
    beginShape(); floorPts.forEach(p => vertex(p.x, p.y)); endShape(CLOSE);

    stroke('#cfd3da'); strokeWeight(1);
    this._axis3D(-W / 2, 0, -H / 3, W / 2, 0, -H / 3);
    this._axis3D(-W / 2, 0, -H / 3, -W / 2, 0, H / 3);

    for (let yi = 0; yi < this.years.length; yi++) {
      const z = (yi - 1) * this.grid.cellZ;
      this._axis3D(-W / 2, 0, z, W / 2, 0, z);
      const lab = this._projectPoint(-W / 2 - 40, 0, z);
      noStroke(); fill('#666'); textSize(11); textAlign(RIGHT, CENTER);
      text(this.years[yi], lab.x, lab.y);
    }
  };

  this._axis3D = function (x0, y0, z0, x1, y1, z1) {
    const a = this._projectPoint(x0, y0, z0);
    const b = this._projectPoint(x1, y1, z1);
    line(a.x, a.y, b.x, b.y);
  };

  this._drawLegend = function () {
    const x = this.layout.rightMargin + 30;
    let y = this.layout.topMargin + 80;

    textAlign(LEFT, CENTER); textSize(12);
    noStroke(); fill('#333'); text('Years', x, y); y += 16;
    for (let i = 0; i < this.years.length; i++) {
      const col = this.colForYear(this.years[i]); col.setAlpha(220);
      fill(col); rect(x, y - 6, 14, 14, 3);
      noStroke(); fill('#444'); text(this.years[i], x + 20, y);
      y += 20;
    }


    fill('#555'); textSize(11);
    text('• Drag to rotate', x, y); y += 14;
  };

  this._drawTooltip = function (h) {
    const lines = [
      `${h.name}`,
      `${h.year}: ${this.metric === 'Population' ? `Pop ${nfc(h.pop || 0, 0)}` : `Density ${nfc(h.density || 0, 1)}/km²`}`,
      this.metric === 'Population'
        ? `Density: ${isFinite(h.density) ? nfc(h.density, 1) : '–'}/km²`
        : `Pop: ${isFinite(h.pop) ? nfc(h.pop, 0) : '–'}`
    ];

    textSize(12);
    let w = 0; for (let s of lines) w = max(w, textWidth(s));
    const pad = 8, boxW = w + pad * 2, boxH = lines.length * 18 + pad;

    let tx = constrain(mouseX + 14, 8, width - boxW - 8);
    let ty = constrain(mouseY - boxH - 12, 8, height - boxH - 8);

    noStroke(); fill(0, 40); rect(tx + 2, ty + 2, boxW, boxH, 7);
    stroke(0, 140); fill(255); rect(tx, ty, boxW, boxH, 7);

    noStroke(); fill(20); textAlign(LEFT, TOP);
    let yy = ty + 8; for (let s of lines) { text(s, tx + pad, yy); yy += 18; }
  };

  // Keep UI aligned when window resizes
  this.windowResized = function () { this._placeUI(); };
}
