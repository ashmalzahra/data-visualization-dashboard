function UKFoodSpending() {
  this.name = 'Bread vs Meat Spending: UK 1997–2022';
  this.id = 'uk-food-spending';
  this.title = 'Bread and Cereals vs Meat Spending';
  this.xAxisLabel = 'Bread and Cereals (£m)';
  this.yAxisLabel = 'Meat (£m)';

  let marginSize = 40;

  this.layout = {
    marginSize,
    leftMargin: marginSize * 2,
    rightMargin: width - marginSize,
    topMargin: marginSize * 2,
    bottomMargin: height - marginSize * 2,
    plotWidth() { return this.rightMargin - this.leftMargin; },
    plotHeight() { return this.bottomMargin - this.topMargin; },
    numXTickLabels: 6,
    numYTickLabels: 6
  };

  this.loaded = false;
  this.hovered = null;
  this.pointSize = 12;
  this.lineAlpha = 35;

  // Legend state for continuous range filter
  this.legend = { x: 0, y: 0, w: 120, h: 12 };
  this.isDraggingLegend = false;
  this.dragStartYear = null;
  this.dragEndYear = null;
  this.filter = null;         // minYear, maxYear or null
  this._wasMousePressed = false;
  this._lastClickTime = 0;

  this.preload = function () {
    const self = this;
    this.data = loadTable('./data/consumer/uk_food_trends.csv', 'csv', 'noHeader',
      () => { self.loaded = true; });
  };

  this.setup = function () {
    textFont('Helvetica');
    textSize(14);

    const headerRow = this.data.getRow(0).arr;
    this.breadIndex = headerRow.findIndex(h => h.trim() === 'Bread and cereals');
    this.meatIndex = headerRow.findIndex(h => h.trim() === 'Meat');

    const yrGuess = headerRow.findIndex(h => /year|time/i.test(h));
    this.yearIndex = yrGuess >= 0 ? yrGuess : 0;

    // Parse rows
    this.valid = [];
    for (let i = 3; i < this.data.getRowCount(); i++) {
      const row = this.data.getRow(i).arr;
      const bread = parseFloat(String(row[this.breadIndex]).replace(/,/g, ''));
      const meat = parseFloat(String(row[this.meatIndex]).replace(/,/g, ''));
      const year = parseInt(row[this.yearIndex], 10);
      if (!isNaN(bread) && !isNaN(meat)) {
        this.valid.push({ bread, meat, year: isNaN(year) ? (1997 + (i - 3)) : year, idx: i - 3 });
      }
    }

    this.minBread = min(this.valid.map(r => r.bread));
    this.maxBread = max(this.valid.map(r => r.bread));
    this.minMeat = min(this.valid.map(r => r.meat));
    this.maxMeat = max(this.valid.map(r => r.meat));

    // Medians for quadrant split
    const breads = this.valid.map(v => v.bread).sort((a, b) => a - b);
    const meats = this.valid.map(v => v.meat).sort((a, b) => a - b);
    const midB = floor(breads.length / 2), midM = floor(meats.length / 2);
    this.medianBread = breads.length % 2 ? breads[midB] : (breads[midB - 1] + breads[midB]) / 2;
    this.medianMeat = meats.length % 2 ? meats[midM] : (meats[midM - 1] + meats[midM]) / 2;

    // Year bounds
    this.minYear = min(this.valid.map(v => v.year));
    this.maxYear = max(this.valid.map(v => v.year));

    this.revealIndex = 1;
  };

  this.destroy = function () { };

  this.draw = function () {
    if (!this.loaded) return;

    background(255);
    this.drawGridlines();
    this.drawQuadrants();   // pastel background split
    this.drawTitle();
    this.drawAxes();

    // Legend position
    this.legend.x = this.layout.rightMargin - 160;
    this.legend.y = this.layout.topMargin - 24;

    // Legend animation
    const total = this.valid.length;
    const limit = min(this.revealIndex, total);
    const progress = constrain(limit / total, 0, 1);
    this.drawKey();
    this.drawLegend(progress);

    // Map points
    let pts = [];
    for (let i = 0; i < limit; i++) {
      const r = this.valid[i];
      pts.push({
        x: this.mapBreadToX(r.bread),
        y: this.mapMeatToY(r.meat),
        bread: r.bread,
        meat: r.meat,
        year: r.year,
        idx: r.idx
      });
    }

    // Chronological line
    if (pts.length > 1) {
      stroke(60, 60, 80, this.lineAlpha);
      strokeWeight(2);
      noFill();
      beginShape();
      for (let p of pts) vertex(p.x, p.y);
      endShape();
    }

    // Hover
    this.hovered = null;
    for (let p of pts) {
      if (dist(mouseX, mouseY, p.x, p.y) <= this.pointSize * 0.7) { this.hovered = p; break; }
    }

    // Draw points with filter fade and hover emphasis
    for (let p of pts) {
      const inter = map(p.idx, 0, total - 1, 0, 1);
      const baseCol = lerpColor(color('#D4A5FF'), color('#3C1361'), inter);
      const isHover = this.hovered && this.hovered.idx === p.idx;

      let alpha = 255;
      if (this.filter && (p.year < this.filter.minYear || p.year > this.filter.maxYear)) alpha = 80;
      if (!isHover && this.hovered) alpha = min(alpha, 160);

      noStroke();
      fill(red(baseCol), green(baseCol), blue(baseCol), alpha);

      const grow = map(limit - p.idx, 0, 10, 1, 1.15, true);
      const r = (isHover ? this.pointSize + 4 : this.pointSize) * grow;

      if (isHover) { stroke(255, 230); strokeWeight(2); }
      ellipse(p.x, p.y, r, r);
    }

    if (this.hovered) this.drawTooltip(this.hovered);

    // Handle legend drag/select
    this._handleLegendInteraction();

    if (this.revealIndex < total) this.revealIndex += 1;
  };

  // Interactions on the legend
  this._handleLegendInteraction = function () {
    const inside = this._mouseInLegend();
    const nowPressed = mouseIsPressed;

    // Double-click to reset
    if (!nowPressed && this._wasMousePressed && inside) {
      const t = millis();
      if (t - this._lastClickTime < 300) {
        this.filter = null;
        this.dragStartYear = this.dragEndYear = null;
      }
      this._lastClickTime = t;
    }

    // Start drag
    if (nowPressed && !this._wasMousePressed && inside) {
      this.isDraggingLegend = true;
      this.dragStartYear = this._yearAt(mouseX);
      this.dragEndYear = this.dragStartYear;
    }

    // Dragging
    if (nowPressed && this.isDraggingLegend) {
      this.dragEndYear = this._yearAt(mouseX);
    }

    // apply filter
    if (!nowPressed && this._wasMousePressed && this.isDraggingLegend) {
      this.isDraggingLegend = false;
      if (this.dragStartYear != null && this.dragEndYear != null) {
        const a = round(min(this.dragStartYear, this.dragEndYear));
        const b = round(max(this.dragStartYear, this.dragEndYear));
        this.filter = {
          minYear: constrain(a, this.minYear, this.maxYear),
          maxYear: constrain(b, this.minYear, this.maxYear)
        };
      }
    }

    this._wasMousePressed = nowPressed;
  };

  this._mouseInLegend = function () {
    const { x, y, w, h } = this.legend;
    return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  };

  this._yearAt = function (mx) {
    const t = constrain((mx - this.legend.x) / this.legend.w, 0, 1);
    return this.minYear + t * (this.maxYear - this.minYear);
  };

  // Visuals
  this.drawTitle = function () {
    noStroke();
    fill('#333');
    textAlign(CENTER, CENTER);
    textSize(20);
    text(this.title,
      this.layout.leftMargin + this.layout.plotWidth() / 2,
      this.layout.topMargin - this.layout.marginSize * 0.9);
  };

  this.drawAxes = function () {
    stroke('#555'); strokeWeight(1);
    line(this.layout.leftMargin, this.layout.topMargin,
      this.layout.leftMargin, this.layout.bottomMargin);
    line(this.layout.leftMargin, this.layout.bottomMargin,
      this.layout.rightMargin, this.layout.bottomMargin);
    this.drawAxisLabels();
    this.drawXTicks();
    this.drawYTicks();
  };

  // Animated gradient legend
  this.drawLegend = function (progress) {
    const { x, y } = this.legend;
    const w = this.legend.w, h = this.legend.h;

    push();
    noFill(); stroke('#ccc'); rect(x - 2, y - 2, w + 4, h + 4, 3);

    // Gradient fill based on progress
    for (let i = 0; i <= 100 * progress; i++) {
      const inter = i / 100;
      const col = lerpColor(color('#D4A5FF'), color('#3C1361'), inter);
      stroke(col);
      line(x + i * (w / 100), y, x + i * (w / 100), y + h);
    }

    // Selection overlay
    let sel = null;
    if (this.isDraggingLegend && this.dragStartYear != null) {
      const a = this._xAtYear(this.dragStartYear);
      const b = this._xAtYear(this.dragEndYear);
      sel = { sx: min(a, b), ex: max(a, b) };
    } else if (this.filter) {
      sel = { sx: this._xAtYear(this.filter.minYear), ex: this._xAtYear(this.filter.maxYear) };
    }

    if (sel) {
      noStroke();
      fill(0, 0, 0, 40);
      rect(sel.sx, y, sel.ex - sel.sx, h, 2);

      fill('#444'); noStroke(); textSize(11); textAlign(CENTER, BOTTOM);
      const yrA = round(map(sel.sx, x, x + w, this.minYear, this.maxYear));
      const yrB = round(map(sel.ex, x, x + w, this.minYear, this.maxYear));
      text(`${min(yrA, yrB)}–${max(yrA, yrB)}`, (sel.sx + sel.ex) / 2, y - 4);
    }
    pop();

    noStroke(); fill('#444'); textSize(10);
    textAlign(LEFT, CENTER); text(this.minYear, x - 30, y + h / 2);
    textAlign(RIGHT, CENTER); text(this.maxYear, x + w + 30, y + h / 2);
  };

  this._xAtYear = function (year) {
    const t = (year - this.minYear) / (this.maxYear - this.minYear);
    return this.legend.x + t * this.legend.w;
  };

  this.drawTooltip = function (p) {
    const padX = 12, padY = 10, lineH = 18;
    const lines = [
      `Year: ${p.year}`,
      `Bread: £${nfc(p.bread, 0)}`,
      `Meat: £${nfc(p.meat, 0)}`
    ];

    textSize(12);
    let tw = 0;
    for (let s of lines) tw = max(tw, textWidth(s));
    const boxW = tw + padX * 2;
    const boxH = lines.length * lineH + padY;

    let tx = p.x + 16;
    let ty = p.y - boxH - 12;
    tx = constrain(tx, this.layout.leftMargin, this.layout.rightMargin - boxW);
    ty = constrain(ty, this.layout.topMargin, this.layout.bottomMargin - boxH);

    noStroke(); fill(0, 45); rect(tx + 2, ty + 2, boxW, boxH, 8);
    fill(255); rect(tx, ty, boxW, boxH, 8);

    fill(30); let y = ty + 10;
    for (let s of lines) { textAlign(LEFT, TOP); text(s, tx + padX, y); y += lineH; }
  };

  // Quadrant shading using medians
  this.drawQuadrants = function () {
    const mx = this.mapBreadToX(this.medianBread);
    const my = this.mapMeatToY(this.medianMeat);

    noStroke();
    // low/low
    fill(210, 235, 255, 40);
    rect(this.layout.leftMargin, my, mx - this.layout.leftMargin, this.layout.bottomMargin - my);
    // high/low
    fill(230, 215, 255, 40);
    rect(mx, my, this.layout.rightMargin - mx, this.layout.bottomMargin - my);
    // low/high
    fill(230, 255, 230, 40);
    rect(this.layout.leftMargin, this.layout.topMargin, mx - this.layout.leftMargin, my - this.layout.topMargin);
    // high/high
    fill(255, 238, 220, 45);
    rect(mx, this.layout.topMargin, this.layout.rightMargin - mx, my - this.layout.topMargin);

    // median guides
    stroke('#d7d7d7'); strokeWeight(1);
    line(mx, this.layout.topMargin, mx, this.layout.bottomMargin);
    line(this.layout.leftMargin, my, this.layout.rightMargin, my);
  };

  this.drawKey = function () {
    const lines = [
      '• Drag across legend to filter years',
      '• Double‑click legend to reset',
    ];

    textSize(11);
    textAlign(LEFT, TOP);

    const pad = 6, lh = 14;
    let w = 0; for (const s of lines) w = max(w, textWidth(s));
    const bw = w + pad * 2;
    const bh = lines.length * lh + pad * 2;

    const x = this.legend.x;
    const y = this.legend.y - bh - 6;

    stroke('#5a2d82ff');
    fill(255, 235);
    rect(x, y, bw, bh, 4);

    noStroke();
    fill(40);
    let ty = y + pad;
    for (const s of lines) { text(s, x + pad, ty); ty += lh; }
  };

  this.drawAxisLabels = function () {
    fill('#333'); noStroke(); textAlign(CENTER, CENTER); textSize(14);
    text(this.xAxisLabel,
      this.layout.leftMargin + this.layout.plotWidth() / 2,
      this.layout.bottomMargin + this.layout.marginSize * 0.8);

    push();
    translate(this.layout.leftMargin - this.layout.marginSize * 1.2,
      this.layout.topMargin + this.layout.plotHeight() / 2);
    rotate(-HALF_PI);
    text(this.yAxisLabel, 0, 0);
    pop();
  };

  this.drawXTicks = function () {
    let interval = (this.maxBread - this.minBread) / this.layout.numXTickLabels;
    textSize(12); fill('#555');
    for (let i = 0; i <= this.layout.numXTickLabels; i++) {
      let val = this.minBread + i * interval;
      let x = this.mapBreadToX(val);
      noStroke(); textAlign(CENTER, TOP); text(nfc(val, 0), x, this.layout.bottomMargin + 6);
    }
  };

  this.drawYTicks = function () {
    let interval = (this.maxMeat - this.minMeat) / this.layout.numYTickLabels;
    textSize(12); fill('#555');
    for (let i = 0; i <= this.layout.numYTickLabels; i++) {
      let val = this.minMeat + i * interval;
      let y = this.mapMeatToY(val);
      noStroke(); textAlign(RIGHT, CENTER); text(nfc(val, 0), this.layout.leftMargin - 8, y);
    }
  };

  this.drawGridlines = function () {
    stroke('#e9e9ee'); strokeWeight(1);
    let xInterval = (this.maxBread - this.minBread) / this.layout.numXTickLabels;
    for (let i = 0; i <= this.layout.numXTickLabels; i++) {
      let val = this.minBread + i * xInterval;
      let x = this.mapBreadToX(val);
      line(x, this.layout.topMargin, x, this.layout.bottomMargin);
    }
    let yInterval = (this.maxMeat - this.minMeat) / this.layout.numYTickLabels;
    for (let i = 0; i <= this.layout.numYTickLabels; i++) {
      let val = this.minMeat + i * yInterval;
      let y = this.mapMeatToY(val);
      line(this.layout.leftMargin, y, this.layout.rightMargin, y);
    }
  };

  this.mapBreadToX = function (val) {
    return map(val, this.minBread, this.maxBread, this.layout.leftMargin, this.layout.rightMargin);
  };
  this.mapMeatToY = function (val) {
    return map(val, this.minMeat, this.maxMeat, this.layout.bottomMargin, this.layout.topMargin);
  };
}
