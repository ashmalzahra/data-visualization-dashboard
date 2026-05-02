function UKInflationbyYear() {
  this.name = 'UK Monthly Inflation (1989–2023)';
  this.id = 'uk-monthly-inflation';
  this.title = 'UK Monthly Inflation (1989–2023)';

  const cellSize = 24;
  this.layout = {
    marginSize: 80,
    leftMargin: 120,
    rightMargin: width - 60,
    topMargin: 120,
    bottomMargin: height - 60,
    plotWidth: function () { return this.rightMargin - this.leftMargin; },
    plotHeight: function () { return this.bottomMargin - this.topMargin; }
  };

  this.loaded = false;
  this.table = null;
  this.dataByYear = {};
  this.years = [];
  this.months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  this.minInflation = Infinity;
  this.maxInflation = -Infinity;


  this._revealTimes = {};

  // Row by row reveal
  this._revealRow = -1;
  this._rowStartMs = {};
  this._nextRowAtMs = 0;
  const ROW_INTERVAL_MS = 110;
  const ROW_FADE_MS = 520;

  // Lock and Compare state
  this._pinnedYear = null;
  this._compareYear = null;

  //input helpers
  this._wasMouseDown = false;
  this._escWasDown = false;

  const RIPPLE_MS = 900;

  this.preload = function () {
    this.table = loadTable('data/inflation/Inflation by Month.csv', 'csv', 'header');
  };

  this.setup = function () {
    this.dataByYear = {};
    this.years = [];
    this.minInflation = Infinity;
    this.maxInflation = -Infinity;

    for (let r = 0; r < this.table.getRowCount(); r++) {
      const row = this.table.getRow(r);
      const year = row.getString('Year');
      const month = row.getString('Month');
      const inflation = parseFloat(row.getString('Inflation'));

      if (!this.dataByYear[year]) { this.dataByYear[year] = {}; this.years.push(year); }
      this.dataByYear[year][month] = inflation;

      if (!isNaN(inflation)) {
        this.minInflation = min(this.minInflation, inflation);
        this.maxInflation = max(this.maxInflation, inflation);
      }
    }
    this.years.sort();

    // values list
    this._allVals = [];
    for (let y of this.years) for (let m of this.months) {
      const v = this.dataByYear[y][m]; if (!isNaN(v)) this._allVals.push(v);
    }
    this._allVals.sort((a, b) => a - b);
    this._percentileOf = (v) => {
      let i = this._allVals.findIndex(x => x >= v);
      if (i < 0) i = this._allVals.length - 1;
      return Math.round((i / (this._allVals.length - 1)) * 100);
    };

    // reveal reset
    this._revealRow = -1;
    this._rowStartMs = {};
    this._nextRowAtMs = millis();
    this._revealTimes = {};

    // compare reset
    this._pinnedYear = null;
    this._compareYear = null;

    // input reset
    this._wasMouseDown = false;
    this._escWasDown = false;

    this.loaded = true;
  };

  this.draw = function () {
    if (!this.loaded) return;

    // Esc to clear
    if (keyIsDown(ESCAPE)) {
      if (!this._escWasDown) {
        this._pinnedYear = null;
        this._compareYear = null;
      }
      this._escWasDown = true;
    } else {
      this._escWasDown = false;
    }

    background(255);
    this.drawTitle();

    // Month labels
    textSize(10); fill(40);
    for (let m = 0; m < this.months.length; m++) {
      push();
      translate(this.layout.leftMargin + m * cellSize + cellSize / 2, this.layout.topMargin - 8);
      rotate(-QUARTER_PI); text(this.months[m], 0, 0);
      pop();
    }

    // Year labels
    for (let y = 0; y < this.years.length; y++) {
      const year = this.years[y];
      textAlign(RIGHT, CENTER); fill(50);
      text(year, this.layout.leftMargin - 10, this.layout.topMargin + y * cellSize + cellSize / 2);
    }

    // Row scheduler
    if (this._revealRow < this.years.length - 1 && millis() >= this._nextRowAtMs) {
      this._revealRow++; this._rowStartMs[this._revealRow] = millis();
      this._nextRowAtMs = millis() + ROW_INTERVAL_MS;
    }

    // Grid bounds
    const gridLeft = this.layout.leftMargin;
    const gridTop = this.layout.topMargin;
    const gridW = this.months.length * cellSize;
    const gridH = this.years.length * cellSize;

    // Hover bands
    let hoverY = -1, hoverM = -1;
    if (mouseX >= gridLeft && mouseX <= gridLeft + gridW &&
      mouseY >= gridTop && mouseY <= gridTop + gridH) {
      hoverM = floor((mouseX - gridLeft) / cellSize);
      hoverY = floor((mouseY - gridTop) / cellSize);
    }
    if (hoverY >= 0) { noStroke(); fill(0, 0, 0, 18); rect(gridLeft, gridTop + hoverY * cellSize, gridW, cellSize); }
    if (hoverM >= 0) { noStroke(); fill(0, 0, 0, 12); rect(gridLeft + hoverM * cellSize, gridTop, cellSize, gridH); }

    // internal click handling (pin/compare)
    if (mouseIsPressed && !this._wasMouseDown) {
      if (mouseX >= gridLeft && mouseX <= gridLeft + gridW &&
        mouseY >= gridTop && mouseY <= gridTop + gridH) {
        const yIdx = floor((mouseY - gridTop) / cellSize);
        const yr = this.years[yIdx];

        if (keyIsDown(SHIFT) && this._pinnedYear && yr !== this._pinnedYear) {
          this._compareYear = (this._compareYear === yr) ? null : yr;
        } else {
          if (this._pinnedYear === yr) { this._pinnedYear = null; this._compareYear = null; }
          else { this._pinnedYear = yr; this._compareYear = null; }
        }
      }
      this._wasMouseDown = true;
    }
    if (!mouseIsPressed) this._wasMouseDown = false;

    let _pendingTip = null, _tipX = 0, _tipY = 0;

    // Cells
    for (let y = 0; y < this.years.length; y++) {
      const year = this.years[y];
      for (let m = 0; m < this.months.length; m++) {
        const val = this.dataByYear[year][this.months[m]];
        const x = gridLeft + m * cellSize;
        const yPos = gridTop + y * cellSize;

        let colr = color(230);
        if (!isNaN(val)) colr = interpolateOrRd(val, this.minInflation, this.maxInflation);

        // row fade
        let progress = 0;
        if (y < this._revealRow) progress = 1;
        else if (y === this._revealRow) {
          const started = this._rowStartMs[y] ?? millis();
          progress = constrain((millis() - started) / ROW_FADE_MS, 0, 1);
        }

        const base = color(colr); base.setAlpha(255 * progress);
        noStroke(); fill(base); rect(x, yPos, cellSize, cellSize);

        if (progress > 0.9 && !isNaN(val) && val >= this.maxInflation * 0.85) {
          const cellIdx = y * this.months.length + m;
          if (this._revealTimes[cellIdx] === undefined) this._revealTimes[cellIdx] = millis();
          const age = millis() - this._revealTimes[cellIdx];

          if (age < RIPPLE_MS) {
            drawGlowAndRipple(x + cellSize / 2, yPos + cellSize / 2, cellSize, colr, age);
          } else if (progress >= 1) {
            drawHeatwaveCell(x + cellSize / 2, yPos + cellSize / 2, cellSize, colr);
          }
        }

        // Tooltip
        const isHot = !isNaN(val) && val >= this.maxInflation * 0.85;
        if (progress >= 1 &&
          mouseX > x && mouseX < x + cellSize &&
          mouseY > yPos && mouseY < yPos + cellSize &&
          !isNaN(val)) {

          if (this._pinnedYear && this._compareYear && year === this._compareYear) {
            const baseV = this.dataByYear[this._pinnedYear][this.months[m]];
            const lines = [];
            if (isHot) {
              const rel = Math.round((val / this.maxInflation) * 100);
              lines.push(`📈 High Inflation (Top 15%) • vs record: ${rel}%`);
            }
            if (!isNaN(baseV)) {
              const delta = val - baseV;
              const upFilled = '▲', upHollow = '△';
              const downFilled = '▼', downHollow = '▽';
              let pair = '•';
              if (delta > 0) pair = `${upFilled} ${downHollow}`;
              else if (delta < 0) pair = `${downFilled} ${upHollow}`;
              lines.push(`${pair} vs ${this._pinnedYear}: ${delta.toFixed(1)}%`);
            }
            _pendingTip = { rich: true, title: `${this.months[m]} ${year} — ${val.toFixed(1)}%`, lines };
            _tipX = x; _tipY = yPos;
          } else if (isHot) {
            const rel = Math.round((val / this.maxInflation) * 100);
            _pendingTip = { rich: true, title: `${this.months[m]} ${year} — ${val.toFixed(1)}%`, lines: [`📈 High Inflation (Top 15%) • vs record: ${rel}%`] };
            _tipX = x; _tipY = yPos;
          } else {
            _pendingTip = { rich: false, text: `${this.months[m]} ${year} — ${val.toFixed(1)}%` };
            _tipX = x; _tipY = yPos;
          }
        }
      }
    }

    // Row outlines
    const rowY = (idx) => gridTop + idx * cellSize;
    const pinIdx = this._pinnedYear ? this.years.indexOf(this._pinnedYear) : -1;
    const cmpIdx = this._compareYear ? this.years.indexOf(this._compareYear) : -1;

    strokeWeight(2);
    if (pinIdx >= 0) { stroke(0, 120, 255, 160); noFill(); rect(gridLeft - 1, rowY(pinIdx) - 1, gridW + 2, cellSize + 2, 2); }
    if (cmpIdx >= 0) { stroke(255, 80, 80, 160); noFill(); rect(gridLeft - 1, rowY(cmpIdx) - 1, gridW + 2, cellSize + 2, 2); }

    if (pinIdx >= 0 && cmpIdx >= 0) {
      const h = 6; const yStrip = rowY(pinIdx) + cellSize + 3;
      let maxAbs = 0;
      for (let m = 0; m < this.months.length; m++) {
        const a = this.dataByYear[this._pinnedYear][this.months[m]];
        const b = this.dataByYear[this._compareYear][this.months[m]];
        if (!isNaN(a) && !isNaN(b)) maxAbs = max(maxAbs, abs(b - a));
      }
      maxAbs = max(0.1, maxAbs);
      noStroke();
      for (let m = 0; m < this.months.length; m++) {
        const x = gridLeft + m * cellSize;
        const a = this.dataByYear[this._pinnedYear][this.months[m]];
        const b = this.dataByYear[this._compareYear][this.months[m]];
        if (isNaN(a) || isNaN(b)) continue;
        const d = b - a;
        const c = divergingBlueWhiteRed(d, maxAbs, maxAbs);
        fill(c); rect(x, yStrip, cellSize, h, 2);
      }

      // Determine chronological order
      const yA = parseInt(this._pinnedYear, 10);
      const yB = parseInt(this._compareYear, 10);
      const ySmall = Math.min(yA, yB);   // earlier year
      const yLarge = Math.max(yA, yB);   // later year

      // Average change from earlier to later across months
      let sum = 0, n = 0;
      for (let m = 0; m < this.months.length; m++) {
        const a = this.dataByYear[String(ySmall)][this.months[m]]; // earlier
        const b = this.dataByYear[String(yLarge)][this.months[m]]; // later
        if (!isNaN(a) && !isNaN(b)) { sum += (b - a); n++; }
      }
      const meanDelta = n ? sum / n : 0;
      const dirArrow = meanDelta > 0 ? '▲' : meanDelta < 0 ? '▼' : '•';

      textSize(10); fill(35); noStroke(); textAlign(LEFT, CENTER);
      text(`${dirArrow} ${ySmall} – ${yLarge}`, gridLeft, yStrip + h + 12);
    }

    // key
    if (this.years.length) {
      noStroke(); fill(60); textSize(11); textAlign(RIGHT, BASELINE);
      text('Click: Pin Year  •   Shift+Click: Compare Pinned Year  •   Esc: Clear Compare',
        this.layout.rightMargin, this.layout.topMargin - 28);
    }

    if (_pendingTip) {
      if (_pendingTip.rich) this.drawTooltipRich(_pendingTip.title, _pendingTip.lines, _tipX, _tipY);
      else this.drawTooltip(_pendingTip.text, _tipX, _tipY);
    }

    this.drawLegend(this.minInflation, this.maxInflation);
  };

  this.keyPressed = () => {
    if (keyCode === ESCAPE) { this._pinnedYear = null; this._compareYear = null; }
  };

  // UI helpers
  this.drawTitle = function () {
    fill(30); noStroke(); textAlign(CENTER, CENTER);
    textSize(18);
    text(this.title,
      this.layout.leftMargin + this.layout.plotWidth() / 2,
      this.layout.topMargin - this.layout.marginSize);
    textSize(12);
    text('Each cell shows the inflation rate (%) for a given month and year',
      this.layout.leftMargin + this.layout.plotWidth() / 2,
      this.layout.topMargin - this.layout.marginSize + 22);
  };

  this.drawLegend = function (minVal, maxVal) {
    const x = width - 80, y = this.layout.topMargin, h = 150;
    for (let i = 0; i <= h; i++) {
      const val = map(i, 0, h, minVal, maxVal);
      const c = interpolateOrRd(val, minVal, maxVal);
      stroke(c); line(x, y + i, x + 15, y + i);
    }
    noStroke(); fill(30); textSize(10); textAlign(LEFT, CENTER);
    text(`${minVal.toFixed(1)}%`, x + 20, y);
    text(`${maxVal.toFixed(1)}%`, x + 20, y + h);
    text('Inflation', x, y - 10);
  };

  this.drawTooltip = function (txt, anchorX, anchorY) {
    const padding = 6; textSize(12);
    const w = textWidth(txt) + padding * 2, h = 26;
    const x = constrain(anchorX + 12, 5, width - w - 5);
    const y = constrain(anchorY - h - 10, 5, height - h - 5);
    fill(255, 245); noStroke(); rect(x, y, w, h, 5);
    stroke(120); noFill(); rect(x, y, w, h, 5);
    fill(30); noStroke(); textAlign(LEFT, CENTER);
    text(txt, x + padding, y + h / 2);
  };

  this.drawTooltipRich = function (title, lines, anchorX, anchorY) {
    textSize(12);
    const padding = 8, lineH = 16;
    let w = textWidth(title);
    for (let ln of lines) w = max(w, textWidth(ln));
    w += padding * 2;
    const h = padding * 2 + lineH * (1 + lines.length) + 4;
    let x = constrain(anchorX + 12, 5, width - w - 5);
    let y = constrain(anchorY - h - 10, 5, height - h - 5);
    noStroke(); fill(255, 245); rect(x, y, w, h, 6);
    stroke(180); noFill(); rect(x, y, w, h, 6);
    noStroke(); fill(25); textAlign(LEFT, CENTER);
    text(title, x + padding, y + padding + lineH / 2);
    let yCursor = y + padding + lineH + 4;
    for (let ln of lines) { fill(60); text(ln, x + padding, yCursor + lineH / 2); yCursor += lineH; }
  };

  function interpolateOrRd(val, min, max) {
    let t = constrain(map(val, min, max, 0, 1), 0, 1);
    if (t < 0.2) return lerpColor(color('#fff7ec'), color('#fee8c8'), t / 0.2);
    if (t < 0.4) return lerpColor(color('#fee8c8'), color('#fdbb84'), (t - 0.2) / 0.2);
    if (t < 0.6) return lerpColor(color('#fdbb84'), color('#fc8d59'), (t - 0.4) / 0.2);
    if (t < 0.8) return lerpColor(color('#fc8d59'), color('#e34a33'), (t - 0.6) / 0.2);
    return lerpColor(color('#e34a33'), color('#b30000'), (t - 0.8) / 0.2);
  }

  function divergingBlueWhiteRed(v, negMax, posMax) {
    const t = constrain(map(v, -negMax, posMax, 0, 1), 0, 1);
    const mid = 0.5;
    if (t <= mid) return lerpColor(color('#2b8cbe'), color('#ffffff'), t / mid);
    return lerpColor(color('#ffffff'), color('#e34a33'), (t - mid) / (1 - mid));
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function drawGlowAndRipple(cx, cy, s, col, ageMs) {
    const t = constrain(ageMs / RIPPLE_MS, 0, 1);
    const e = easeOutCubic(1 - t);
    const popScale = 1 + 0.10 * e;

    push();
    translate(cx, cy);
    scale(popScale);

    blendMode(ADD);
    noStroke();
    const base = color(col);
    for (let i = 0; i < 3; i++) {
      const a = map(i, 0, 2, 70, 20) * (1 - t);
      base.setAlpha(a);
      fill(base);
      const r = s * (1.0 + 0.6 * i);
      ellipse(0, 0, r, r);
    }

    const ringR = s * (1.0 + 1.2 * t);
    stroke(red(col), green(col), blue(col), 140 * (1 - t));
    strokeWeight(1.5);
    noFill();
    ellipse(0, 0, ringR, ringR);

    pop();
    blendMode(BLEND);
  }

  function drawHeatwaveCell(cx, cy, s, col) {
    const t = millis() / 1000;

    const ox = 2.5 * sin(t * 3.1 + cx * 0.02);
    const oy = 2.5 * cos(t * 2.7 + cy * 0.015);

    push();
    translate(cx + ox, cy + oy);

    noStroke();
    fill(col);
    rectMode(CENTER);
    rect(0, 0, s, s, 2);

    blendMode(ADD);
    for (let i = 0; i < 3; i++) {
      const a = 50 + 40 * sin(t * (1.5 + i * 0.3) + i);
      const shiftX = 1.5 * sin(t * (2.0 + i * 0.5) + i);
      const shiftY = 1.5 * cos(t * (1.8 + i * 0.4) + i);
      const scaleFactor = 1 + 0.05 * sin(t * (2.5 + i) + i);

      const c2 = color(col);
      c2.setAlpha(a);
      fill(c2);

      push();
      scale(scaleFactor);
      rect(shiftX, shiftY, s, s, 2);
      pop();
    }

    pop();
    blendMode(BLEND);
  }
}
