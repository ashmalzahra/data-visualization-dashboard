function VehicleAgeImpact() {
  this.name = 'UK Vehicle Age by Point of Impact';
  this.id = 'vehicle-age-impact';

  this.title = 'Vehicle Age by Point of Impact';
  this.subtitle = 'Each box shows the age range of vehicles involved in collisions by impact point';
  this.yAxisLabel = 'Vehicle Age at Time of Collision';

  this.impactOrder = ['Front', 'Offside', 'Back', 'Nearside', 'Did not impact'];
  this.loaded = false;

  this.layout = {
    leftMargin: 100,
    rightMargin: width - 60,
    topMargin: 100,
    bottomMargin: height - 100,
    baseBoxWidth: 50,
    numYTickLabels: 5,
    plotWidth() { return this.rightMargin - this.leftMargin; },
    plotHeight() { return this.bottomMargin - this.topMargin; }
  };

  this.boxData = {};
  this.hoveredBox = null;
  this.pins = new Map();

  // Compare-median state
  this.compare = { A: null, B: null };
  this._clearCompareBtn = null;

  this._wasMouseDown = false;
  this._wasKeyDown = false;
  this.hoverAnim = {};
  this.anim = { start: 0, dur: 900, t: 0, started: false };

  this.impactColors = {
    'Front': color('#4C78A8'),
    'Offside': color('#F58518'),
    'Back': color('#E45756'),
    'Nearside': color('#72B7B2'),
    'Did not impact': color('#54A24B')
  };

  // Data loading
  this.preload = function () {
    let self = this;
    this.data = loadTable('./data/vehicle/vehicle-data.csv', 'csv', 'header', () => self.loaded = true);
  };

  // Setup
  this.setup = function () {
    this.boxData = {};
    this.pins.clear();
    this.compare = { A: null, B: null };
    this.hoverAnim = {};

    // Build raw arrays per impact
    for (let row of this.data.rows) {
      const impact = row.getString('X1st_Point_of_Impact');
      if (!this.impactOrder.includes(impact)) continue;

      const ageStr = row.getString('Age_of_Vehicle');
      const age = parseVehicleAge(ageStr);
      if (age == null || isNaN(age)) continue;

      (this.boxData[impact] ||= []).push(age);
    }

    // Compute per-impact stats
    for (let impact in this.boxData) {
      let arr = this.boxData[impact].slice().sort((a, b) => a - b);
      if (arr.length === 0) continue;

      const q1 = quantile(arr, 0.25);
      const q3 = quantile(arr, 0.75);
      const iqr = q3 - q1;

      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      const outliers = arr.filter(v => v < lowerFence || v > upperFence);

      this.boxData[impact] = {
        min: arr[0],
        q1,
        median: quantile(arr, 0.5),
        q3,
        max: arr[arr.length - 1],
        raw: arr,
        outliers
      };
      this.hoverAnim[impact] = 0;
    }

    // y max from all raw ages (rounded up to nearest 5)
    let allAges = [];
    for (let impact in this.boxData) allAges = allAges.concat(this.boxData[impact].raw);
    this.maxY = allAges.length ? Math.ceil(max(allAges) / 5) * 5 : 10;

    this.anim.started = false;
  };

  this.destroy = function () { };

  // Draw
  this.draw = function () {
    if (!this.loaded) return;

    if (!this.anim.started) { this.anim.start = millis(); this.anim.t = 0; this.anim.started = true; }
    this.anim.t = constrain((millis() - this.anim.start) / this.anim.dur, 0, 1);
    const t = easeOutCubic(this.anim.t);

    background(255);
    this.drawTitle();

    // grid + y labels
    textSize(12);
    stroke(220);
    for (let i = 0; i <= this.layout.numYTickLabels; i++) {
      let val = (i * this.maxY) / this.layout.numYTickLabels;
      let y = map(val, 0, this.maxY, this.layout.bottomMargin, this.layout.topMargin);
      line(this.layout.leftMargin - 5, y, this.layout.rightMargin, y);
      noStroke(); fill(0); textAlign(RIGHT, CENTER);
      text(`${nf(val, 1, 0)} yrs`, this.layout.leftMargin - 10, y);
    }

    // y-axis label
    push();
    translate(this.layout.leftMargin - 70, height / 2);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    textSize(13);
    fill(0);
    text(this.yAxisLabel, 0, 0);
    pop();

    // Controls (pins + compare)
    this.drawKeyAndControls();

    let spacing = this.layout.plotWidth() / (this.impactOrder.length + 1);
    this.hoveredBox = null;

    // deterministic jitter base
    randomSeed(7);

    // Outlier hover info
    let hoveredOutlier = null;

    const positions = {};

    for (let i = 0; i < this.impactOrder.length; i++) {
      const impact = this.impactOrder[i];
      const data = this.boxData[impact];
      if (!data) continue;

      const x = this.layout.leftMargin + (i + 1) * spacing;

      const yMed = this.mapY(data.median);
      const yMin = lerp(yMed, this.mapY(data.min), t);
      const yMax = lerp(yMed, this.mapY(data.max), t);
      const yQ1 = lerp(yMed, this.mapY(data.q1), t);
      const yQ3 = lerp(yMed, this.mapY(data.q3), t);

      positions[impact] = { x, yMed };

      const baseW = this.layout.baseBoxWidth;
      const isHover = mouseX > x - baseW / 2 && mouseX < x + baseW / 2 && mouseY > yQ3 && mouseY < yQ1;

      // hover animation
      const target = isHover ? 1 : 0;
      this.hoverAnim[impact] = lerp(this.hoverAnim[impact], target, 0.18);
      const h = this.hoverAnim[impact];

      if (h > 0.05) {
        stroke(235);
        line(x, this.layout.topMargin - 10, x, this.layout.bottomMargin + 10);
      }

      // whiskers
      stroke(0, 150); strokeWeight(1.25);
      line(x, yMin, x, yMax);
      line(x - 10, yMin, x + 10, yMin);
      line(x - 10, yMax, x + 10, yMax);

      const w = baseW + 8 * h;
      noStroke();
      const col = this.impactColors[impact];
      const fillCol = lerpColor(col, color(255), 0.25 * h);
      fill(fillCol);
      rect(x - w / 2, yQ3, max(1, w), max(1, yQ1 - yQ3), 5);
      if (h > 0.01) { noFill(); stroke(fillCol); strokeWeight(2.5 * h + 0.5); rect(x - w / 2, yQ3, w, max(1, yQ1 - yQ3), 5); }

      // median
      stroke(255); strokeWeight(2);
      line(x - w / 2, yMed, x + w / 2, yMed);

      if ((this.compare.A && this.compare.A.impact === impact) ||
        (this.compare.B && this.compare.B.impact === impact)) {
        noStroke();
        fill(col);
        ellipse(x, yMed, 10, 10);
        stroke(col); noFill();
        ellipse(x, yMed, 16, 16);
      }

      // outliers
      noStroke();
      const time = millis() / 1000;
      for (let oi = 0; oi < data.outliers.length; oi++) {
        const o = data.outliers[oi];
        const baseY = this.mapY(o);

        const phase = (i * 97 + oi * 53) % 1000;
        const breathe = 1 + 0.25 * sin(time * 2 + phase);
        const orbitR = 1 + 0.8 * (1 - t);
        const ox = x + orbitR * cos(time * 1.5 + phase);
        const oy = lerp(yMed, baseY, t) + orbitR * sin(time * 1.5 + phase);

        const isOHover = dist(mouseX, mouseY, ox, oy) < 8;
        if (isOHover) hoveredOutlier = { x: ox, y: oy, val: o, impact };

        fill(0, isOHover ? 200 : 115);
        const d = (6 + 2 * h) * breathe * (isOHover ? 1.2 : 1);
        ellipse(ox, oy, d, d);
        if (isOHover) { stroke(0, 60); noFill(); ellipse(ox, oy, d + 6, d + 6); noStroke(); }
      }

      // label
      noStroke(); fill(0); textAlign(CENTER, CENTER); textSize(12);
      text(impact, x, this.layout.bottomMargin + 20);

      if (isHover) {
        this.hoveredBox = {
          x, yQ1, yQ3, impact,
          min: data.min, q1: data.q1, median: data.median, q3: data.q3, max: data.max,
          yMed
        };
      }

      // pinned tooltip
      if (this.pins.has(impact)) {
        const pin = this.pins.get(impact);
        this.drawTooltip(pin.tx, pin.ty, this.tipLines(pin));
      }
    }

    // live tooltips
    if (hoveredOutlier) {
      const tx = constrain(hoveredOutlier.x + 10, 0, width - 140);
      const ty = constrain(hoveredOutlier.y - 18, 0, height - 50);
      this.drawTooltip(tx, ty, [
        `Outlier (${hoveredOutlier.impact})`,
        `${nf(hoveredOutlier.val, 1, 1)} yrs`
      ], 140);
    } else if (this.hoveredBox) {
      const tip = this.hoveredBox;
      let tx = constrain(mouseX + 12, 0, width - 190);
      let ty = constrain(mouseY - 70, 0, height - 120);
      this.drawTooltip(tx, ty, this.tipLines(tip));
    }

    // Compare overlay
    if (this.compare.A && this.compare.B) {
      const A = this.compare.A;
      const B = this.compare.B;

      // median connectors
      stroke(0, 90); strokeWeight(1.5);
      line(A.x, A.yMed, B.x, B.yMed);

      noStroke();
      fill(this.impactColors[A.impact]); ellipse(A.x, A.yMed, 10, 10);
      fill(this.impactColors[B.impact]); ellipse(B.x, B.yMed, 10, 10);

      // label centered between medians
      const midX = (A.x + B.x) / 2;
      const midY = (A.yMed + B.yMed) / 2;
      const delta = (A.median - B.median);
      const label = `Δ median (${A.impact} – ${B.impact}): ${nf(delta, 1, 2)} yrs`;
      const w = max(210, textWidth(label) + 24);

      this.drawTooltip(midX - w / 2, midY - 48, [label], w);
    }

    // clicks
    const justClicked = mouseIsPressed && !this._wasMouseDown;
    const shiftHeld = keyIsDown(16);
    if (justClicked) {
      if (this._inBtn(this._clearBtn)) {
        this.pins.clear();
      } else if (this._inBtn(this._clearCompareBtn)) {
        this.compare = { A: null, B: null };
      } else if (this.hoveredBox) {
        if (shiftHeld) {
          const d = this.hoveredBox;
          const snap = {
            impact: d.impact,
            median: d.median,
            x: d.x,
            yMed: d.yMed
          };
          if (!this.compare.A || (this.compare.A && this.compare.A.impact === d.impact)) {
            this.compare.A = snap;
            this.compare.B = this.compare.B && this.compare.B.impact === d.impact ? null : this.compare.B;
          } else if (!this.compare.B || (this.compare.B && this.compare.B.impact === d.impact)) {
            this.compare.B = snap;
          } else {
            this.compare.B = snap;
          }
        } else {
          const key = this.hoveredBox.impact;
          if (this.pins.has(key)) this.pins.delete(key);
          else {
            const tx = constrain(mouseX + 12, 0, width - 190);
            const ty = constrain(mouseY - 70, 0, height - 120);
            this.pins.set(key, { ...this.hoveredBox, tx, ty });
          }
        }
      }
    }
    this._wasMouseDown = mouseIsPressed;

    // keys: C clears pins (existing)
    const keyDown = keyIsPressed && (key === 'c' || key === 'C');
    if (keyDown && !this._wasKeyDown) this.pins.clear();
    this._wasKeyDown = keyDown;
  };

  // UI

  this.drawKeyAndControls = function () {
    // Clear Pins pill
    const bx = this.layout.rightMargin - 120;
    const by = this.layout.topMargin - 30;
    const bw = 110;
    const bh = 26;
    const hoverPins = this._inRect(bx, by, bw, bh);
    this._clearBtn = { x: bx, y: by, w: bw, h: bh };

    stroke(hoverPins ? color(0, 0, 0, 70) : color(0, 0, 0, 40));
    fill(hoverPins ? color(255) : color(252));
    rect(bx, by, bw, bh, 14);
    noStroke();
    fill(0);
    ellipse(bx + 16, by + bh / 2, 14, 14);
    stroke(255); strokeWeight(2);
    line(bx + 12, by + bh / 2, bx + 20, by + bh / 2);
    noStroke(); fill(0); textSize(11); textAlign(LEFT, CENTER);
    text('Clear Pins', bx + 32, by + bh / 2);

    // key
    const ky = by + bh + 16;
    const kh = 30;
    noStroke();
    fill(0); textSize(9); textAlign(CENTER, CENTER);
    text(
      'Click to freeze/unpin • Press button or C to clear',
      bx + bw / 2,
      ky + kh / 2
    );

    // Clear Compare pill
    const cbx = bx - 140 - 10;
    const cby = by;
    const cbw = 140;
    const cbh = 26;
    const hoverCmp = this._inRect(cbx, cby, cbw, cbh);
    this._clearCompareBtn = { x: cbx, y: cby, w: cbw, h: cbh };

    stroke(hoverCmp ? color(0, 0, 0, 70) : color(0, 0, 0, 40));
    fill(hoverCmp ? color(255) : color(252));
    rect(cbx, cby, cbw, cbh, 14);
    noStroke(); fill(0); textSize(11); textAlign(CENTER, CENTER);
    text('Clear Compare', cbx + cbw / 2, cby + cbh / 2);

    fill(0); textSize(9);
    text('Shift+Click two boxes to compare medians', cbx + cbw / 2, cby + cbh + 18);
  };

  this._inBtn = function (b) { return this._inRect(b.x, b.y, b.w, b.h); };
  this._inRect = function (x, y, w, h) {
    return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  };

  this.drawTitle = function () {
    textAlign(CENTER, CENTER); fill(0);
    textSize(18); text(this.title, width / 2, this.layout.topMargin - 70);
    textSize(13); text(this.subtitle, width / 2, this.layout.topMargin - 45);
  };

  // Tooltip
  this.drawTooltip = function (tx, ty, lines, w) {
    const widthBox = w || 190;
    const h = lines.length * 18 + 10;

    // subtle edge mask
    stroke(255);
    strokeWeight(2);
    noFill();
    rect(tx - 1, ty - 1, widthBox + 2, h + 2, 7);

    // translucent tooltip
    stroke(0, 180);
    strokeWeight(1.5);
    strokeJoin(ROUND);
    fill(255, 235);
    rect(tx, ty, widthBox, h, 7);

    noStroke();
    fill(0);
    textAlign(LEFT, TOP);
    textSize(11);
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], tx + 8, ty + 5 + i * 18);
    }
  };

  this.tipLines = function (tip) {
    return [
      `Impact: ${tip.impact}`,
      `Min: ${nf(tip.min, 1, 1)} yrs`,
      `Q1: ${nf(tip.q1, 1, 1)} yrs`,
      `Median: ${nf(tip.median, 1, 1)} yrs`,
      `Q3: ${nf(tip.q3, 1, 1)} yrs`,
      `Max: ${nf(tip.max, 1, 1)} yrs`
    ];
  };

  this.mapY = function (val) {
    return constrain(map(val, 0, this.maxY, this.layout.bottomMargin, this.layout.topMargin),
      this.layout.topMargin, this.layout.bottomMargin);
  };
}

