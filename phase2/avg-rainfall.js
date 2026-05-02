function UKMonthlyRainfall() {
  this.name = 'UK Monthly Avg Rainfall per Year';
  this.id = 'uk-monthly-rainfall-radar';
  this.title = 'Monthly Avg Rainfall per Year (mm)';
  this.xAxisLabel = 'Month';
  this.yAxisLabel = 'Rainfall (mm)';

  const marginSize = 25;

  this.layout = {
    marginSize: marginSize,
    leftMargin: marginSize * 2,
    rightMargin: width - marginSize,
    topMargin: marginSize,
    bottomMargin: height - marginSize * 2,
    pad: 5,
    plotWidth() { return this.rightMargin - this.leftMargin; },
    plotHeight() { return this.bottomMargin - this.topMargin; },
    grid: true,
    numXTickLabels: 12,
    numYTickLabels: 5
  };

  this.loaded = false;
  this.months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  this.tableauColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
    '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
    '#bcbd22', '#17becf'
  ];

  this.colors = [];
  this.years = [];
  this.rainfallByYear = {};
  this.visibleYears = {};

  // animation + caching
  this.animYear = null;  // which year is currently animating in
  this.animT = 1;        // 0→1 progress for current animYear
  this.staticLayer = null;
  this.layerDirty = true;
  this.hoverMonth = 0;

  // UI
  this.buttonContainer = null;
  this.keyPanel = null;
  this.keyToggle = null;

  // canvas DOM ref for correct positioning
  this.canvasEl = null;

  // pill + autoplay state
  this.yearButtons = {};          // button element
  this.hexByYear = {};            // hex color
  this.autoplay = { on: true, index: 0 }; // reveal years one by one on load

  this.preload = function () {
    let self = this;
    this.data = loadTable('data/rainfall/avg_rainfall.csv', 'csv', 'header', () => {
      self.loaded = true;
    });
  };

  // helper to visually fill a pill left to right by pct (0–100) \
  this._stylePill = function (btn, hex, pct, active) {
    const bg = `linear-gradient(90deg, ${hex} ${pct}%, #cfd3d6 ${pct}%)`;
    btn.style('background', bg);
    btn.style('color', '#fff');
    btn.style('opacity', active ? '1' : '0.35');
  };

  this.setup = function () {
    if (!this.loaded) return;

    this.rainfallByYear = {};
    this.years = [];
    this.visibleYears = {};
    this.animYear = null;
    this.animT = 1;
    this.yearButtons = {};
    this.hexByYear = {};
    this.autoplay = { on: true, index: 0 };

    if (this.buttonContainer) this.buttonContainer.remove();
    if (this.keyPanel) this.keyPanel.remove();
    if (this.keyToggle) this.keyToggle.remove();

    // get the canvas to offset DOM elements correctly
    const sel = select('canvas');
    if (sel) this.canvasEl = sel.elt;

    this.buttonContainer = createDiv();
    this.buttonContainer.style('display', 'flex');
    this.buttonContainer.style('flex-direction', 'column');
    this.buttonContainer.style('align-items', 'flex-start');
    this.buttonContainer.style('gap', '8px');
    this.buttonContainer.style('padding', '20px 10px');
    this.buttonContainer.style('z-index', '10');
    this.buttonContainer.position(width + 250, height / 2 - 200);

    for (let r = 0; r < this.data.getRowCount(); r++) {
      const year = this.data.getString(r, 'Year');
      const period = this.data.getString(r, 'Period').toUpperCase();
      const type = this.data.getString(r, 'Type of period');
      const rainfall = this.data.getNum(r, 'Avg rainfall(in mm)');

      if (type !== 'Monthly') continue;

      if (!this.rainfallByYear[year]) {
        this.rainfallByYear[year] = new Array(12).fill(0);
        this.years.push(year);
        this.visibleYears[year] = false; // start hidden for autoplay

        const yearIndex = this.years.length - 1;
        const hexColor = this.tableauColors[yearIndex % this.tableauColors.length];
        this.hexByYear[year] = hexColor;

        const btn = createButton(year);
        btn.parent(this.buttonContainer);
        // pill styles
        btn.style('padding', '5px 14px');
        btn.style('margin', '5px');
        btn.style('border-radius', '20px');
        btn.style('font-size', '13px');
        btn.style('font-weight', 'bold');
        btn.style('border', 'none');
        btn.style('font-family', 'sans-serif');
        btn.style('cursor', 'pointer');
        btn.style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)');
        btn.style('transition', 'opacity 0.2s');
        // start empty fill
        this._stylePill(btn, hexColor, 0, false);

        this.yearButtons[year] = btn;

        btn.mousePressed(() => {
          // user interaction cancels autoplay
          this.autoplay.on = false;

          const wasVisible = this.visibleYears[year];
          this.visibleYears[year] = !wasVisible;
          if (this.visibleYears[year]) {
            this.animYear = year;
            this.animT = 0;
            this._stylePill(btn, hexColor, 0, true);
          } else {
            this.animYear = null;
            this.animT = 1;
            this._stylePill(btn, hexColor, 0, false);
            this.layerDirty = true;
          }
        });
      }

      const m = this.months.indexOf(period);
      if (m >= 0) this.rainfallByYear[year][m] = rainfall;
    }

    this.colors = this.years.map((_, i) => color(this.tableauColors[i % this.tableauColors.length]));
    this.staticLayer = createGraphics(width, height);
    this.layerDirty = true;

    // help panel + "?" toggle
    const S = (elt, obj) => Object.entries(obj).forEach(([k, v]) => elt.style(k, v));

    this.keyPanel = createDiv(`
      <div style="margin:6px 0"><b>Hover</b> near a spoke to focus that month. A single tooltip shows the closest point.</div>
      <div style="margin:6px 0"><b>Click a year pill</b> to show/hide a year.</div>
      <div style="margin:6px 0"><b>Tip:</b> Compare multiple years.</div>
    `);
    S(this.keyPanel, {
      position: 'absolute', width: '300px',
      background: 'rgba(255,255,255,0.92)', color: '#222',
      border: '1px solid rgba(0,0,0,0.08)', 'border-radius': '12px',
      padding: '12px 14px', 'box-shadow': '0 8px 20px rgba(0,0,0,.08)',
      'border-left': '4px solid #1f77b4', 'z-index': '12',
    });
    this.keyPanel.hide();

    this.keyToggle = createDiv('?');
    S(this.keyToggle, {
      position: 'absolute', width: '20px', height: '20px',
      'border-radius': '50%', background: 'linear-gradient(135deg,#1f77b4,#17becf)',
      color: '#fff', 'font-weight': '700', 'text-align': 'center',
      'line-height': '20px', 'font-size': '13px', cursor: 'pointer',
      'box-shadow': '0 2px 6px rgba(0,0,0,.2)', 'user-select': 'none',
    });

    this.keyToggle.mouseOver(() => this.keyPanel.show());
    this.keyToggle.mouseOut(() => this.keyPanel.hide());
    this.keyPanel.mouseOver(() => this.keyPanel.show());
    this.keyPanel.mouseOut(() => this.keyPanel.hide());

    // kick off autoplay on first hidden year
    this.animYear = this.years[0] || null;
    this.animT = this.animYear ? 0 : 1;
  };

  this.destroy = function () {
    if (this.buttonContainer) { this.buttonContainer.remove(); this.buttonContainer = null; }
    if (this.keyPanel) { this.keyPanel.remove(); this.keyPanel = null; }
    if (this.keyToggle) { this.keyToggle.remove(); this.keyToggle = null; }
    if (this.staticLayer) { this.staticLayer.remove(); this.staticLayer = null; }
  };

  // rebuild cached layer (all visible years except the one animating)
  this._rebuildStaticLayer = function (maxRadius, maxRainfall) {
    const g = this.staticLayer;
    g.clear();
    g.push();
    g.translate(width / 2 + 100, height / 2);

    g.strokeWeight(1.5);
    for (let i = 0; i < this.years.length; i++) {
      const year = this.years[i];
      if (!this.visibleYears[year]) continue;
      if (this.animYear === year) continue;

      const rainfall = this.rainfallByYear[year];
      const col = this.colors[i];
      g.fill(red(col), green(col), blue(col), 60);
      g.stroke(col);
      g.beginShape();
      for (let j = 0; j < 12; j++) {
        const a = radians((j * 360) / 12 - 90);
        const r = map(rainfall[j], 0, maxRainfall, 0, maxRadius);
        g.vertex(cos(a) * r, sin(a) * r);
      }
      g.endShape(CLOSE);
    }
    g.pop();
    this.layerDirty = false;
  };

  this.draw = function () {
    if (!this.loaded) return;

    background(255);
    this.drawTitle();

    // scale
    const maxRadius = min(this.layout.plotWidth(), this.layout.plotHeight()) * 0.4;
    let maxRainfall = 0;
    for (const y of this.years) maxRainfall = max(maxRainfall, Math.max(...this.rainfallByYear[y]));

    // autoplay
    if (this.autoplay.on && this.animYear == null) {
      while (this.autoplay.index < this.years.length &&
        this.visibleYears[this.years[this.autoplay.index]]) {
        this.autoplay.index++;
      }
      if (this.autoplay.index < this.years.length) {
        this.animYear = this.years[this.autoplay.index];
        this.animT = 0;
      } else {
        this.autoplay.on = false;
      }
    }

    // grid + labels
    push();
    translate(width / 2 + 100, height / 2);
    stroke(235, 235, 235);
    strokeWeight(0.6);
    noFill();

    for (let ring = 1; ring <= this.layout.numYTickLabels; ring++) {
      const radius = (ring / this.layout.numYTickLabels) * maxRadius;
      beginShape();
      for (let a = 0; a < 360; a += 30) vertex(cos(radians(a - 90)) * radius, sin(radians(a - 90)) * radius);
      endShape(CLOSE);
    }
    textSize(10); fill(50);
    for (let i = 0; i < 12; i++) {
      const ang = radians((i * 360) / 12 - 90);
      stroke(200);
      line(0, 0, cos(ang) * maxRadius, sin(ang) * maxRadius);
      noStroke(); textAlign(CENTER, CENTER);
      text(this.months[i], cos(ang) * (maxRadius + 10), sin(ang) * (maxRadius + 10));
    }
    pop();

    // static layer (all settled polygons)
    if (this.layerDirty) this._rebuildStaticLayer(maxRadius, maxRainfall);
    image(this.staticLayer, 0, 0);

    // animate only the toggled-on year
    push();
    translate(width / 2 + 100, height / 2);
    if (this.animYear) {
      const i = this.years.indexOf(this.animYear);
      const rainfall = this.rainfallByYear[this.animYear];
      const col = this.colors[i];

      // ease + progress
      this.animT = min(1, this.animT + 0.06);
      const ease = x => 1 - pow(1 - x, 3);
      const t = ease(this.animT);

      // polygon
      stroke(col); strokeWeight(1.8);
      fill(red(col), green(col), blue(col), 70);
      beginShape();
      for (let j = 0; j < 12; j++) {
        const a = radians((j * 360) / 12 - 90);
        const rFull = map(rainfall[j], 0, maxRainfall, 0, maxRadius);
        vertex(cos(a) * (t * rFull), sin(a) * (t * rFull));
      }
      endShape(CLOSE);

      // pill fill percentage
      const hex = this.hexByYear[this.animYear];
      const pct = floor(t * 100);
      this._stylePill(this.yearButtons[this.animYear], hex, pct, true);

      if (this.animT === 1) {
        // commit to static layer and advance autoplay
        this.visibleYears[this.animYear] = true;
        this.layerDirty = true;
        this.animYear = null;
        if (this.autoplay.on) this.autoplay.index++;
      }
    }
    pop();

    // nearest-point markers + single tooltip
    push();
    translate(width / 2 + 100, height / 2);
    const mx = mouseX - (width / 2 + 100);
    const my = mouseY - (height / 2);
    const angDeg = (degrees(atan2(my, mx)) + 450) % 360;
    this.hoverMonth = (round((angDeg / 360) * 12)) % 12;

    let best = null;
    for (let i = 0; i < this.years.length; i++) {
      const year = this.years[i];
      if (!this.visibleYears[year]) continue;
      const vals = this.rainfallByYear[year];
      const a = radians((this.hoverMonth * 360) / 12 - 90);
      const baseR = map(vals[this.hoverMonth], 0, maxRainfall, 0, maxRadius);
      const r = (this.animYear === year && this.animT < 1) ? (1 - pow(1 - this.animT, 3)) * baseR : baseR;
      const px = cos(a) * r, py = sin(a) * r;
      const d = dist(mx, my, px, py);
      if (best === null || d < best.d) best = { i, px, py, d, value: vals[this.hoverMonth] };
    }

    for (let i = 0; i < this.years.length; i++) {
      const year = this.years[i];
      if (!this.visibleYears[year]) continue;
      const vals = this.rainfallByYear[year];
      const a = radians((this.hoverMonth * 360) / 12 - 90);
      const r = map(vals[this.hoverMonth], 0, maxRainfall, 0, maxRadius);
      const px = cos(a) * r, py = sin(a) * r;
      noFill(); stroke(this.colors[i]); strokeWeight(1.2); circle(px, py, 10);
      noStroke(); fill(255); circle(px, py, 5);
    }

    if (best && best.d < 40) {
      const year = this.years[best.i];
      const label = `${this.months[this.hoverMonth]} ${year}: ${nf(best.value, 1, 1)} mm`;
      const vx = best.px, vy = best.py;
      const len = max(1, sqrt(vx * vx + vy * vy));
      const nx = vx / len, ny = vy / len, tx = -ny, ty = nx;
      const offX = nx * 28 + tx * 8, offY = ny * 28 + ty * 8;
      stroke(0, 90); strokeWeight(1);
      line(best.px, best.py, best.px + offX, best.py + offY);
      const tw = textWidth(label) + 14, th = 20;
      noStroke(); fill(0, 180);
      rect(best.px + offX + 8, best.py + offY - th / 2, tw, th, 4);
      fill(255); textAlign(LEFT, CENTER); textSize(12);
      text(label, best.px + offX + 15, best.py + offY);
    }
    pop();
  };

  this.drawTitle = function () {
    fill(0); noStroke();
    textAlign(CENTER, CENTER);
    textSize(18);

    const cx = (this.layout.plotWidth() / 2) + this.layout.leftMargin;
    const cy = this.layout.topMargin - (this.layout.marginSize / 2);
    text(this.title, cx, cy);

    // convert canvas coords to page coords
    let offLeft = 0, offTop = 0;
    if (this.canvasEl) {
      const rect = this.canvasEl.getBoundingClientRect();
      offLeft = rect.left + window.scrollX;
      offTop = rect.top + window.scrollY;
    }

    const tw = textWidth(this.title);
    const btnX = offLeft + cx + tw / 2 + 10;
    const btnY = offTop + cy - 10;

    if (this.keyToggle) this.keyToggle.position(btnX, btnY);
    if (this.keyPanel) this.keyPanel.position(btnX + 28, offTop + cy - 24);
  };
}