// Helpers
function parseVehicleAge(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();

  if (s === '' || s.toLowerCase() === 'unknown') return null;

  // remove chars except spaces
  const clean = s.replace(/[^\d\-\.\s–—]/g, '');

  // detect range
  const rangeMatch = clean.match(/(-?\d+(\.\d+)?)\s*[–—-]\s*(-?\d+(\.\d+)?)/);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]);
    const b = parseFloat(rangeMatch[3]);
    if (isFinite(a) && isFinite(b)) {
      const mid = (a + b) / 2;
      if (isUnknownCode(mid)) return null;
      return mid;
    }
  }

  // fallback
  const numMatch = clean.match(/-?\d+(\.\d+)?/);
  if (numMatch) {
    const v = parseFloat(numMatch[0]);
    if (isUnknownCode(v)) return null;
    // ages less than 0 are invalid; very large (>= 100) treated as code → drop
    if (v < 0 || v >= 100) return null;
    return v;
  }

  return null;
}

function isUnknownCode(v) {
  // common codes used for "unknown/NA" in transport datasets
  return v === -1 || v === 97 || v === 98 || v === 99;
}

// Linear interpolation quantile
function quantile(arr, q) {
  if (!arr.length) return NaN;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + (arr[base + 1] - arr[base]) * rest;
  }
  return arr[base];
}

function easeOutCubic(x) { return 1 - pow(1 - x, 3); }
